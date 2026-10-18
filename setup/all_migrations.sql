-- ============================================================================
--  AUTINERARY — CONSOLIDATED MIGRATION RUNBOOK
--
--  Both apps (Goal Planning + ServiceHub/ResourceHub) share ONE Supabase
--  project, so this single file covers both.
--
--  HOW TO RUN
--    1. Supabase dashboard -> SQL Editor -> New query
--    2. Paste this entire file, Run.
--
--  SAFE TO RE-RUN. Every statement is idempotent (IF NOT EXISTS / DROP POLICY
--  IF EXISTS ... CREATE POLICY), so running it twice changes nothing. Already
--  applied migrations are simply skipped.
--
--  Wrapped in a single transaction: if anything fails, NOTHING is applied and
--  you can fix and re-run cleanly. (No CONCURRENTLY statements, so this is safe.)
--
--  Ordered by dependency: tables are created before the migrations that ALTER
--  them (notably community_posts before the unlocking_moment / what_didnt_work
--  columns).
--
--  PREREQUISITE: the two base schemas must already be applied (they are, in
--  production): servicehub-mvp/lib/supabase/schema.sql provides `ratings`,
--  `resources`, `profiles`, `saved_resources`, which some steps below ALTER.
-- ============================================================================

BEGIN;

-- Function bodies are checked when they run, not when they are created (as
-- pg_dump does): some steps create functions that use tables a later step
-- creates, so with checking on, a new database stopped at STEP 01.
SET LOCAL check_function_bodies = off;


-- ==========================================================================
-- STEP 01 — backend/database/migrations/2026_reflection_learning.sql
-- ==========================================================================

-- Reflection learning loop: persist journal entries, capture reward signals,
-- and let the agents get better every time someone writes an entry — at zero
-- per-entry cost (no model fine-tuning, just Postgres + cheap statistics).
--
-- The system can't fine-tune OpenAI's weights for free, so we do the next
-- best thing: keep the LLM fixed and make everything that surrounds it
-- (retrieval ranking, pattern correlations, adaptation thresholds, few-shot
-- examples) demonstrably better with each entry.
--
-- Run this once in the Supabase SQL editor AFTER 2026_pattern_user_embeddings.sql.

-- =============================================================================
-- 1. PERSISTENT JOURNAL LOG  (replaces backend's in-memory list)
--
-- IMPORTANT: an older, narrower `reflections` table already exists from
-- database/schema.sql (id, user_id, context_type, context_id UUID NOT NULL,
-- free_form_text, sentiment, created_at) and has a foreign key from
-- reflection_questions(reflection_id) -> reflections(id). We therefore do
-- NOT drop/replace it — we extend it additively. Every statement below is
-- idempotent and safe to re-run.
-- =============================================================================

-- 1a. Create the table if it doesn't exist (fresh installs). On existing
-- installs this is a no-op and the ALTER TABLE block below brings the schema
-- up to date.
CREATE TABLE IF NOT EXISTS public.reflections (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL,
  context_type          TEXT        NOT NULL,
  context_id            TEXT,
  questions             JSONB       NOT NULL DEFAULT '[]'::jsonb,
  free_form_text        TEXT,
  sentiment_label       TEXT,
  sentiment_score       REAL,
  completion_rate       REAL,
  reward_signal         REAL,
  reflection_response   JSONB,
  adaptation_response   JSONB,
  indicators            TEXT[]      NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1b. Bring an OLD reflections table (from database/schema.sql) up to the
-- shape this learning loop expects. Each step is independently idempotent.
ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS questions             JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sentiment_label       TEXT,
  ADD COLUMN IF NOT EXISTS sentiment_score       REAL,
  ADD COLUMN IF NOT EXISTS completion_rate       REAL,
  ADD COLUMN IF NOT EXISTS reward_signal         REAL,
  ADD COLUMN IF NOT EXISTS reflection_response   JSONB,
  ADD COLUMN IF NOT EXISTS adaptation_response   JSONB,
  ADD COLUMN IF NOT EXISTS indicators            TEXT[]      NOT NULL DEFAULT '{}';

-- 1c. The old schema declared context_id as UUID NOT NULL. The learning
-- pipeline passes arbitrary strings (e.g. "path-1" in the demo seed and
-- nullable values when the reflection is global), so widen the type and
-- relax the NOT NULL. UUID values cast to TEXT lossless-ly.
DO $$
DECLARE
  v_col_type    TEXT;
  v_is_nullable TEXT;
BEGIN
  SELECT c.data_type, c.is_nullable
    INTO v_col_type, v_is_nullable
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name   = 'reflections'
     AND c.column_name  = 'context_id';

  IF v_col_type = 'uuid' THEN
    EXECUTE 'ALTER TABLE public.reflections
               ALTER COLUMN context_id TYPE TEXT USING context_id::text';
  END IF;

  IF v_is_nullable = 'NO' THEN
    EXECUTE 'ALTER TABLE public.reflections
               ALTER COLUMN context_id DROP NOT NULL';
  END IF;
END $$;

-- 1d. The old schema also had a CHECK on context_type with a fixed list.
-- We accept additional context_type values in the new code path, so drop
-- the constraint if it exists. (Constraint name follows the standard
-- Postgres "<table>_<column>_check" pattern.)
ALTER TABLE public.reflections
  DROP CONSTRAINT IF EXISTS reflections_context_type_check;

-- 1e. Indexes — safe to create after the columns above exist.
CREATE INDEX IF NOT EXISTS reflections_user_idx
  ON public.reflections(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reflections_reward_idx
  ON public.reflections(reward_signal DESC NULLS LAST);

ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
-- Service-role only (matches recommendation_memory + pattern_user_embeddings).

-- =============================================================================
-- 2. LEARNED PATTERNS  (replaces hardcoded coupled_events dict in the agent)
--
-- Every (trigger, outcome) pair is tracked across all users. The "correlation"
-- is a simple online estimate updated on every reflection. After enough data,
-- this REPLACES the agent's hand-written sleep_task / meal_energy / etc. table.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.learned_patterns (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger               TEXT        NOT NULL,
  outcome               TEXT        NOT NULL,
  -- Online stats
  co_occurrence_count   INT         NOT NULL DEFAULT 0,
  trigger_only_count    INT         NOT NULL DEFAULT 0,
  outcome_only_count    INT         NOT NULL DEFAULT 0,
  neither_count         INT         NOT NULL DEFAULT 0,
  total_observations    INT         NOT NULL DEFAULT 0,
  -- Derived (materialized for fast reads). P(outcome | trigger).
  correlation           REAL        NOT NULL DEFAULT 0.5,
  -- The agent's best current advice for this pattern. May start empty and
  -- get back-filled from the highest-reward reflections that hit this pair.
  recommendation        TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trigger, outcome)
);
CREATE INDEX IF NOT EXISTS learned_patterns_correlation_idx
  ON public.learned_patterns(correlation DESC, total_observations DESC);

ALTER TABLE public.learned_patterns ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. PATTERN-USER FEEDBACK  (re-ranking signal for similar-user retrieval)
--
-- When we retrieve user B as similar to user A and that match leads to a good
-- (or bad) outcome, we log a signal. The find_similar_pattern_users RPC then
-- re-ranks: cosine_distance is the prior; this is the posterior correction.
-- Embeddings themselves stay frozen — we adapt the *retrieval policy*.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pattern_user_feedback (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  query_user_id         UUID        NOT NULL,
  retrieved_user_id     UUID        NOT NULL,
  signal                REAL        NOT NULL DEFAULT 0,  -- running mean, in [-1, 1]
  sample_count          INT         NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(query_user_id, retrieved_user_id)
);
CREATE INDEX IF NOT EXISTS pattern_user_feedback_lookup_idx
  ON public.pattern_user_feedback(query_user_id, retrieved_user_id);

ALTER TABLE public.pattern_user_feedback ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. ADAPTATION OUTCOMES  (contextual bandit for adaptation_agent thresholds)
--
-- Records (rule, threshold) chosen by adaptation_agent, then the NEXT reflection
-- fills in next_reflection_reward. best_rule_threshold() picks the arm with the
-- highest mean reward — a simple greedy-mean contextual bandit, no ML libs.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.adaptation_outcomes (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL,
  reflection_id            UUID,
  rule_fired               TEXT        NOT NULL,
  threshold_used           REAL,
  -- Filled in by the NEXT reflection from this user.
  next_reflection_reward   REAL,
  outcome_resolved_at      TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS adaptation_outcomes_open_idx
  ON public.adaptation_outcomes(user_id, created_at DESC)
  WHERE next_reflection_reward IS NULL;
CREATE INDEX IF NOT EXISTS adaptation_outcomes_bandit_idx
  ON public.adaptation_outcomes(rule_fired, threshold_used, next_reflection_reward)
  WHERE next_reflection_reward IS NOT NULL;

ALTER TABLE public.adaptation_outcomes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. RPCs
-- =============================================================================

-- 5a. Replace the find_similar_pattern_users RPC with a version that re-ranks
-- by past feedback + success_rate. Same signature plus an optional
-- query_user_id (defaults NULL = no personalization).
CREATE OR REPLACE FUNCTION public.find_similar_pattern_users(
  query_embedding   VECTOR(1536),
  match_threshold   FLOAT  DEFAULT 0.7,
  match_count       INT    DEFAULT 10,
  barriers_filter   TEXT[] DEFAULT NULL,
  query_user_id     UUID   DEFAULT NULL
)
RETURNS TABLE (
  user_id         UUID,
  similarity      FLOAT,
  barriers        TEXT[],
  goals           TEXT[],
  success_rate    REAL,
  journey         TEXT,
  motivation_type TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    p.user_id,
    -- Combined score = cosine similarity
    --                + small bias toward users who actually succeeded
    --                + personalized feedback bonus (zero if no history)
    (1 - (p.embedding <=> query_embedding))
      + 0.10 * COALESCE(p.success_rate, 0.5)
      + COALESCE(
          (SELECT signal
             FROM public.pattern_user_feedback f
            WHERE f.query_user_id    = find_similar_pattern_users.query_user_id
              AND f.retrieved_user_id = p.user_id),
          0
        )
      AS similarity,
    p.barriers,
    p.goals,
    p.success_rate,
    p.journey,
    p.motivation_type
  FROM public.pattern_user_embeddings p
  WHERE 1 - (p.embedding <=> query_embedding) > match_threshold
    AND (barriers_filter IS NULL OR p.barriers && barriers_filter)
    AND (query_user_id IS NULL OR p.user_id <> query_user_id)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- 5b. Update co-occurrence counts for every (trigger, outcome) pair implied
-- by the indicators present in this reflection. Cartesian over indicators is
-- intentional and cheap (indicator lists are small, ~5-10).
CREATE OR REPLACE FUNCTION public.update_learned_patterns(
  present_indicators TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  t TEXT;
  o TEXT;
BEGIN
  IF present_indicators IS NULL OR array_length(present_indicators, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Update co-occurrence for all ordered (trigger, outcome) pairs that BOTH appear.
  FOREACH t IN ARRAY present_indicators LOOP
    FOREACH o IN ARRAY present_indicators LOOP
      CONTINUE WHEN t = o;

      INSERT INTO public.learned_patterns (trigger, outcome,
        co_occurrence_count, total_observations, correlation, updated_at)
      VALUES (t, o, 1, 1, 1.0, NOW())
      ON CONFLICT (trigger, outcome) DO UPDATE
        SET co_occurrence_count = public.learned_patterns.co_occurrence_count + 1,
            total_observations  = public.learned_patterns.total_observations + 1,
            correlation         = (public.learned_patterns.co_occurrence_count + 1)::REAL
                                 / NULLIF(public.learned_patterns.co_occurrence_count
                                          + public.learned_patterns.trigger_only_count + 1, 0),
            updated_at = NOW();
    END LOOP;
  END LOOP;

  -- Update trigger-only count for every (trigger, outcome) where trigger
  -- appeared but outcome did not. We only touch pairs we've already seen at
  -- least once, otherwise we'd insert N^2 zero rows for every possible
  -- indicator. This means correlations stabilize once a pair has co-occurred
  -- at least once — good enough for the bandit and very cheap.
  UPDATE public.learned_patterns lp
     SET trigger_only_count = lp.trigger_only_count + 1,
         total_observations = lp.total_observations + 1,
         correlation        = lp.co_occurrence_count::REAL
                             / NULLIF(lp.co_occurrence_count + lp.trigger_only_count + 1, 0),
         updated_at = NOW()
   WHERE lp.trigger = ANY (present_indicators)
     AND NOT (lp.outcome = ANY (present_indicators));
END;
$$;

-- 5c. Return the top learned (trigger, outcome) correlations. The agent reads
-- this in addition to its hardcoded dict — over time, the learned set wins.
CREATE OR REPLACE FUNCTION public.get_top_learned_patterns(
  min_observations INT  DEFAULT 5,
  min_correlation  REAL DEFAULT 0.5,
  max_results      INT  DEFAULT 50
)
RETURNS TABLE (
  trigger         TEXT,
  outcome         TEXT,
  correlation     REAL,
  observations    INT,
  recommendation  TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT trigger, outcome, correlation, total_observations, recommendation
  FROM public.learned_patterns
  WHERE total_observations >= min_observations
    AND correlation         >= min_correlation
  ORDER BY correlation DESC, total_observations DESC
  LIMIT max_results;
$$;

-- 5d. Close the bandit loop for a user: when a new reflection comes in,
-- attribute its reward to the most recent unresolved adaptation(s) for that
-- user (within a 14-day attribution window).
CREATE OR REPLACE FUNCTION public.close_adaptation_loop(
  user_id_in UUID,
  reward_in  REAL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE public.adaptation_outcomes
     SET next_reflection_reward = reward_in,
         outcome_resolved_at    = NOW()
   WHERE user_id = user_id_in
     AND next_reflection_reward IS NULL
     AND created_at > NOW() - INTERVAL '14 days';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 5e. Greedy-mean bandit: pick the threshold value that has produced the
-- highest mean reward for this rule, requiring a minimum sample count. Falls
-- back to the caller-provided default when there isn't enough data yet.
CREATE OR REPLACE FUNCTION public.best_rule_threshold(
  rule_name         TEXT,
  default_threshold REAL,
  min_samples       INT DEFAULT 3
)
RETURNS REAL
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    (SELECT threshold_used
       FROM public.adaptation_outcomes
      WHERE rule_fired = rule_name
        AND next_reflection_reward IS NOT NULL
        AND threshold_used IS NOT NULL
      GROUP BY threshold_used
      HAVING COUNT(*) >= min_samples
      ORDER BY AVG(next_reflection_reward) DESC
      LIMIT 1),
    default_threshold
  );
$$;

-- 5f. Retrieve high-reward past reflections matching a set of barriers, to
-- be injected as few-shot examples into the adaptation_agent's LLM prompt.
-- This is the "in-context RLHF" piece: the foundation model behaves better
-- because the prompt it sees has been progressively conditioned on what
-- worked for past users.
CREATE OR REPLACE FUNCTION public.get_success_examples(
  barriers_filter TEXT[],
  max_results     INT DEFAULT 3
)
RETURNS TABLE (
  reward_signal      REAL,
  sentiment_label    TEXT,
  context_type       TEXT,
  reflection_summary TEXT,
  adaptation_summary TEXT,
  created_at         TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  WITH user_barriers AS (
    SELECT user_id, barriers FROM public.pattern_user_embeddings
  )
  SELECT
    r.reward_signal,
    r.sentiment_label,
    r.context_type,
    LEFT(COALESCE(r.free_form_text, ''), 280)                  AS reflection_summary,
    LEFT(COALESCE(r.adaptation_response->>'explanation', ''), 280) AS adaptation_summary,
    r.created_at
  FROM public.reflections r
  LEFT JOIN user_barriers ub USING (user_id)
  WHERE r.reward_signal IS NOT NULL
    AND r.reward_signal >= 0.3
    AND (barriers_filter IS NULL
         OR ub.barriers IS NULL
         OR ub.barriers && barriers_filter)
  ORDER BY r.reward_signal DESC, r.created_at DESC
  LIMIT max_results;
$$;


-- ==========================================================================
-- STEP 02 — backend/database/migrations/2026_pattern_user_embeddings.sql
-- ==========================================================================

-- Pattern Recognition Agent: vector store for "learn from people who came before you"
--
-- Replaces the previous Pinecone integration. The Python backend's
-- PatternRecognitionAgent generates 1536-dim OpenAI embeddings
-- (text-embedding-ada-002) from each user's profile + barriers + goals and
-- stores them here so future onboarding runs can do top-K similarity search
-- against past users' journeys.
--
-- This table is intentionally separate from `user_embeddings`:
--   - `user_embeddings` (servicehub-mvp) is 384-dim and powers resource matching
--   - `pattern_user_embeddings` (this file) is 1536-dim and powers similar-user
--     pattern discovery in the multi-agent path-planning flow
--
-- Run this once in the Supabase SQL editor.

-- 1. Make sure pgvector is enabled (no-op if already enabled by servicehub schema)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.pattern_user_embeddings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL UNIQUE,
  embedding        VECTOR(1536) NOT NULL,
  barriers         TEXT[]      NOT NULL DEFAULT '{}',
  goals            TEXT[]      NOT NULL DEFAULT '{}',
  success_rate     REAL        NOT NULL DEFAULT 0.5,
  journey          TEXT        NOT NULL DEFAULT '',
  motivation_type  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS: backend writes use the service-role key, so RLS stays enabled with
-- no policies. This matches `recommendation_memory` and blocks anon access.
ALTER TABLE public.pattern_user_embeddings ENABLE ROW LEVEL SECURITY;

-- 4. Cosine-similarity index. ivfflat needs data to build well; if the table
-- is empty when you run this it will still create but won't be useful until
-- you have a few hundred rows. Re-run REINDEX later if needed.
CREATE INDEX IF NOT EXISTS pattern_user_embeddings_embedding_idx
  ON public.pattern_user_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 5. RPC: top-K similar users with optional barrier filtering.
-- `barriers_filter` semantic: array overlap (`&&`) — return users that share
-- AT LEAST ONE barrier with the query. Pass NULL to disable the filter.
CREATE OR REPLACE FUNCTION public.find_similar_pattern_users(
  query_embedding   VECTOR(1536),
  match_threshold   FLOAT  DEFAULT 0.7,
  match_count       INT    DEFAULT 10,
  barriers_filter   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  user_id         UUID,
  similarity      FLOAT,
  barriers        TEXT[],
  goals           TEXT[],
  success_rate    REAL,
  journey         TEXT,
  motivation_type TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    p.user_id,
    1 - (p.embedding <=> query_embedding) AS similarity,
    p.barriers,
    p.goals,
    p.success_rate,
    p.journey,
    p.motivation_type
  FROM public.pattern_user_embeddings p
  WHERE 1 - (p.embedding <=> query_embedding) > match_threshold
    AND (barriers_filter IS NULL OR p.barriers && barriers_filter)
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;


-- ==========================================================================
-- STEP 03 — backend/database/migrations/2026_universal_agent_learning.sql
-- ==========================================================================

-- Universal agent learning loop: add a per-(agent, context) reward signal so
-- EVERY agent in goal-planning gets measurably better with each reflection,
-- without fine-tuning the foundation model.
--
-- This sits on top of 2026_reflection_learning.sql:
--   * That migration covered the reflection_analysis_agent (learned_patterns)
--     and the adaptation_agent (adaptation_outcomes bandit) + few-shot.
--   * This migration covers the remaining three goal-planning agents
--     (path_planning, tool_recommendation, calendar_optimization), wires up
--     the missing writer for pattern_user_feedback (used by
--     pattern_recognition_agent), and adds a shared "what did we last show
--     the user?" snapshot table so the reflection route can attribute
--     reward back to the right agent.
--   * The ServiceHub recommendation agent also reads from
--     `tool_outcomes` (resource-level reward), so the same writers
--     close the loop on the resource hub too.
--
-- Idempotent. Run AFTER 2026_reflection_learning.sql.

-- =============================================================================
-- 1. USER LATEST CONTEXT  (attribution snapshot)
--
-- Whenever we generate a path, we snapshot exactly what we produced so the
-- NEXT reflection can attribute its reward to the right (path shape, tool
-- set, schedule buckets, retrieved similar users). One row per user — we
-- overwrite on each new generation.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_latest_context (
  user_id              UUID        PRIMARY KEY,
  profile_signature    TEXT,
  milestone_count      INT,
  est_days_avg         REAL,
  recommended_tool_ids TEXT[]      NOT NULL DEFAULT '{}',
  scheduled_buckets    TEXT[]      NOT NULL DEFAULT '{}',
  retrieved_user_ids   UUID[]      NOT NULL DEFAULT '{}',
  barriers             TEXT[]      NOT NULL DEFAULT '{}',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.user_latest_context ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. PATH PLANNING OUTCOMES
--
-- Aggregates: for a given (profile_signature) — i.e. a stable hash of
-- (barriers + goal categories) — what is the mean reward of paths with
-- N milestones and average estimated duration D? Path planner reads this
-- to pick a starting shape that has historically produced good outcomes.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.path_planning_outcomes (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_signature  TEXT        NOT NULL,
  milestone_count    INT         NOT NULL,
  est_days_avg       REAL,
  reward_sum         REAL        NOT NULL DEFAULT 0,
  reward_count       INT         NOT NULL DEFAULT 0,
  reward_avg         REAL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_signature, milestone_count)
);
CREATE INDEX IF NOT EXISTS path_planning_outcomes_lookup
  ON public.path_planning_outcomes(profile_signature, reward_avg DESC NULLS LAST);

ALTER TABLE public.path_planning_outcomes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. TOOL / RESOURCE OUTCOMES
--
-- Per (tool_id, barrier) cell: how much reward did showing this tool produce
-- for users with this barrier? Both goal-planning's tool_recommendation_agent
-- and ServiceHub's recommendation-agent scorer read from this.
--
-- We key by (tool_id, barrier) instead of (tool_id, barrier_combination)
-- so we get useful aggregates with small sample sizes early on.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tool_outcomes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id         TEXT        NOT NULL,
  barrier         TEXT        NOT NULL DEFAULT 'general',
  reward_sum      REAL        NOT NULL DEFAULT 0,
  reward_count    INT         NOT NULL DEFAULT 0,
  reward_avg      REAL,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tool_id, barrier)
);
CREATE INDEX IF NOT EXISTS tool_outcomes_barrier_idx
  ON public.tool_outcomes(barrier, reward_avg DESC NULLS LAST);

ALTER TABLE public.tool_outcomes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. CALENDAR OUTCOMES
--
-- Per (user_id, time_bucket): mean reward when this user was scheduled in
-- this slot. Buckets are short strings the calendar agent emits, e.g.
-- 'morning_focus', 'late_morning_focus', 'afternoon_easy', 'evening_recovery'.
-- Calendar agent reads top buckets per user and biases scheduling toward them.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.calendar_outcomes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL,
  time_bucket   TEXT        NOT NULL,
  reward_sum    REAL        NOT NULL DEFAULT 0,
  reward_count  INT         NOT NULL DEFAULT 0,
  reward_avg    REAL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, time_bucket)
);
CREATE INDEX IF NOT EXISTS calendar_outcomes_user_idx
  ON public.calendar_outcomes(user_id, reward_avg DESC NULLS LAST);

ALTER TABLE public.calendar_outcomes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. RPCs
-- =============================================================================

-- 5a. Snapshot the latest generation context for a user. Called from the
-- orchestrator each time a fresh path is generated.
CREATE OR REPLACE FUNCTION public.snapshot_user_context(
  user_id_in              UUID,
  profile_signature_in    TEXT,
  milestone_count_in      INT,
  est_days_avg_in         REAL,
  recommended_tool_ids_in TEXT[],
  scheduled_buckets_in    TEXT[],
  retrieved_user_ids_in   UUID[],
  barriers_in             TEXT[]
)
RETURNS VOID
LANGUAGE SQL
AS $$
  INSERT INTO public.user_latest_context AS ulc (
    user_id, profile_signature, milestone_count, est_days_avg,
    recommended_tool_ids, scheduled_buckets, retrieved_user_ids,
    barriers, updated_at
  )
  VALUES (
    user_id_in, profile_signature_in, milestone_count_in, est_days_avg_in,
    COALESCE(recommended_tool_ids_in, '{}'),
    COALESCE(scheduled_buckets_in, '{}'),
    COALESCE(retrieved_user_ids_in, '{}'),
    COALESCE(barriers_in, '{}'),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET profile_signature    = EXCLUDED.profile_signature,
        milestone_count      = EXCLUDED.milestone_count,
        est_days_avg         = EXCLUDED.est_days_avg,
        recommended_tool_ids = EXCLUDED.recommended_tool_ids,
        scheduled_buckets    = EXCLUDED.scheduled_buckets,
        retrieved_user_ids   = EXCLUDED.retrieved_user_ids,
        barriers             = EXCLUDED.barriers,
        updated_at           = NOW();
$$;

-- 5b. Best path shape for a given profile signature. Returns the
-- (milestone_count, est_days_avg) that maximizes reward_avg over a minimum
-- sample size. NULL row when there isn't enough data — caller falls back.
CREATE OR REPLACE FUNCTION public.get_best_path_shape(
  profile_signature_in TEXT,
  min_samples          INT DEFAULT 3
)
RETURNS TABLE (
  milestone_count INT,
  est_days_avg    REAL,
  reward_avg      REAL,
  sample_count    INT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT milestone_count, est_days_avg, reward_avg, reward_count
  FROM public.path_planning_outcomes
  WHERE profile_signature = profile_signature_in
    AND reward_count      >= min_samples
  ORDER BY reward_avg DESC NULLS LAST, reward_count DESC
  LIMIT 1;
$$;

-- 5c. Update path outcomes with a fresh reward for a (signature, count) cell.
CREATE OR REPLACE FUNCTION public.record_path_outcome(
  profile_signature_in TEXT,
  milestone_count_in   INT,
  est_days_avg_in      REAL,
  reward_in            REAL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.path_planning_outcomes AS p (
    profile_signature, milestone_count, est_days_avg,
    reward_sum, reward_count, reward_avg, updated_at
  )
  VALUES (
    profile_signature_in, milestone_count_in, est_days_avg_in,
    reward_in, 1, reward_in, NOW()
  )
  ON CONFLICT (profile_signature, milestone_count) DO UPDATE
    SET reward_sum   = p.reward_sum + reward_in,
        reward_count = p.reward_count + 1,
        reward_avg   = (p.reward_sum + reward_in) / NULLIF(p.reward_count + 1, 0),
        est_days_avg = COALESCE(
                         (COALESCE(p.est_days_avg, 0) * p.reward_count + COALESCE(est_days_avg_in, 0))
                         / NULLIF(p.reward_count + 1, 0),
                         p.est_days_avg
                       ),
        updated_at   = NOW();
END;
$$;

-- 5d. Update tool outcomes for a list of tools, optionally per barrier.
-- Attributes the reward equally across every (tool, barrier) cell.
CREATE OR REPLACE FUNCTION public.record_tool_outcomes(
  tool_ids_in TEXT[],
  barriers_in TEXT[],
  reward_in   REAL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  tid TEXT;
  bar TEXT;
  bars TEXT[];
BEGIN
  IF tool_ids_in IS NULL OR array_length(tool_ids_in, 1) IS NULL THEN
    RETURN;
  END IF;

  bars := COALESCE(NULLIF(barriers_in, '{}'), ARRAY['general']);

  FOREACH tid IN ARRAY tool_ids_in LOOP
    FOREACH bar IN ARRAY bars LOOP
      INSERT INTO public.tool_outcomes AS t (
        tool_id, barrier, reward_sum, reward_count, reward_avg, last_seen_at
      )
      VALUES (tid, bar, reward_in, 1, reward_in, NOW())
      ON CONFLICT (tool_id, barrier) DO UPDATE
        SET reward_sum   = t.reward_sum + reward_in,
            reward_count = t.reward_count + 1,
            reward_avg   = (t.reward_sum + reward_in) / NULLIF(t.reward_count + 1, 0),
            last_seen_at = NOW();
    END LOOP;
  END LOOP;
END;
$$;

-- 5e. Read per-(tool, barrier) learned reward scores. Returns the best
-- reward_avg across the given barriers for each tool. Used by both
-- goal-planning tool_recommendation_agent and ServiceHub scorer.
CREATE OR REPLACE FUNCTION public.get_tool_outcome_scores(
  barriers_in  TEXT[],
  min_samples  INT DEFAULT 2
)
RETURNS TABLE (
  tool_id      TEXT,
  reward_avg   REAL,
  sample_count INT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT tool_id,
         MAX(reward_avg)              AS reward_avg,
         SUM(reward_count)::INT       AS sample_count
  FROM public.tool_outcomes
  WHERE (barriers_in IS NULL OR barrier = ANY (barriers_in) OR barrier = 'general')
    AND reward_count >= min_samples
  GROUP BY tool_id
  ORDER BY MAX(reward_avg) DESC NULLS LAST;
$$;

-- 5f. Record calendar bucket outcomes for a user.
CREATE OR REPLACE FUNCTION public.record_calendar_outcomes(
  user_id_in     UUID,
  time_buckets_in TEXT[],
  reward_in      REAL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  bucket TEXT;
BEGIN
  IF time_buckets_in IS NULL OR array_length(time_buckets_in, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH bucket IN ARRAY time_buckets_in LOOP
    INSERT INTO public.calendar_outcomes AS c (
      user_id, time_bucket, reward_sum, reward_count, reward_avg, updated_at
    )
    VALUES (user_id_in, bucket, reward_in, 1, reward_in, NOW())
    ON CONFLICT (user_id, time_bucket) DO UPDATE
      SET reward_sum   = c.reward_sum + reward_in,
          reward_count = c.reward_count + 1,
          reward_avg   = (c.reward_sum + reward_in) / NULLIF(c.reward_count + 1, 0),
          updated_at   = NOW();
  END LOOP;
END;
$$;

-- 5g. Per-user top calendar buckets (the ones with highest learned reward).
CREATE OR REPLACE FUNCTION public.get_user_calendar_preferences(
  user_id_in  UUID,
  min_samples INT DEFAULT 2,
  max_results INT DEFAULT 5
)
RETURNS TABLE (
  time_bucket  TEXT,
  reward_avg   REAL,
  sample_count INT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT time_bucket, reward_avg, reward_count
  FROM public.calendar_outcomes
  WHERE user_id      = user_id_in
    AND reward_count >= min_samples
  ORDER BY reward_avg DESC NULLS LAST, reward_count DESC
  LIMIT max_results;
$$;

-- 5h. Update pattern_user_feedback with an EMA toward the reward signal.
-- This is the missing writer for the pattern_recognition_agent loop. Table
-- already exists in 2026_reflection_learning.sql.
CREATE OR REPLACE FUNCTION public.record_pattern_user_feedback(
  query_user_id_in       UUID,
  retrieved_user_ids_in  UUID[],
  reward_in              REAL,
  alpha_in               REAL DEFAULT 0.3
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  rid UUID;
BEGIN
  IF retrieved_user_ids_in IS NULL OR array_length(retrieved_user_ids_in, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH rid IN ARRAY retrieved_user_ids_in LOOP
    INSERT INTO public.pattern_user_feedback AS f (
      query_user_id, retrieved_user_id, signal, sample_count, updated_at
    )
    VALUES (query_user_id_in, rid, reward_in, 1, NOW())
    ON CONFLICT (query_user_id, retrieved_user_id) DO UPDATE
      SET signal       = ((1 - alpha_in) * f.signal) + (alpha_in * reward_in),
          sample_count = f.sample_count + 1,
          updated_at   = NOW();
  END LOOP;
END;
$$;

-- 5i. Convenience read for the snapshot, so reflection route gets all
-- attribution targets in one round-trip.
CREATE OR REPLACE FUNCTION public.get_user_latest_context(
  user_id_in UUID
)
RETURNS TABLE (
  profile_signature    TEXT,
  milestone_count      INT,
  est_days_avg         REAL,
  recommended_tool_ids TEXT[],
  scheduled_buckets    TEXT[],
  retrieved_user_ids   UUID[],
  barriers             TEXT[]
)
LANGUAGE SQL
STABLE
AS $$
  SELECT profile_signature, milestone_count, est_days_avg,
         recommended_tool_ids, scheduled_buckets, retrieved_user_ids, barriers
  FROM public.user_latest_context
  WHERE user_id = user_id_in;
$$;


-- ==========================================================================
-- STEP 04 — backend/database/migrations/2026_path_models.sql
-- ==========================================================================

-- Community-contributed Path Market models.
--
-- Layer 3 of the Path Market: named path models inside a Life Category. Seed
-- "Foundations" models live in code; these are user-submitted ones (e.g. a
-- "Model Madhu"). Run once against the shared Supabase project. Idempotent.

CREATE TABLE IF NOT EXISTS public.path_models (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key   TEXT NOT NULL,                 -- Life Category (e.g. 'med-sci')
  name           TEXT NOT NULL,                 -- unique-ish model name
  contributor    TEXT,                          -- display credit
  contributor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description    TEXT NOT NULL,                 -- short: how this path differs
  seed_goals     JSONB NOT NULL DEFAULT '[]',   -- string[]
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS path_models_category_idx ON public.path_models (category_key);
CREATE INDEX IF NOT EXISTS path_models_status_idx   ON public.path_models (status);
CREATE INDEX IF NOT EXISTS path_models_owner_idx    ON public.path_models (contributor_id);

ALTER TABLE public.path_models ENABLE ROW LEVEL SECURITY;

-- Everyone can read APPROVED models.
DROP POLICY IF EXISTS "path_models_read_approved" ON public.path_models;
CREATE POLICY "path_models_read_approved" ON public.path_models
  FOR SELECT USING (status = 'approved');

-- A contributor can read their OWN submissions (any status).
DROP POLICY IF EXISTS "path_models_read_own" ON public.path_models;
CREATE POLICY "path_models_read_own" ON public.path_models
  FOR SELECT USING (auth.uid() = contributor_id);

-- A signed-in user can submit a model as themselves, only as 'pending'.
DROP POLICY IF EXISTS "path_models_insert_own" ON public.path_models;
CREATE POLICY "path_models_insert_own" ON public.path_models
  FOR INSERT WITH CHECK (auth.uid() = contributor_id AND status = 'pending');

-- Approval/rejection is done by the service-role admin API (bypasses RLS), so
-- no UPDATE policy for anon/auth roles.


-- ==========================================================================
-- STEP 05 — backend/database/migrations/2026_path_categories.sql
-- ==========================================================================

-- Path Market life categories — moved out of hardcoded page.tsx into editable
-- DB rows (Odosa: "can we not make anything here hardcoded"). The page now
-- fetches these instead of shipping them in code; community path_models still
-- merge on top by category_key. `icon` is a Lucide icon NAME mapped to a
-- component client-side (we can't store a component). Idempotent: safe to run
-- repeatedly; the seed uses ON CONFLICT DO NOTHING so edits in the DB stick.

CREATE TABLE IF NOT EXISTS public.path_categories (
  key                     TEXT PRIMARY KEY,
  title                   TEXT NOT NULL,
  blurb                   TEXT NOT NULL,
  icon                    TEXT NOT NULL DEFAULT 'Sparkles',
  tint                    TEXT NOT NULL DEFAULT 'from-slate-50 to-white border-slate-200',
  icon_tint               TEXT NOT NULL DEFAULT 'bg-slate-100 text-slate-600',
  focus_category          TEXT NOT NULL DEFAULT 'other',
  examples                JSONB NOT NULL DEFAULT '[]',
  foundations_description TEXT,
  foundations_seed_goals  JSONB NOT NULL DEFAULT '[]',
  foundations_status      TEXT NOT NULL DEFAULT 'live',   -- 'live' | 'coming'
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS path_categories_sort_idx ON public.path_categories (sort_order);

ALTER TABLE public.path_categories ENABLE ROW LEVEL SECURITY;

-- Categories are a public browse taxonomy: readable by everyone. Editing is
-- done via the service-role admin path (bypasses RLS), so no write policy here.
DROP POLICY IF EXISTS path_categories_read ON public.path_categories;
CREATE POLICY path_categories_read ON public.path_categories
  FOR SELECT USING (true);

-- ---- Seed the current 8 categories as editable data (not code) --------------
INSERT INTO public.path_categories
  (key, title, blurb, icon, tint, icon_tint, focus_category, examples, foundations_description, foundations_seed_goals, foundations_status, sort_order)
VALUES
  ('med-sci', 'Medicine & Science',
   'Pursue a path in healthcare, research, or the sciences with accommodations built in.',
   'Stethoscope', 'from-sky-50 to-white border-sky-200', 'bg-sky-100 text-sky-600', 'education',
   '["Pre-med prerequisites","Research assistant roles","Lab / clinical skills","Grad-school applications"]',
   'The general route into science/medicine — prerequisites, research, and applications.',
   '["Get into a science/medicine program","Build research experience"]', 'live', 1),

  ('living', 'Independent Living',
   'Build the skills and supports to live on your own terms — home, money, and daily routines.',
   'Home', 'from-emerald-50 to-white border-emerald-200', 'bg-emerald-100 text-emerald-600', 'other',
   '["Budgeting & finances","Housing & tenancy","Meal planning & cooking","Daily-living routines"]',
   'A grounded start on money, housing, and daily routines for living independently.',
   '["Live independently","Manage my own budget"]', 'live', 2),

  ('career', 'Career & Workplace',
   'Land and thrive in a job that fits you — including disclosure and accommodations.',
   'Briefcase', 'from-amber-50 to-white border-amber-200', 'bg-amber-100 text-amber-600', 'career',
   '["Resume & interviews","Accommodation requests","Workplace social norms","Career growth"]',
   'Find work that fits, request accommodations, and grow — the general path.',
   '["Get a fulfilling job","Request workplace accommodations"]', 'live', 3),

  ('education', 'Education',
   'Navigate school, college, or trade programs with the right supports at each step.',
   'GraduationCap', 'from-indigo-50 to-white border-indigo-200', 'bg-indigo-100 text-indigo-600', 'education',
   '["Accommodations at school","Study strategies","Applications & funding","Graduation planning"]',
   'Get set up with accommodations and study supports through to graduation.',
   '["Graduate from my program","Set up school accommodations"]', 'live', 4),

  ('health', 'Health & Wellness',
   'Support your physical and mental health with routines, care, and self-advocacy.',
   'HeartPulse', 'from-rose-50 to-white border-rose-200', 'bg-rose-100 text-rose-600', 'health',
   '["Finding the right care","Managing appointments","Wellness routines","Self-advocacy in healthcare"]',
   'Build wellness routines and find care that works — the general path.',
   '["Build a wellness routine","Find supportive healthcare"]', 'live', 5),

  ('relationships', 'Relationships & Community',
   'Build and keep meaningful connections — friends, family, and community.',
   'Users', 'from-purple-50 to-white border-purple-200', 'bg-purple-100 text-purple-600', 'relationships',
   '["Making friends","Communication skills","Joining communities","Navigating family"]',
   'Grow a support network and communication skills at your own pace.',
   '["Build a support network","Improve my communication"]', 'live', 6),

  ('creative', 'Creative & Hobbies',
   'Turn interests into skills or income — art, music, making, and more.',
   'Palette', 'from-fuchsia-50 to-white border-fuchsia-200', 'bg-fuchsia-100 text-fuchsia-600', 'other',
   '["Develop a craft","Share your work","Find creative community","Monetize a hobby"]',
   'Grow a creative skill and share it — the general path.',
   '["Grow a creative skill"]', 'coming', 7),

  ('travel', 'Travel & Independence',
   'Plan sensory-aware travel and build confidence getting around.',
   'Plane', 'from-cyan-50 to-white border-cyan-200', 'bg-cyan-100 text-cyan-600', 'other',
   '["Sensory-friendly trip planning","Public transit confidence","Travel checklists","Accessible destinations"]',
   'Plan sensory-aware travel and build transit confidence.',
   '["Plan a trip","Get comfortable with transit"]', 'coming', 8)
ON CONFLICT (key) DO NOTHING;


-- ==========================================================================
-- STEP 06 — backend/database/migrations/2026_family_accounts.sql
-- ==========================================================================

-- Family accounts: 18+ gate + parent/guardian → child supervision (the paid tier)
--
-- Run once against the shared Supabase project. Idempotent (IF NOT EXISTS).
--
-- Model:
--   * profiles.date_of_birth  — set at signup; drives the 18+ self-signup gate.
--   * profiles.plan           — billing stub: 'free' | 'family'.
--   * profiles.managed_by_guardian — true for child accounts a parent created.
--   * guardianships           — parent (guardian_id) supervises child (child_id).
--
-- Access model: the supervision API verifies the guardianship server-side and
-- reads the child's rows with the service-role client, so we don't need
-- cross-table RLS on user_paths / race_progress. RLS below only protects the
-- guardianships table itself.

-- 1. Profile columns -------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'family')),
  ADD COLUMN IF NOT EXISTS managed_by_guardian BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Guardianships ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guardianships (
  guardian_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'parent',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guardian_id, child_id),
  CHECK (guardian_id <> child_id)
);

CREATE INDEX IF NOT EXISTS guardianships_child_idx  ON public.guardianships (child_id);
CREATE INDEX IF NOT EXISTS guardianships_guardian_idx ON public.guardianships (guardian_id);

-- 3. RLS on guardianships (a user sees rows where they are guardian OR child).
ALTER TABLE public.guardianships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardianships_select_own" ON public.guardianships;
CREATE POLICY "guardianships_select_own" ON public.guardianships
  FOR SELECT USING (auth.uid() = guardian_id OR auth.uid() = child_id);

-- Writes go through the service-role API (age/consent checks live there), so no
-- INSERT/UPDATE/DELETE policies for anon/auth roles — service_role bypasses RLS.


-- ==========================================================================
-- STEP 07 — backend/database/migrations/2026_collab_groups.sql
-- ==========================================================================

-- ============================================================================
-- Collab Groups (Hare World) — real, persisted groups.
--
-- The Create Group modal existed but was a dummy: uncontrolled inputs and a
-- button that only closed the dialog. Groups lived in local useState and
-- vanished on refresh. This gives them a home.
--
-- Model: a group has ONE leader (who sets the rules) and many members.
-- Public groups are searchable; private groups need a join code.
--
-- Idempotent. Run once against the shared Supabase project.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.collab_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  -- Matches the collabTypes list in the UI (study, project, fitness, …).
  type        TEXT NOT NULL,
  -- The leader's rules for the group, shown to members.
  rules       TEXT,
  is_public   BOOLEAN NOT NULL DEFAULT TRUE,
  -- Short human-shareable code. Only meaningful for private groups.
  join_code   TEXT UNIQUE,
  leader_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collab_groups_type_idx   ON public.collab_groups (type);
CREATE INDEX IF NOT EXISTS collab_groups_public_idx ON public.collab_groups (is_public);
CREATE INDEX IF NOT EXISTS collab_groups_leader_idx ON public.collab_groups (leader_id);

CREATE TABLE IF NOT EXISTS public.collab_group_members (
  group_id  UUID NOT NULL REFERENCES public.collab_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS collab_group_members_user_idx ON public.collab_group_members (user_id);

-- ---- RLS ---------------------------------------------------------------------
ALTER TABLE public.collab_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_group_members ENABLE ROW LEVEL SECURITY;

-- Public groups are discoverable by everyone. Private groups are visible only
-- to their members (finding one otherwise requires the code, checked serverside).
DROP POLICY IF EXISTS collab_groups_read ON public.collab_groups;
CREATE POLICY collab_groups_read ON public.collab_groups
  FOR SELECT USING (
    is_public
    OR leader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.collab_group_members m
       WHERE m.group_id = collab_groups.id AND m.user_id = auth.uid()
    )
  );

-- You can see membership rows for groups you're in.
DROP POLICY IF EXISTS collab_group_members_read ON public.collab_group_members;
CREATE POLICY collab_group_members_read ON public.collab_group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.collab_group_members m
       WHERE m.group_id = collab_group_members.group_id AND m.user_id = auth.uid()
    )
  );

-- Create / join / leave go through the service-role API where the code check
-- and leader rules are enforced, so no INSERT/UPDATE policies here.

COMMENT ON TABLE public.collab_groups IS
  'Hare World collab groups. One leader sets the rules; public groups are searchable, private ones need join_code.';


-- ==========================================================================
-- STEP 08 — servicehub-mvp/scripts/2026_servicehub_agent_learning.sql
-- ==========================================================================

-- ServiceHub: universal agent learning loop for the four remaining agents
-- (pattern, validation, synthesis, orchestrator).
--
-- The recommendation-agent already learns via the shared `tool_outcomes`
-- table from 2026_universal_agent_learning.sql. This migration closes the
-- same bandit loop for the other four ServiceHub agents, all sharing one
-- pair of tables + one attribution RPC so adding a future agent is a
-- two-line change instead of a new schema.
--
-- Architecture
-- ============
--   1. servicehub_agent_decisions  — append-only trace. Every time one of
--      the four agents makes a decision that touches a (user, resource),
--      one row is written. Decision_key is an agent-specific stable string
--      so we can aggregate later.
--
--   2. servicehub_agent_outcomes   — running aggregate keyed by
--      (agent_name, decision_key). Stores reward_sum + reward_count so we
--      can compute reward_avg on read.
--
--   3. attribute_servicehub_reward(user, resource, reward, window_days)
--      RPC — called from the rating route when a user rates a resource.
--      Broadcasts the reward to all in-window decisions on (user, resource)
--      across all four agents, in one round-trip.
--
--   4. get_servicehub_agent_scores(agent_name, decision_keys[]) RPC —
--      read helper. Each agent passes its candidate decision_keys; we
--      return reward_avg per key. Agent uses those to re-rank/bias
--      whatever it was about to do.
--
-- Idempotent. Safe to run multiple times. Run in the Supabase SQL editor.

-- =============================================================================
-- 1. DECISION TRACE  (append-only)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.servicehub_agent_decisions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       UUID,
    resource_id   UUID,
    agent_name    TEXT NOT NULL,
    decision_key  TEXT NOT NULL,
    confidence    REAL,
    decided_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS servicehub_agent_decisions_attribution_idx
    ON public.servicehub_agent_decisions(user_id, resource_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS servicehub_agent_decisions_agent_idx
    ON public.servicehub_agent_decisions(agent_name, decision_key);

CREATE INDEX IF NOT EXISTS servicehub_agent_decisions_decided_at_idx
    ON public.servicehub_agent_decisions(decided_at);

ALTER TABLE public.servicehub_agent_decisions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.servicehub_agent_decisions IS
    'Append-only trace of (agent, decision_key) made for a (user, resource). Closed by attribute_servicehub_reward when a rating arrives.';

-- =============================================================================
-- 2. RUNNING AGGREGATE  (the actual bandit table)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.servicehub_agent_outcomes (
    agent_name    TEXT NOT NULL,
    decision_key  TEXT NOT NULL,
    reward_sum    REAL NOT NULL DEFAULT 0,
    reward_count  INT  NOT NULL DEFAULT 0,
    last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (agent_name, decision_key)
);

CREATE INDEX IF NOT EXISTS servicehub_agent_outcomes_lookup_idx
    ON public.servicehub_agent_outcomes(agent_name, reward_count DESC);

ALTER TABLE public.servicehub_agent_outcomes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.servicehub_agent_outcomes IS
    'Per-(agent, decision_key) reward aggregate. reward_avg = reward_sum/reward_count when reward_count > 0.';

-- =============================================================================
-- 3. ATTRIBUTE A REWARD TO ALL IN-WINDOW DECISIONS  (write path)
--
-- Called from the ratings POST route. Given a (user, resource, reward),
-- find every decision row touching that pair within the lookback window
-- and update the aggregate. Returns the number of decisions credited so
-- the caller can log / monitor.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.attribute_servicehub_reward(
    p_user_id     UUID,
    p_resource_id UUID,
    p_reward      REAL,
    p_window_days INTEGER DEFAULT 30
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows_credited INTEGER := 0;
BEGIN
    IF p_user_id IS NULL OR p_resource_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Pure no-op when reward is exactly zero. Neutral ratings carry no
    -- learning signal and we don't want to inflate reward_count.
    IF p_reward IS NULL OR p_reward = 0 THEN
        RETURN 0;
    END IF;

    WITH credited AS (
        INSERT INTO public.servicehub_agent_outcomes
            (agent_name, decision_key, reward_sum, reward_count, last_seen)
        SELECT
            d.agent_name,
            d.decision_key,
            p_reward,
            1,
            now()
        FROM public.servicehub_agent_decisions d
        WHERE d.user_id = p_user_id
          AND d.resource_id = p_resource_id
          AND d.decided_at > now() - (p_window_days * INTERVAL '1 day')
        ON CONFLICT (agent_name, decision_key)
        DO UPDATE SET
            reward_sum   = public.servicehub_agent_outcomes.reward_sum + EXCLUDED.reward_sum,
            reward_count = public.servicehub_agent_outcomes.reward_count + 1,
            last_seen    = now()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_rows_credited FROM credited;

    RETURN v_rows_credited;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attribute_servicehub_reward(UUID, UUID, REAL, INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.attribute_servicehub_reward(UUID, UUID, REAL, INTEGER) IS
    'Broadcast a reward to every (agent, decision_key) that touched (user, resource) within window_days.';

-- =============================================================================
-- 4. READ HELPER  (each agent calls this at decision time)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_servicehub_agent_scores(
    p_agent_name    TEXT,
    p_decision_keys TEXT[],
    p_min_samples   INTEGER DEFAULT 1
) RETURNS TABLE (
    decision_key TEXT,
    reward_avg   REAL,
    reward_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        o.decision_key,
        CASE WHEN o.reward_count > 0
             THEN (o.reward_sum / o.reward_count)::REAL
             ELSE 0::REAL
        END AS reward_avg,
        o.reward_count
    FROM public.servicehub_agent_outcomes o
    WHERE o.agent_name = p_agent_name
      AND o.decision_key = ANY(p_decision_keys)
      AND o.reward_count >= GREATEST(1, p_min_samples);
$$;

GRANT EXECUTE ON FUNCTION public.get_servicehub_agent_scores(TEXT, TEXT[], INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_servicehub_agent_scores(TEXT, TEXT[], INTEGER) IS
    'Return reward_avg + reward_count for the given decision_keys of an agent. Used by all four ServiceHub agents at decision time.';


-- ==========================================================================
-- STEP 09 — servicehub-mvp/scripts/2026_community_tidbits.sql
-- ==========================================================================

-- ServiceHub: Tidbits community platform (Reddit x StackOverflow for barriers).
--
-- Fully-functional. No MVP cuts. Owned by ResourceHub (this app) with entry
-- points from goal-planning (Hare World pit-stop + milestone screens).
--
-- Requirements covered
-- ====================
--   * Opt-in community participation (users explicitly enable a community profile)
--   * Pseudonym always — real name never surfaces in community surfaces
--   * Public/private profile + per-field visibility (calendar, tasks, paths, posts)
--   * One-way follow when profile is public
--   * Threaded answers + votes + accepted-answer
--   * MANDATORY "Solved" line on accept: key_insight + tldr (1-3 sentences)
--   * Image uploads via Supabase Storage (existing `resource-images` bucket reused)
--   * Rich-text (markdown) posts + answers
--   * Badges/karma — both automatic (reputation events) and admin-grantable
--   * Admin lock/delete + flag/report queue (resolver workflow)
--   * Barrier tags (free-text) + category tags (enum) so posts are findable
--   * Search-friendly indexes (trigram on title/body, btree on activity)
--
-- Idempotent. Run once in the Supabase SQL editor.

-- pg_trgm is already enabled for the rest of ServiceHub (resources search). Be
-- defensive — CREATE EXTENSION IF NOT EXISTS is a no-op when already present.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- 1. COMMUNITY PROFILE  (one row per user who opts in)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_profiles (
    user_id            UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    pseudonym          TEXT NOT NULL UNIQUE,
    bio                TEXT,
    avatar_url         TEXT,
    is_public          BOOLEAN NOT NULL DEFAULT TRUE,
    -- Per-section visibility, only honored when is_public = TRUE.
    show_posts         BOOLEAN NOT NULL DEFAULT TRUE,
    show_answers      BOOLEAN NOT NULL DEFAULT TRUE,
    show_paths         BOOLEAN NOT NULL DEFAULT FALSE,
    show_tasks         BOOLEAN NOT NULL DEFAULT FALSE,
    show_calendar      BOOLEAN NOT NULL DEFAULT FALSE,
    -- Karma cache: maintained by triggers below. Computing on every read is
    -- too expensive once the platform scales.
    karma              INTEGER NOT NULL DEFAULT 0,
    -- Status flags.
    is_suspended       BOOLEAN NOT NULL DEFAULT FALSE,
    suspended_reason   TEXT,
    suspended_until    TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_profiles_karma_idx
    ON public.community_profiles(karma DESC);
CREATE INDEX IF NOT EXISTS community_profiles_pseudonym_lower_idx
    ON public.community_profiles(lower(pseudonym));

ALTER TABLE public.community_profiles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. POSTS  (the question / problem)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_posts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title              TEXT NOT NULL CHECK (length(title) BETWEEN 8 AND 250),
    body_markdown      TEXT NOT NULL CHECK (length(body_markdown) BETWEEN 20 AND 30000),
    -- Tags: free-text barriers + curated categories. Both arrays so a post
    -- can match multiple search filters.
    barrier_tags       TEXT[] NOT NULL DEFAULT '{}',
    category_tags      TEXT[] NOT NULL DEFAULT '{}',
    -- Image URLs uploaded via the existing /api/community/storage/upload route.
    image_urls         TEXT[] NOT NULL DEFAULT '{}',
    -- Vote / activity cache: maintained by triggers below.
    upvotes            INTEGER NOT NULL DEFAULT 0,
    downvotes          INTEGER NOT NULL DEFAULT 0,
    score              INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,
    answer_count       INTEGER NOT NULL DEFAULT 0,
    view_count         INTEGER NOT NULL DEFAULT 0,
    -- "Solved" workflow: only set when an answer is accepted. Both fields are
    -- mandatory when accepted_answer_id is non-null (enforced via CHECK).
    accepted_answer_id UUID,
    solved_tldr        TEXT CHECK (length(solved_tldr) <= 600),
    solved_key_insight TEXT CHECK (length(solved_key_insight) <= 280),
    -- Admin moderation.
    is_locked          BOOLEAN NOT NULL DEFAULT FALSE,
    locked_reason      TEXT,
    locked_by          UUID REFERENCES public.profiles(id),
    locked_at          TIMESTAMPTZ,
    is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by         UUID REFERENCES public.profiles(id),
    deleted_at         TIMESTAMPTZ,
    -- Tracking.
    last_activity_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- "Solved" is all-or-nothing: if accepted, both TLDR + key_insight must
    -- be present and non-empty. This is the requirement from the spec.
    CONSTRAINT community_posts_solved_consistent CHECK (
        accepted_answer_id IS NULL
        OR (
            solved_tldr        IS NOT NULL AND length(trim(solved_tldr))        > 0
            AND solved_key_insight IS NOT NULL AND length(trim(solved_key_insight)) > 0
        )
    )
);

CREATE INDEX IF NOT EXISTS community_posts_author_idx
    ON public.community_posts(author_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_recent_idx
    ON public.community_posts(last_activity_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_top_idx
    ON public.community_posts(score DESC, last_activity_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_unanswered_idx
    ON public.community_posts(created_at DESC) WHERE answer_count = 0 AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_solved_idx
    ON public.community_posts(last_activity_at DESC)
    WHERE accepted_answer_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_barrier_tags_idx
    ON public.community_posts USING GIN(barrier_tags);
CREATE INDEX IF NOT EXISTS community_posts_category_tags_idx
    ON public.community_posts USING GIN(category_tags);
CREATE INDEX IF NOT EXISTS community_posts_title_trgm_idx
    ON public.community_posts USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS community_posts_body_trgm_idx
    ON public.community_posts USING GIN(body_markdown gin_trgm_ops);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. ANSWERS  (threaded — answers can reply to answers)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_answers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    -- Self-referential parent for threaded replies. NULL = top-level answer.
    parent_id       UUID REFERENCES public.community_answers(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body_markdown   TEXT NOT NULL CHECK (length(body_markdown) BETWEEN 10 AND 30000),
    image_urls      TEXT[] NOT NULL DEFAULT '{}',
    upvotes         INTEGER NOT NULL DEFAULT 0,
    downvotes       INTEGER NOT NULL DEFAULT 0,
    score           INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,
    -- Accepted = this answer was chosen as THE solution. There is exactly
    -- one accepted answer per post, enforced via the partial unique index
    -- below + the accepted_answer_id pointer on the post.
    is_accepted     BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_at     TIMESTAMPTZ,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by      UUID REFERENCES public.profiles(id),
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_answers_post_idx
    ON public.community_answers(post_id, created_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_answers_parent_idx
    ON public.community_answers(parent_id, created_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_answers_author_idx
    ON public.community_answers(author_id, created_at DESC) WHERE is_deleted = FALSE;
-- Only one accepted answer per post.
CREATE UNIQUE INDEX IF NOT EXISTS community_answers_one_accepted_per_post_idx
    ON public.community_answers(post_id) WHERE is_accepted = TRUE;

ALTER TABLE public.community_answers ENABLE ROW LEVEL SECURITY;

-- Now that community_answers exists, wire the post -> accepted_answer FK.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_accepted_answer_fk'
    ) THEN
        ALTER TABLE public.community_posts
            ADD CONSTRAINT community_posts_accepted_answer_fk
            FOREIGN KEY (accepted_answer_id)
            REFERENCES public.community_answers(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================================================
-- 4. VOTES  (one row per (user, target). target = post OR answer)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_votes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voter_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type  TEXT NOT NULL CHECK (target_type IN ('post', 'answer')),
    target_id    UUID NOT NULL,
    value        SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A given user has at most one vote per target.
    UNIQUE(voter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS community_votes_target_idx
    ON public.community_votes(target_type, target_id);

ALTER TABLE public.community_votes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. FOLLOWS  (one-way; follower -> followee, both must have profiles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_follows (
    follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    followee_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS community_follows_follower_idx
    ON public.community_follows(follower_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_follows_followee_idx
    ON public.community_follows(followee_id, created_at DESC);

ALTER TABLE public.community_follows ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. REPORTS  (flag queue for moderation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_reports (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type   TEXT NOT NULL CHECK (target_type IN ('post', 'answer', 'user')),
    target_id     UUID NOT NULL,
    reason        TEXT NOT NULL CHECK (length(reason) BETWEEN 5 AND 1000),
    status        TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'resolved_kept', 'resolved_removed', 'resolved_warned')),
    resolved_by   UUID REFERENCES public.profiles(id),
    resolution_note TEXT,
    resolved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A user can only report a given target once.
    UNIQUE(reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS community_reports_open_idx
    ON public.community_reports(created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS community_reports_target_idx
    ON public.community_reports(target_type, target_id);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 7. BADGES  (catalog + grants)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_badges (
    slug          TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL,
    icon          TEXT NOT NULL,
    tier          TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
    -- Threshold-based auto-award. NULL = admin grant only.
    auto_metric   TEXT,                       -- e.g. 'karma', 'posts', 'accepted'
    auto_threshold INTEGER
);

ALTER TABLE public.community_badges ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.community_badge_grants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_slug    TEXT NOT NULL REFERENCES public.community_badges(slug) ON DELETE CASCADE,
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by    UUID REFERENCES public.profiles(id),  -- NULL = auto-granted
    UNIQUE(user_id, badge_slug)
);

CREATE INDEX IF NOT EXISTS community_badge_grants_user_idx
    ON public.community_badge_grants(user_id, granted_at DESC);

ALTER TABLE public.community_badge_grants ENABLE ROW LEVEL SECURITY;

-- Seed the default badge catalog. Idempotent via ON CONFLICT DO NOTHING.
INSERT INTO public.community_badges (slug, name, description, icon, tier, auto_metric, auto_threshold) VALUES
    ('first_post',      'First Post',      'Posted your first question',          '✍️', 'bronze', 'posts',    1),
    ('helpful',         'Helpful',         'Reached 25 helpful points',           '🙌', 'bronze', 'karma',    25),
    ('problem_solver',  'Problem Solver',  'Had an answer accepted as solved',    '🧩', 'silver', 'accepted', 1),
    ('mentor',          'Mentor',          '10 of your answers were accepted',    '🎓', 'gold',   'accepted', 10),
    ('community_pillar','Community Pillar','Reached 1,000 helpful points',        '🏛️', 'gold',   'karma',    1000),
    ('streak_starter',  'Streak Starter',  'Posted on 3 consecutive days',        '🔥', 'bronze', NULL,       NULL)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 8. TRIGGER MAINTENANCE  (keep caches in sync without RPC round-trips)
-- =============================================================================

-- 8a. updated_at bump on every UPDATE to community_profiles.
CREATE OR REPLACE FUNCTION public._community_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_profiles_touch ON public.community_profiles;
CREATE TRIGGER community_profiles_touch
BEFORE UPDATE ON public.community_profiles
FOR EACH ROW EXECUTE FUNCTION public._community_touch_updated_at();

DROP TRIGGER IF EXISTS community_posts_touch ON public.community_posts;
CREATE TRIGGER community_posts_touch
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public._community_touch_updated_at();

DROP TRIGGER IF EXISTS community_answers_touch ON public.community_answers;
CREATE TRIGGER community_answers_touch
BEFORE UPDATE ON public.community_answers
FOR EACH ROW EXECUTE FUNCTION public._community_touch_updated_at();

-- 8b. Vote -> upvote/downvote caches on the target post or answer + karma
-- on the target's author.
CREATE OR REPLACE FUNCTION public._community_apply_vote()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    delta_up   INTEGER := 0;
    delta_down INTEGER := 0;
    delta_karma INTEGER := 0;
    target_author UUID;
BEGIN
    -- Compute deltas for INSERT / UPDATE / DELETE in one place.
    IF TG_OP = 'INSERT' THEN
        IF NEW.value = 1 THEN delta_up := 1; ELSE delta_down := 1; END IF;
        delta_karma := NEW.value;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.value = 1 THEN delta_up := -1; ELSE delta_down := -1; END IF;
        IF NEW.value = 1 THEN delta_up := delta_up + 1; ELSE delta_down := delta_down + 1; END IF;
        delta_karma := NEW.value - OLD.value;
    ELSE  -- DELETE
        IF OLD.value = 1 THEN delta_up := -1; ELSE delta_down := -1; END IF;
        delta_karma := -OLD.value;
    END IF;

    -- Apply to the target. Karma flows to the author of the target.
    IF (COALESCE(NEW.target_type, OLD.target_type)) = 'post' THEN
        UPDATE public.community_posts
           SET upvotes = upvotes + delta_up,
               downvotes = downvotes + delta_down,
               last_activity_at = now()
         WHERE id = COALESCE(NEW.target_id, OLD.target_id)
         RETURNING author_id INTO target_author;
    ELSE
        UPDATE public.community_answers
           SET upvotes = upvotes + delta_up,
               downvotes = downvotes + delta_down
         WHERE id = COALESCE(NEW.target_id, OLD.target_id)
         RETURNING author_id INTO target_author;
        -- Bubble activity up to the parent post.
        UPDATE public.community_posts
           SET last_activity_at = now()
         WHERE id = (
            SELECT post_id FROM public.community_answers
             WHERE id = COALESCE(NEW.target_id, OLD.target_id)
         );
    END IF;

    -- Karma update. Self-votes don't change karma (the voter == author case
    -- still passes through here, so we guard explicitly).
    IF target_author IS NOT NULL
       AND target_author <> COALESCE(NEW.voter_id, OLD.voter_id) THEN
        UPDATE public.community_profiles
           SET karma = karma + delta_karma
         WHERE user_id = target_author;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_votes_apply ON public.community_votes;
CREATE TRIGGER community_votes_apply
AFTER INSERT OR UPDATE OR DELETE ON public.community_votes
FOR EACH ROW EXECUTE FUNCTION public._community_apply_vote();

-- 8c. New answer -> bump answer_count + last_activity_at on the post.
CREATE OR REPLACE FUNCTION public._community_answer_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.community_posts
           SET answer_count = answer_count + 1,
               last_activity_at = now()
         WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
        UPDATE public.community_posts
           SET answer_count = GREATEST(answer_count - 1, 0)
         WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.community_posts
           SET answer_count = GREATEST(answer_count - 1, 0)
         WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_answers_count ON public.community_answers;
CREATE TRIGGER community_answers_count
AFTER INSERT OR UPDATE OR DELETE ON public.community_answers
FOR EACH ROW EXECUTE FUNCTION public._community_answer_change();

-- =============================================================================
-- 9. RPCs
-- =============================================================================

-- 9a. Accept an answer atomically. Marks the answer as accepted, clears any
-- prior accepted answer on the same post, sets the post's solved fields,
-- grants the karma bonus to the answer author, and grants the
-- problem_solver badge to both the asker (for accepting) and the answerer.
--
-- Solved metadata is MANDATORY — empty tldr/key_insight returns an error
-- so the spec's "Solved line" requirement can't be bypassed.
CREATE OR REPLACE FUNCTION public.community_accept_answer(
    p_post_id         UUID,
    p_answer_id       UUID,
    p_acting_user_id  UUID,
    p_tldr            TEXT,
    p_key_insight    TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_post_author    UUID;
    v_answer_author  UUID;
    v_answer_post_id UUID;
    v_is_admin       BOOLEAN;
BEGIN
    -- Validate solved metadata up front.
    IF p_tldr IS NULL OR length(trim(p_tldr)) = 0 THEN
        RAISE EXCEPTION 'Solved TLDR is required';
    END IF;
    IF p_key_insight IS NULL OR length(trim(p_key_insight)) = 0 THEN
        RAISE EXCEPTION 'Solved key insight is required';
    END IF;

    -- Load post + answer in a way that locks them for the duration of the txn.
    SELECT author_id INTO v_post_author
      FROM public.community_posts
     WHERE id = p_post_id AND is_deleted = FALSE
     FOR UPDATE;
    IF v_post_author IS NULL THEN
        RAISE EXCEPTION 'Post not found or deleted';
    END IF;

    SELECT author_id, post_id INTO v_answer_author, v_answer_post_id
      FROM public.community_answers
     WHERE id = p_answer_id AND is_deleted = FALSE
     FOR UPDATE;
    IF v_answer_author IS NULL OR v_answer_post_id <> p_post_id THEN
        RAISE EXCEPTION 'Answer not found, deleted, or does not belong to the post';
    END IF;

    -- Permission: post author OR admin.
    SELECT (role = 'admin') INTO v_is_admin
      FROM public.profiles WHERE id = p_acting_user_id;
    IF v_post_author <> p_acting_user_id AND COALESCE(v_is_admin, FALSE) = FALSE THEN
        RAISE EXCEPTION 'Only the post author or an admin can accept an answer';
    END IF;

    -- Clear any previously accepted answer on this post.
    UPDATE public.community_answers
       SET is_accepted = FALSE,
           accepted_at = NULL
     WHERE post_id = p_post_id AND is_accepted = TRUE AND id <> p_answer_id;

    -- Accept the new answer.
    UPDATE public.community_answers
       SET is_accepted = TRUE,
           accepted_at = now()
     WHERE id = p_answer_id;

    -- Stamp the post.
    UPDATE public.community_posts
       SET accepted_answer_id = p_answer_id,
           solved_tldr        = p_tldr,
           solved_key_insight = p_key_insight,
           last_activity_at   = now()
     WHERE id = p_post_id;

    -- Karma bonus for an accepted answer (StackOverflow convention: +15).
    IF v_answer_author <> v_post_author THEN
        UPDATE public.community_profiles
           SET karma = karma + 15
         WHERE user_id = v_answer_author;
    END IF;

    -- Auto-grant the problem_solver badge to the answerer (idempotent).
    INSERT INTO public.community_badge_grants (user_id, badge_slug, granted_by)
    VALUES (v_answer_author, 'problem_solver', NULL)
    ON CONFLICT (user_id, badge_slug) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_accept_answer(UUID, UUID, UUID, TEXT, TEXT) TO authenticated, service_role;

-- 9b. Cast or change a vote. Self-votes return without effect.
CREATE OR REPLACE FUNCTION public.community_cast_vote(
    p_voter_id     UUID,
    p_target_type  TEXT,
    p_target_id    UUID,
    p_value        SMALLINT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_author UUID;
BEGIN
    IF p_value NOT IN (-1, 0, 1) THEN
        RAISE EXCEPTION 'Vote value must be -1, 0, or 1';
    END IF;

    -- Identify the target author so we can block self-votes early.
    IF p_target_type = 'post' THEN
        SELECT author_id INTO v_target_author
          FROM public.community_posts WHERE id = p_target_id;
    ELSIF p_target_type = 'answer' THEN
        SELECT author_id INTO v_target_author
          FROM public.community_answers WHERE id = p_target_id;
    ELSE
        RAISE EXCEPTION 'Invalid target_type %', p_target_type;
    END IF;
    IF v_target_author IS NULL THEN
        RAISE EXCEPTION 'Vote target not found';
    END IF;
    IF v_target_author = p_voter_id THEN
        -- Silent no-op: self-votes are a UX dead-end, not an error.
        RETURN;
    END IF;

    -- Upsert: 0 = retract the vote, +/-1 = set it.
    IF p_value = 0 THEN
        DELETE FROM public.community_votes
         WHERE voter_id = p_voter_id
           AND target_type = p_target_type
           AND target_id = p_target_id;
    ELSE
        INSERT INTO public.community_votes (voter_id, target_type, target_id, value)
        VALUES (p_voter_id, p_target_type, p_target_id, p_value)
        ON CONFLICT (voter_id, target_type, target_id)
        DO UPDATE SET value = EXCLUDED.value, created_at = now();
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_cast_vote(UUID, TEXT, UUID, SMALLINT) TO authenticated, service_role;

-- 9c. Award badges whose threshold has been crossed. Called after big events
-- (post created, answer accepted, karma change). Cheap re-runs are fine.
CREATE OR REPLACE FUNCTION public.community_award_threshold_badges(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_karma     INTEGER;
    v_posts     INTEGER;
    v_accepted  INTEGER;
    v_awarded   INTEGER := 0;
    v_badge     RECORD;
BEGIN
    SELECT karma INTO v_karma FROM public.community_profiles WHERE user_id = p_user_id;
    IF v_karma IS NULL THEN
        RETURN 0;
    END IF;
    SELECT COUNT(*) INTO v_posts FROM public.community_posts
     WHERE author_id = p_user_id AND is_deleted = FALSE;
    SELECT COUNT(*) INTO v_accepted FROM public.community_answers
     WHERE author_id = p_user_id AND is_accepted = TRUE AND is_deleted = FALSE;

    FOR v_badge IN
        SELECT slug, auto_metric, auto_threshold
          FROM public.community_badges
         WHERE auto_metric IS NOT NULL
           AND auto_threshold IS NOT NULL
    LOOP
        IF (v_badge.auto_metric = 'karma'    AND v_karma    >= v_badge.auto_threshold)
        OR (v_badge.auto_metric = 'posts'    AND v_posts    >= v_badge.auto_threshold)
        OR (v_badge.auto_metric = 'accepted' AND v_accepted >= v_badge.auto_threshold)
        THEN
            INSERT INTO public.community_badge_grants (user_id, badge_slug, granted_by)
            VALUES (p_user_id, v_badge.slug, NULL)
            ON CONFLICT (user_id, badge_slug) DO NOTHING;
            IF FOUND THEN
                v_awarded := v_awarded + 1;
            END IF;
        END IF;
    END LOOP;
    RETURN v_awarded;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_award_threshold_badges(UUID) TO authenticated, service_role;

-- =============================================================================
-- 10. RLS policies
--
-- Anonymous users can read public surfaces (feed + non-deleted posts/answers).
-- Authenticated users can read all and write their own. Service-role bypasses
-- RLS as always.
-- =============================================================================

-- Posts: anyone can SELECT non-deleted; only the author can UPDATE/DELETE
-- their own. Admin operations go through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS community_posts_select  ON public.community_posts;
CREATE POLICY community_posts_select  ON public.community_posts
    FOR SELECT USING (is_deleted = FALSE);

DROP POLICY IF EXISTS community_posts_insert  ON public.community_posts;
CREATE POLICY community_posts_insert  ON public.community_posts
    FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS community_posts_update  ON public.community_posts;
CREATE POLICY community_posts_update  ON public.community_posts
    FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- Answers — same shape as posts.
DROP POLICY IF EXISTS community_answers_select  ON public.community_answers;
CREATE POLICY community_answers_select  ON public.community_answers
    FOR SELECT USING (is_deleted = FALSE);

DROP POLICY IF EXISTS community_answers_insert  ON public.community_answers;
CREATE POLICY community_answers_insert  ON public.community_answers
    FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS community_answers_update  ON public.community_answers;
CREATE POLICY community_answers_update  ON public.community_answers
    FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- Votes: a user reads + writes their own only.
DROP POLICY IF EXISTS community_votes_owner  ON public.community_votes;
CREATE POLICY community_votes_owner  ON public.community_votes
    FOR ALL USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);

-- Follows: public who-follows-whom; only the follower can write their own row.
DROP POLICY IF EXISTS community_follows_select  ON public.community_follows;
CREATE POLICY community_follows_select  ON public.community_follows
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS community_follows_write  ON public.community_follows;
CREATE POLICY community_follows_write  ON public.community_follows
    FOR ALL USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

-- Profiles: anyone reads public profiles; the owner reads/writes their own.
DROP POLICY IF EXISTS community_profiles_select  ON public.community_profiles;
CREATE POLICY community_profiles_select  ON public.community_profiles
    FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);

DROP POLICY IF EXISTS community_profiles_owner  ON public.community_profiles;
CREATE POLICY community_profiles_owner  ON public.community_profiles
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reports: only the reporter sees their own report; service-role / admin
-- routes use the admin client (which bypasses RLS) for the moderation queue.
DROP POLICY IF EXISTS community_reports_owner  ON public.community_reports;
CREATE POLICY community_reports_owner  ON public.community_reports
    FOR ALL USING (auth.uid() = reporter_id) WITH CHECK (auth.uid() = reporter_id);

-- Badges + grants: world-readable.
DROP POLICY IF EXISTS community_badges_read  ON public.community_badges;
CREATE POLICY community_badges_read  ON public.community_badges
    FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS community_badge_grants_read  ON public.community_badge_grants;
CREATE POLICY community_badge_grants_read  ON public.community_badge_grants
    FOR SELECT USING (TRUE);

COMMENT ON TABLE public.community_profiles IS
    'Opt-in community identity layer. Pseudonym always shown — never real name. Per-section visibility honored when is_public = TRUE.';
COMMENT ON TABLE public.community_posts IS
    'Tidbits posts (questions/problems). solved_tldr + solved_key_insight are mandatory when accepted_answer_id is set.';
COMMENT ON TABLE public.community_answers IS
    'Threaded answers. Self-referential parent_id allows replies-to-replies. Exactly one accepted answer per post.';
COMMENT ON FUNCTION public.community_accept_answer(UUID, UUID, UUID, TEXT, TEXT) IS
    'Atomically accept an answer + set the post-level Solved line (TLDR + key insight). Rejects empty solved metadata.';


-- ==========================================================================
-- STEP 10 — servicehub-mvp/scripts/2026_post_unlocking_moment.sql
-- ==========================================================================

-- Author-highlighted "unlocking moment" on community posts (Odosa).
--
-- The key sentence / turning point of the story — what unlocked it for the
-- author. Distinct from the solved-answer fields (solved_tldr /
-- solved_key_insight), which only apply when an answer is accepted. Optional,
-- author-set. Run once against the shared Supabase project. Idempotent.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS unlocking_moment TEXT
    CHECK (unlocking_moment IS NULL OR length(unlocking_moment) <= 280);


-- ==========================================================================
-- STEP 11 — servicehub-mvp/scripts/2026_post_what_didnt_work.sql
-- ==========================================================================

-- Author-highlighted "what didn't work" on community posts (Odosa).
--
-- The complement to unlocking_moment: things the author tried that did NOT
-- work, so readers can skip the dead ends. Optional, author-set, <=280 chars.
-- Run once against the shared Supabase project. Idempotent.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS what_didnt_work TEXT
    CHECK (what_didnt_work IS NULL OR length(what_didnt_work) <= 280);


-- ==========================================================================
-- STEP 12 — servicehub-mvp/scripts/2026_rating_diagnostics.sql
-- ==========================================================================

-- Rater diagnostics on ratings — enables the nested Rating Breakdown (Odosa).
--
-- Denormalizes the RATER's own diagnostic features + severities onto their
-- rating (a map { barrier_type: severity 1-5 }, e.g. {"autism": 3, "adhd": 2}).
-- This lets us break area ratings (sensory, mobility…) down by diagnostic
-- feature + level WITHOUT reading other users' diagnostic profiles (blocked by
-- RLS). Set from the rater's own user_barriers at rating time.
--
-- Run once against the shared Supabase project. Idempotent.

ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS rater_diagnostics JSONB NOT NULL DEFAULT '{}';


-- ==========================================================================
-- STEP 13 — servicehub-mvp/scripts/2026_rater_trust.sql
-- ==========================================================================

-- ============================================================================
-- Rater trust & norm verification (Odosa).
--
-- Goal: make the norm-level rating breakdown ("rated by people with Autism
-- Level 3") trustworthy, WITHOUT collecting medical records.
--
-- Deliberately NOT storing diagnosis documents. Doing so would make us a
-- custodian of health information (PHIPA / PIPEDA / HIPAA / GDPR special
-- category) and would exclude self-diagnosed and undiagnosed people — who are
-- disproportionately the users this product exists to serve.
--
-- Instead:
--   1. Every norm carries an explicit verification_method, defaulting to
--      'self' (self-identified). This is shown honestly in the UI.
--   2. Trust is earned from real behaviour — rating volume, helpfulness,
--      community karma — computed by rater_trust() below.
--
-- Forward-compatible: professional attestation (phase 2) simply sets
-- verification_method='professional' + verified_at + verifier_type. Only that
-- metadata is ever stored — never the document, never diagnosis details.
--
-- Idempotent. Run once against the shared Supabase project.
-- ============================================================================

ALTER TABLE public.user_barriers
  ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'self'
    CHECK (verification_method IN ('self', 'peer', 'professional')),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  -- e.g. 'clinician', 'support_worker', 'educator'. Never the person's name,
  -- never the diagnosis, never the document.
  ADD COLUMN IF NOT EXISTS verifier_type TEXT;

CREATE INDEX IF NOT EXISTS user_barriers_verification_idx
  ON public.user_barriers (user_id, verification_method);

-- ---- Rater trust ------------------------------------------------------------
-- A rater's trust tier, derived entirely from behaviour we already record.
--   ratings_count  — how many resources they've rated
--   helpful_total  — total "helpful" marks their ratings received
--   karma          — community reputation (0 when they never opted in)
--
-- tier: 'new' | 'contributing' | 'trusted' | 'established'
CREATE OR REPLACE FUNCTION public.rater_trust(p_user_id UUID)
RETURNS TABLE (
  ratings_count INTEGER,
  helpful_total INTEGER,
  karma         INTEGER,
  tier          TEXT
)
LANGUAGE sql
STABLE
AS $$
  WITH r AS (
    SELECT
      COUNT(*)::INT                        AS ratings_count,
      COALESCE(SUM(helpful_count), 0)::INT AS helpful_total
    FROM public.ratings
    WHERE user_id = p_user_id
  ),
  k AS (
    SELECT COALESCE(
      (SELECT cp.karma FROM public.community_profiles cp WHERE cp.user_id = p_user_id),
      0
    )::INT AS karma
  )
  SELECT
    r.ratings_count,
    r.helpful_total,
    k.karma,
    CASE
      WHEN r.ratings_count >= 15 AND r.helpful_total >= 20 THEN 'established'
      WHEN r.ratings_count >= 5  AND r.helpful_total >= 5  THEN 'trusted'
      WHEN r.ratings_count >= 1                            THEN 'contributing'
      ELSE 'new'
    END AS tier
  FROM r, k;
$$;

GRANT EXECUTE ON FUNCTION public.rater_trust(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.rater_trust(UUID) IS
  'Behaviour-derived rater trust tier. No medical data involved.';


-- ==========================================================================
-- STEP 14 — servicehub-mvp/scripts/2026_relationship_weighting.sql
-- ==========================================================================

-- ============================================================================
-- Relationship weighting: whose experience is this? (Odosa)
--
-- The identification problem, stated honestly: we cannot reliably PROVE that
-- someone is autistic, a visible minority, queer, or low-income. Documents are
-- forgeable (and now trivially so with AI image editing), facial recognition is
-- both defeatable and wildly inappropriate for these categories, and demanding
-- proof would exclude exactly the people this product exists for — the
-- undiagnosed, the self-diagnosed, and anyone for whom assessment is
-- unaffordable or unsafe.
--
-- So we stop trying to verify IDENTITY and instead make RELATIONSHIP explicit,
-- then weight by it. A rating from someone with lived experience of a norm
-- counts for more than one from a parent, which counts for more than one from
-- a professional who works with them, which counts for more than an ally.
-- Nobody is silenced; the signal is just weighted honestly and shown openly.
--
-- Tiers (Odosa's framing: members > direct support > indirect > allies):
--   lived            1.00  I have this norm
--   direct_support   0.60  parent, sibling, partner — shares daily life
--   indirect_support 0.35  educator, therapist, employer, researcher
--   ally             0.15  supporter with no direct connection
--
-- Goal Planning onboarding ALREADY asks this (connectionTypes: self / parent /
-- sibling / educator / employer / therapist / researcher / ally) but discarded
-- the per-norm answer. This gives it somewhere to live.
--
-- Idempotent. Applies to ratings and to Tidbits.
-- ============================================================================

-- ---- Per-norm relationship ---------------------------------------------------
ALTER TABLE public.user_barriers
  ADD COLUMN IF NOT EXISTS relationship TEXT NOT NULL DEFAULT 'lived'
    CHECK (relationship IN ('lived', 'direct_support', 'indirect_support', 'ally'));

CREATE INDEX IF NOT EXISTS user_barriers_relationship_idx
  ON public.user_barriers (user_id, relationship);

COMMENT ON COLUMN public.user_barriers.relationship IS
  'How this person relates to the norm: lived experience, direct support (family), indirect support (professional), or ally. Drives rating weight.';

-- ---- Snapshot on ratings -----------------------------------------------------
-- Same denormalisation pattern as rater_diagnostics / rater_org_ids: RLS blocks
-- reading other raters' profiles, so the relationship is captured at write time.
ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS rater_relationships JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.ratings.rater_relationships IS
  'Snapshot of { barrier_type: relationship } for the rater at rating time. Powers weighted averages without cross-user reads.';

-- ---- Weight lookup -----------------------------------------------------------
-- Kept in SQL as well as TS so reports/queries can weight consistently.
CREATE OR REPLACE FUNCTION public.relationship_weight(p_relationship TEXT)
RETURNS REAL
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_relationship
    WHEN 'lived'            THEN 1.00
    WHEN 'direct_support'   THEN 0.60
    WHEN 'indirect_support' THEN 0.35
    WHEN 'ally'             THEN 0.15
    ELSE 1.00   -- unknown/legacy rows are treated as lived, matching the default
  END::REAL;
$$;

GRANT EXECUTE ON FUNCTION public.relationship_weight(TEXT) TO authenticated, service_role;


-- ==========================================================================
-- STEP 15 — servicehub-mvp/scripts/2026_relationship_declared.sql
-- ==========================================================================

-- ============================================================================
-- Relationship declaration flag (Odosa follow-up).
--
-- relationship defaults to 'lived', which is the safe default for weighting —
-- it never silently demotes anyone. But it makes "I declared lived experience"
-- indistinguishable from "nobody ever asked me", so the badge would claim
-- lived experience for people who never said so.
--
-- This flag separates the two:
--   relationship_declared = FALSE  never asked  -> no badge, weight 1.0 (safe)
--   relationship_declared = TRUE   user chose   -> badge shown, weight applied
--
-- Existing rows are FALSE: nobody is retroactively credited with a claim they
-- didn't make.
--
-- Idempotent. Requires 2026_relationship_weighting.sql.
-- ============================================================================

ALTER TABLE public.user_barriers
  ADD COLUMN IF NOT EXISTS relationship_declared BOOLEAN NOT NULL DEFAULT FALSE;

-- Onboarding answers ARE a declaration, so backfill anyone who picked a
-- non-default relationship — only 'lived' is ambiguous with the column default.
UPDATE public.user_barriers
   SET relationship_declared = TRUE
 WHERE relationship IS NOT NULL
   AND relationship <> 'lived'
   AND relationship_declared = FALSE;

CREATE INDEX IF NOT EXISTS user_barriers_relationship_declared_idx
  ON public.user_barriers (user_id, relationship_declared);

COMMENT ON COLUMN public.user_barriers.relationship_declared IS
  'TRUE only when the person explicitly chose their relationship. Undeclared rows show no badge and are weighted as lived (safe default).';


-- ==========================================================================
-- STEP 16 — servicehub-mvp/scripts/2026_tidbits_relationship.sql
-- ==========================================================================

-- ============================================================================
-- Tidbits relationship weighting (Odosa).
--
-- The same question as ratings: whose experience is this? A "solved" answer
-- from someone who lives with the norm should outrank one from an ally who
-- read about it — while still letting allies contribute.
--
-- Two columns, because posts/answers need both display AND ordering:
--   author_relationships  full { barrier_type: relationship } map, for the badge
--   author_weight         the author's STRONGEST tie (0.15-1.00), for ranking
--
-- Snapshotted at write time, like ratings.rater_relationships — RLS blocks
-- reading other users' profiles at render time. It also means an answer keeps
-- the standing its author had when they wrote it.
--
-- Idempotent. Requires 2026_community_tidbits.sql + 2026_relationship_weighting.sql.
-- ============================================================================

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS author_relationships JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS author_weight REAL NOT NULL DEFAULT 1.0;

ALTER TABLE public.community_answers
  ADD COLUMN IF NOT EXISTS author_relationships JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS author_weight REAL NOT NULL DEFAULT 1.0;

-- Ranking index: accepted answers first, then lived experience, then score.
CREATE INDEX IF NOT EXISTS community_answers_weighted_rank_idx
  ON public.community_answers (post_id, is_accepted DESC, author_weight DESC, score DESC)
  WHERE is_deleted = FALSE;

COMMENT ON COLUMN public.community_answers.author_weight IS
  'Author''s strongest relationship tie at write time (lived 1.0 → ally 0.15). Ranks answers; never hides them.';


-- ==========================================================================
-- STEP 17 — servicehub-mvp/scripts/2026_organizations.sql
-- ==========================================================================

-- ============================================================================
-- Organizations & org-backed vouching (Odosa).
--
-- The insight: peer vouching scales through ORGANISATIONS, not individuals.
-- A leader at a community org (e.g. an autism coalition) vouches for their
-- members' norms. That is a far stronger signal than an anonymous peer, needs
-- no medical records, and gives community groups a concrete reason to partner:
-- they bring their members and become the trust anchor for them.
--
-- Still no health data: vouching records WHO vouched (an org) and WHEN —
-- never a diagnosis, never a document.
--
-- Idempotent. Requires 2026_rater_trust.sql (verification_method).
-- ============================================================================

-- ---- Organisations -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  website     TEXT,
  logo_url    TEXT,
  -- Set by app admins once a partnership is real. Only verified orgs confer
  -- an "Organisation-verified" badge, so a self-made org can't mint trust.
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  -- Rotatable join code. NULL disables self-join (invite-only).
  join_code   TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizations_verified_idx ON public.organizations (is_verified);

-- ---- Membership --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  org_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'leader' can vouch for members and manage membership. 'member' cannot.
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_members_user_idx ON public.organization_members (user_id);
CREATE INDEX IF NOT EXISTS organization_members_leader_idx
  ON public.organization_members (org_id, role);

-- ---- Extend verification with 'organization' ---------------------------------
-- The CHECK from 2026_rater_trust.sql only allowed self/peer/professional.
-- Replace it rather than assuming a constraint name.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.user_barriers'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%verification_method%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_barriers DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.user_barriers
    ADD CONSTRAINT user_barriers_verification_method_check
    CHECK (verification_method IN ('self', 'peer', 'organization', 'professional'));
END $$;

-- Which org vouched (only meaningful when verification_method='organization').
ALTER TABLE public.user_barriers
  ADD COLUMN IF NOT EXISTS verified_by_org_id UUID
    REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_barriers_org_idx
  ON public.user_barriers (verified_by_org_id);

-- ---- RLS ---------------------------------------------------------------------
ALTER TABLE public.organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Orgs are a public directory, but the join_code must never be readable by
-- anyone except leaders — so the API selects explicit columns and this policy
-- is paired with column selection in code, never `select *` for anon.
DROP POLICY IF EXISTS organizations_read ON public.organizations;
CREATE POLICY organizations_read ON public.organizations
  FOR SELECT USING (true);

-- A user sees membership rows for orgs they belong to.
DROP POLICY IF EXISTS organization_members_read ON public.organization_members;
CREATE POLICY organization_members_read ON public.organization_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
       WHERE m.org_id = organization_members.org_id
         AND m.user_id = auth.uid()
    )
  );

-- Joining / vouching / role changes all go through the service-role API where
-- the rules are enforced, so no INSERT/UPDATE policies here.

COMMENT ON TABLE public.organizations IS
  'Community organisations that can vouch for their members. is_verified is set by app admins when a partnership is real.';
COMMENT ON TABLE public.organization_members IS
  'Org membership. Leaders can vouch for members norms — recording the org and date only, never a diagnosis or document.';


-- ==========================================================================
-- STEP 18 — servicehub-mvp/scripts/2026_rating_groups.sql
-- ==========================================================================

-- ============================================================================
-- Rating groups: "how <organisation>'s members rate this resource" (Odosa).
--
-- The payoff of organisations — an org's members often trust their own
-- community's ratings most. Same shape as the norm x level breakdown.
--
-- Why denormalise: RLS on organization_members only lets you see rows for orgs
-- YOU belong to, so we can't read other raters' memberships at read time.
-- Instead we snapshot the rater's org ids onto their rating when it's written
-- — exactly the pattern already used by ratings.rater_diagnostics.
--
-- Snapshot semantics are a feature, not a bug: the rating reflects who the
-- person was affiliated with WHEN they rated. Leaving an org later doesn't
-- rewrite history.
--
-- Idempotent. Requires 2026_organizations.sql.
-- ============================================================================

ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS rater_org_ids UUID[] NOT NULL DEFAULT '{}';

-- GIN so "ratings from members of org X" stays fast as volume grows.
CREATE INDEX IF NOT EXISTS ratings_rater_org_ids_idx
  ON public.ratings USING GIN (rater_org_ids);

COMMENT ON COLUMN public.ratings.rater_org_ids IS
  'Snapshot of the rater''s organisation ids at rating time. Powers the per-organisation rating breakdown without cross-user reads.';


-- ==========================================================================
-- STEP 19 — servicehub-mvp/scripts/2026_professional_verification.sql
-- ==========================================================================

-- ============================================================================
-- Professional attestation — phase 2 of norm verification (Odosa).
--
-- A clinician / support worker confirms a person's norm via a ONE-TIME LINK.
--
-- WHAT WE STORE:  verification_method='professional', verified_at, verifier_type
-- WHAT WE NEVER STORE: the diagnosis, any document, any file upload, the
--   verifier's name or credentials, or free-text clinical notes.
-- There is deliberately no upload path anywhere in this feature, so we never
-- become a custodian of health records (PHIPA / PIPEDA / HIPAA / GDPR).
--
-- Security model:
--   * The link contains a 32-byte random token. Only its SHA-256 hash is
--     stored, so a database leak cannot be used to forge a verification.
--   * Single use — completing a request marks it 'completed'.
--   * Expires (default 14 days).
--   * The verifier needs no account; the page is public but useless without
--     the token, and tokens are not enumerable.
--
-- Idempotent. Run once. Requires 2026_rater_trust.sql (verification_method).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.norm_verification_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Which norm is being attested (matches user_barriers.barrier_type).
  barrier_type  TEXT NOT NULL,
  -- SHA-256 of the one-time token. The raw token is shown to the user once
  -- and never persisted.
  token_hash    TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'expired', 'revoked')),
  -- Set on completion. A ROLE only — never a name, licence number, or notes.
  verifier_type TEXT CHECK (
    verifier_type IS NULL
    OR verifier_type IN ('clinician', 'support_worker', 'educator')
  ),
  completed_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS norm_verification_user_idx
  ON public.norm_verification_requests (user_id, status);

ALTER TABLE public.norm_verification_requests ENABLE ROW LEVEL SECURITY;

-- The requester can see and revoke their own requests. Token lookup and
-- completion go through the service-role API (which bypasses RLS), so the
-- public verifier page never needs a policy here.
DROP POLICY IF EXISTS norm_verification_own_select ON public.norm_verification_requests;
CREATE POLICY norm_verification_own_select ON public.norm_verification_requests
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS norm_verification_own_update ON public.norm_verification_requests;
CREATE POLICY norm_verification_own_update ON public.norm_verification_requests
  FOR UPDATE USING (user_id = auth.uid());

COMMENT ON TABLE public.norm_verification_requests IS
  'One-time professional attestation links. Stores only a hashed token and a verifier ROLE — never documents, diagnoses, or verifier identities.';


-- ==========================================================================
-- STEP 20 — servicehub-mvp/scripts/2026_shop_products.sql
-- ==========================================================================

-- ============================================================================
-- Shop: a real products catalog + commerce flow (Odosa).
--
-- Distinct from `resources` (services/places): purchasable goods — clothes,
-- books, toys, self-care, etc. — with images, variations, sensory details,
-- and an in-app cart → Stripe checkout → orders → returns → reviews flow.
-- No hardcoded/seeded products: the catalog is populated only by real
-- submissions. Stripe is wired later and gated on STRIPE_SECRET_KEY.
--
-- Idempotent. Run once against the shared Supabase project.
-- ============================================================================

-- ---- Catalog -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,                    -- food, toys, clothing, self-care, crafts, supplies, books, …
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  compare_at_price DECIMAL(10, 2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  currency TEXT NOT NULL DEFAULT 'CAD',
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  -- [{ "name": "Size", "options": ["S","M","L"] }, { "name": "Color", "options": ["Black"] }]
  variations JSONB NOT NULL DEFAULT '[]',
  -- { "texture": "Soft", "sound": "None", "visual": "Dark Colored", "material": "Rubber" }
  sensory_details JSONB NOT NULL DEFAULT '{}',
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),   -- NULL = not tracked / unlimited
  seller TEXT,
  status TEXT NOT NULL DEFAULT 'active',      -- 'draft' | 'active' | 'archived'
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products(category);
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products(status);

-- ---- Cart --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- selected variation, e.g. { "Size": "M", "Color": "Black" }
  variation JSONB NOT NULL DEFAULT '{}',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- one row per (user, product, exact variation) so quantities merge cleanly
  UNIQUE (user_id, product_id, variation)
);
CREATE INDEX IF NOT EXISTS cart_items_user_idx ON public.cart_items(user_id);

-- ---- Orders ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing',  -- processing | shipped | delivered | cancelled | returned
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  taxes DECIMAL(10, 2) NOT NULL DEFAULT 0,
  delivery DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  shipping_address JSONB,
  payment_method TEXT,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders(user_id);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  -- snapshot of the product at purchase time (name/price/image can change later)
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  variation JSONB NOT NULL DEFAULT '{}',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);

-- ---- Returns -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'return_started', -- return_started | dropped_off | received | refunded
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_returns_user_idx ON public.order_returns(user_id);

-- ---- Product reviews ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS product_reviews_product_idx ON public.product_reviews(product_id);

-- ---- RLS ---------------------------------------------------------------------
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_returns    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews  ENABLE ROW LEVEL SECURITY;

-- Products: anyone can read active products; authenticated users can submit;
-- authors can edit their own.
DROP POLICY IF EXISTS products_read ON public.products;
CREATE POLICY products_read ON public.products
  FOR SELECT USING (status = 'active' OR submitted_by = auth.uid());
DROP POLICY IF EXISTS products_insert ON public.products;
CREATE POLICY products_insert ON public.products
  FOR INSERT WITH CHECK (submitted_by = auth.uid());
DROP POLICY IF EXISTS products_update ON public.products;
CREATE POLICY products_update ON public.products
  FOR UPDATE USING (submitted_by = auth.uid());

-- Cart / orders / returns / reviews: owner-scoped.
DROP POLICY IF EXISTS cart_owner ON public.cart_items;
CREATE POLICY cart_owner ON public.cart_items
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS orders_owner ON public.orders;
CREATE POLICY orders_owner ON public.orders
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS order_items_owner ON public.order_items;
CREATE POLICY order_items_owner ON public.order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

DROP POLICY IF EXISTS returns_owner ON public.order_returns;
CREATE POLICY returns_owner ON public.order_returns
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Product reviews: world-readable, owner-writable.
DROP POLICY IF EXISTS product_reviews_read ON public.product_reviews;
CREATE POLICY product_reviews_read ON public.product_reviews
  FOR SELECT USING (true);
DROP POLICY IF EXISTS product_reviews_write ON public.product_reviews;
CREATE POLICY product_reviews_write ON public.product_reviews
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ==========================================================================
-- STEP 21 — backend/database/migrations/2026_generation_jobs.sql
-- ==========================================================================

-- ============================================================================
-- Async path generation jobs.
--
-- Path generation takes ~55s alone and ~160s with five people going at once.
-- Holding an HTTP connection open for that long is what actually caps
-- concurrency: a request ties up a worker for the whole run, the client has to
-- pick a timeout long enough for the worst case, and a dropped connection
-- loses work that already completed. Raising the timeout treats the symptom.
--
-- This table decouples the two. POST enqueues and returns immediately; a
-- background worker runs the pipeline and writes the outcome here; the client
-- polls. Concurrency becomes a function of worker capacity rather than of how
-- long a browser is willing to wait, and a disconnected client can pick its
-- job back up.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  -- The onboarding request, kept so a job can be retried without the client
  -- having to resubmit anything.
  request       JSONB NOT NULL DEFAULT '{}',
  -- Set on success. The generated path lands in user_paths as before; this is
  -- the pointer to it.
  path_id       TEXT,
  -- Set on failure. A message safe to show a user, never a raw traceback.
  error         TEXT,
  -- Coarse progress for the waiting UI. The pipeline cannot report true
  -- percentage, so this is a stage label, not a number.
  stage         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

-- "What is my latest job?" — the only query the client makes.
CREATE INDEX IF NOT EXISTS generation_jobs_user_idx
  ON public.generation_jobs (user_id, created_at DESC);

-- Reaper support: find jobs that started but never finished. A process restart
-- mid-run would otherwise leave a job 'running' forever and the user watching
-- a spinner with nothing behind it.
CREATE INDEX IF NOT EXISTS generation_jobs_stale_idx
  ON public.generation_jobs (started_at)
  WHERE status = 'running';

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

-- A user may read their own jobs. Writes go through the service-role API,
-- which is the only thing allowed to move a job between states.
DROP POLICY IF EXISTS generation_jobs_read_own ON public.generation_jobs;
CREATE POLICY generation_jobs_read_own ON public.generation_jobs
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE public.generation_jobs IS
  'Async path-generation jobs. Decouples the ~55s pipeline from the HTTP request so concurrency is bounded by worker capacity, not by client timeouts.';

-- ==========================================================================
-- STEP 22 — backend/database/migrations/2026_social_tables_repoint.sql
-- ==========================================================================

-- ============================================================================
-- Repoint memes / messages / video_calls at public.profiles.
--
-- These three tables carry foreign keys to public.users — a legacy table from
-- the original Postgres schema that has ZERO rows in production, while
-- public.profiles (which mirrors auth.users) has every real account.
--
-- So the social features had two independent faults, and fixing either alone
-- would have left them broken:
--   1. the routes connected to localhost instead of Supabase (fixed in code)
--   2. every insert violated a foreign key into an empty table (this file)
--
-- The old code papered over (2) with a get_or_create_user() function that
-- inserted a row into public.users for whatever identifier arrived — including
-- the frontend's literal 'demo_user' fallback. That is why the constraint was
-- never noticed: the app minted a phantom account rather than failing.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- Drop whatever FK currently points each column at public.users, without
-- assuming a constraint name.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname, rel.relname AS tbl
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_class ref ON ref.oid = con.confrelid
     WHERE con.contype = 'f'
       AND ref.relname = 'users'
       AND rel.relname IN ('memes', 'meme_likes', 'messages', 'video_calls', 'connections')
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', c.tbl, c.conname);
    RAISE NOTICE 'dropped % on %', c.conname, c.tbl;
  END LOOP;
END $$;

-- Re-add them against profiles. ON DELETE CASCADE so removing an account takes
-- its social content with it rather than leaving orphans.
DO $$
BEGIN
  IF to_regclass('public.memes') IS NOT NULL THEN
    ALTER TABLE public.memes
      ADD CONSTRAINT memes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.meme_likes') IS NOT NULL THEN
    ALTER TABLE public.meme_likes
      ADD CONSTRAINT meme_likes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.video_calls') IS NOT NULL THEN
    ALTER TABLE public.video_calls
      ADD CONSTRAINT video_calls_caller_id_fkey
      FOREIGN KEY (caller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.video_calls
      ADD CONSTRAINT video_calls_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.connections') IS NOT NULL THEN
    ALTER TABLE public.connections
      ADD CONSTRAINT connections_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.connections
      ADD CONSTRAINT connections_connected_user_id_fkey
      FOREIGN KEY (connected_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'constraints already point at profiles — nothing to do';
END $$;

COMMENT ON TABLE public.memes IS
  'Meme sharing between connected users. FKs point at public.profiles, not the empty legacy public.users.';

-- ==========================================================================
-- STEP 23 — servicehub-mvp/scripts/2026_product_review_breakdown.sql
-- ==========================================================================

-- ============================================================================
-- Give product reviews the same depth as service ratings (Odosa).
--
-- "Add rating breakdown & community reviews & pattern insights & 'Based on
-- those who matched your Diagnostics profile' from services here."
--
-- public.ratings already carries a snapshot of who the rater was at rating
-- time — their diagnostics, their relationship to each norm, their
-- organisations. That snapshot is what makes the nested breakdown possible at
-- all: RLS blocks reading another user's profile at render time, so the facts
-- have to be written down when the rating is made.
--
-- product_reviews had none of it — only (rating, comment). These columns mirror
-- ratings exactly so the same breakdown component can render for a product.
--
-- Idempotent. Requires 2026_shop_products.sql.
-- ============================================================================

ALTER TABLE public.product_reviews
  -- { barrier_type: severity 1-5 } for the reviewer, e.g. {"autism": 3}
  ADD COLUMN IF NOT EXISTS rater_diagnostics JSONB NOT NULL DEFAULT '{}',
  -- { barrier_type: 'lived' | 'direct_support' | 'indirect_support' | 'ally' }
  -- Only DECLARED relationships are recorded, so an undeclared reviewer is
  -- weighted as lived (safe) but never badged as such.
  ADD COLUMN IF NOT EXISTS rater_relationships JSONB NOT NULL DEFAULT '{}',
  -- Organisations the reviewer belonged to when they reviewed. Snapshot
  -- semantics on purpose: leaving an org later does not rewrite history.
  ADD COLUMN IF NOT EXISTS rater_org_ids UUID[] NOT NULL DEFAULT '{}',
  -- Per-norm scores, e.g. {"sensory": 5, "mobility": 4} — the product
  -- equivalent of ratings.barrier_scores.
  ADD COLUMN IF NOT EXISTS barrier_scores JSONB NOT NULL DEFAULT '{}',
  -- Marked helpful by other people, same as ratings.helpful_count.
  ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0;

-- "Reviews from members of org X" stays fast as volume grows.
CREATE INDEX IF NOT EXISTS product_reviews_rater_org_ids_idx
  ON public.product_reviews USING GIN (rater_org_ids);

-- Product reviews were readable but not writable: there was no INSERT policy
-- and no write route at all, which is why rating a product was impossible.
-- 2026_shop_products.sql created a FOR ALL owner policy; re-assert it here so
-- this file is sufficient on its own.
DROP POLICY IF EXISTS product_reviews_write ON public.product_reviews;
CREATE POLICY product_reviews_write ON public.product_reviews
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMENT ON COLUMN public.product_reviews.rater_diagnostics IS
  'Snapshot of { barrier_type: severity } for the reviewer at review time. Powers the diagnostics breakdown without cross-user reads.';

-- =============================================================================
-- STEP 24 — servicehub-mvp/scripts/2026_peer_vouches.sql
-- =============================================================================
-- Peer vouching. verification_method='peer' has existed in the CHECK constraint
-- and had a full UI badge ("Other members who share this norm have vouched for
-- this person") since STEP 20, but nothing ever wrote it — so the badge could
-- never appear. This is the ledger that makes it real.
--
-- Why a ledger rather than a flag: a single vouch is weak, and the vouch must
-- be revocable and auditable. We need to count DISTINCT vouchers per norm, and
-- know who they were, to resist two accounts vouching for each other.
--
-- Deliberately stores no diagnosis, no document and no free text — the same
-- rule as organisation vouching. Only WHO vouched, for WHOM, on WHICH norm.
CREATE TABLE IF NOT EXISTS public.peer_vouches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vouchee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  barrier_type TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One vouch per person per norm. Re-vouching must not inflate the count.
  CONSTRAINT peer_vouches_unique UNIQUE (voucher_id, vouchee_id, barrier_type),
  -- Self-vouching would make the whole mechanism meaningless.
  CONSTRAINT peer_vouches_not_self CHECK (voucher_id <> vouchee_id)
);

CREATE INDEX IF NOT EXISTS peer_vouches_vouchee_idx
  ON public.peer_vouches (vouchee_id, barrier_type);
CREATE INDEX IF NOT EXISTS peer_vouches_voucher_idx
  ON public.peer_vouches (voucher_id);

ALTER TABLE public.peer_vouches ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can see that a vouch exists (the badge is public), but only
-- the voucher can create or withdraw their own.
DROP POLICY IF EXISTS peer_vouches_read ON public.peer_vouches;
CREATE POLICY peer_vouches_read ON public.peer_vouches
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS peer_vouches_write ON public.peer_vouches;
CREATE POLICY peer_vouches_write ON public.peer_vouches
  FOR ALL USING (voucher_id = auth.uid()) WITH CHECK (voucher_id = auth.uid());

COMMENT ON TABLE public.peer_vouches IS
  'Members with lived experience of a norm vouching that another member shares it. No diagnosis, no documents — only who, for whom, on which norm.';

-- =============================================================================
-- STEP 25 — servicehub-mvp/scripts/2026_storage_and_portraits.sql
-- =============================================================================
-- The project had NO storage buckets, so all four upload paths that target
-- `resource-images` were failing silently, and ideal_self_portraits was
-- referenced by shipped code but never created.


-- ---- Storage bucket ---------------------------------------------------------
-- Public read: these are resource photos and community images meant to be
-- viewable without a session. Writes are still restricted by the policies
-- below, so "public" here means readable, not writable.
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-images', 'resource-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "resource_images_public_read" ON storage.objects;
CREATE POLICY "resource_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'resource-images');

DROP POLICY IF EXISTS "resource_images_auth_insert" ON storage.objects;
CREATE POLICY "resource_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resource-images');

-- Overwriting matters: the portrait route upserts to a stable path
-- (ideal-self/<user>/portrait.png) so each person keeps exactly one.
DROP POLICY IF EXISTS "resource_images_auth_update" ON storage.objects;
CREATE POLICY "resource_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resource-images')
  WITH CHECK (bucket_id = 'resource-images');

DROP POLICY IF EXISTS "resource_images_owner_delete" ON storage.objects;
CREATE POLICY "resource_images_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resource-images' AND owner = auth.uid());

-- ---- Ideal-self portraits ---------------------------------------------------
-- One portrait per person, replaced on regeneration.
CREATE TABLE IF NOT EXISTS public.ideal_self_portraits (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  -- Path inside the bucket. NULL when the upload failed and we fell back to
  -- an inline data URL, which is worth being able to tell apart.
  image_path TEXT,
  prompt     TEXT,
  style      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ideal_self_portraits ENABLE ROW LEVEL SECURITY;

-- Your portrait is yours. Nothing here is public.
DROP POLICY IF EXISTS ideal_self_portraits_owner ON public.ideal_self_portraits;
CREATE POLICY ideal_self_portraits_owner ON public.ideal_self_portraits
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public._touch_ideal_self_portrait()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ideal_self_portraits_touch ON public.ideal_self_portraits;
CREATE TRIGGER ideal_self_portraits_touch
BEFORE UPDATE ON public.ideal_self_portraits
FOR EACH ROW EXECUTE FUNCTION public._touch_ideal_self_portrait();

COMMENT ON TABLE public.ideal_self_portraits IS
  'One AI portrait per user. image_path is NULL when the Storage upload failed and image_url holds an inline data URL instead.';

-- =============================================================================
-- STEP 26 — backend/database/migrations/2026_common_mistakes.sql
-- =============================================================================
-- ============================================================================
-- "Top mistakes at this stage" (Odosa).
--
-- Reflections already carry a real, keyword-detected `indicators` array
-- (task_avoidance, sleep_issues, social_withdrawal, sensory_overload,
-- energy_crash — see reflection_analysis_agent.py's pattern_indicators) and a
-- context_id. Milestone ids are structural — milestone_g{goal_idx}_{dim}_{i}
-- — so the SAME context_id is shared by every user whose Nth milestone in a
-- given life dimension is this one, which is exactly what "at this stage"
-- needs: real cross-user aggregation, not per-user noise.
--
-- No invented percentages. A stage with fewer than min_samples reflections
-- returns nothing, and the UI shows nothing rather than a number built on
-- two people.
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_common_mistakes(
  p_context_id  TEXT,
  min_samples   INT DEFAULT 5,
  max_results   INT DEFAULT 5
)
RETURNS TABLE (
  indicator   TEXT,
  pct         REAL,
  sample_size INT
)
LANGUAGE SQL
STABLE
AS $$
  WITH scoped AS (
    SELECT r.indicators
    FROM public.reflections r
    WHERE r.context_id = p_context_id
  ),
  total AS (
    SELECT COUNT(*)::INT AS n FROM scoped
  ),
  unnested AS (
    SELECT unnest(indicators) AS indicator
    FROM scoped
  ),
  counted AS (
    SELECT indicator, COUNT(*)::INT AS n
    FROM unnested
    -- Only genuinely negative indicators belong on a "what not to do" list.
    -- 'hyperfocus' is detected from the same pipeline but is not a mistake.
    WHERE indicator IN (
      'task_avoidance', 'sleep_issues', 'social_withdrawal',
      'sensory_overload', 'energy_crash', 'meal_skipping'
    )
    GROUP BY indicator
  )
  SELECT
    c.indicator,
    ROUND((c.n::REAL / t.n) * 100)::REAL AS pct,
    t.n AS sample_size
  FROM counted c, total t
  WHERE t.n >= min_samples
  ORDER BY c.n DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.get_common_mistakes(TEXT, INT, INT) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_common_mistakes(TEXT, INT, INT) IS
  'Real, cross-user "what not to do" list per milestone stage, from reflection indicators. Empty below min_samples — never a fabricated percentage.';

-- =============================================================================
-- STEP 27 — backend/database/migrations/2026_backlog_pathways.sql
-- =============================================================================
-- ============================================================================
-- New pathway categories from Odosa's feature list, and the "Model Jet"
-- named path model.
--
-- Category shells only (title/blurb/icon), matching the existing pattern for
-- 'creative' and 'travel' in 2026_path_categories.sql — status 'coming'
-- rather than 'live'. This is deliberately NOT full curricula: writing a
-- confident-looking 4-step program for something like addiction recovery
-- without real clinical input would be actively harmful misinformation, not
-- a shortcut. The category exists so it's visible and requestable; the real
-- milestones need the team's actual expertise before they go live.
--
-- Idempotent — ON CONFLICT DO NOTHING, so this never overwrites edits already
-- made in the dashboard.
-- ============================================================================

INSERT INTO public.path_categories
  (key, title, blurb, icon, tint, icon_tint, focus_category, examples, foundations_description, foundations_seed_goals, foundations_status, sort_order)
VALUES
  ('adulting', 'Adulting for Neurodivergent Adults',
   'The everyday logistics school never taught — bills, appointments, and keeping a routine that actually holds.',
   'ListChecks', 'from-teal-50 to-white border-teal-200', 'bg-teal-100 text-teal-600', 'other',
   '["Managing bills & subscriptions","Booking your own appointments","Building a routine that sticks","Grocery & meal logistics"]',
   NULL, '[]', 'coming', 9),

  ('recovery', 'Addiction & Recovery',
   'Support for recovery, at your own pace, alongside whatever else you are working on.',
   'LifeBuoy', 'from-slate-50 to-white border-slate-200', 'bg-slate-100 text-slate-600', 'health',
   '["Finding the right support","Managing triggers","Rebuilding routines","Staying connected"]',
   NULL, '[]', 'coming', 10),

  ('nutrition', 'Healthy Eating',
   'Building a relationship with food that works for your body, your budget, and your executive function.',
   'Apple', 'from-lime-50 to-white border-lime-200', 'bg-lime-100 text-lime-600', 'health',
   '["Meal planning that survives a bad week","Sensory-friendly food swaps","Budget-friendly nutrition","Eating on a routine"]',
   NULL, '[]', 'coming', 11),

  ('veganism', 'Plant-Based Living',
   'Going vegan or plant-based without it becoming one more thing to burn out on.',
   'Leaf', 'from-green-50 to-white border-green-200', 'bg-green-100 text-green-600', 'health',
   '["Getting started without overhauling everything","Nutrition basics","Easy staple meals","Finding community"]',
   NULL, '[]', 'coming', 12),

  ('entrepreneurship', 'Entrepreneurship & ADHD/Neurodivergence',
   'Building something of your own in a way that works with your brain, not against it.',
   'Rocket', 'from-orange-50 to-white border-orange-200', 'bg-orange-100 text-orange-600', 'career',
   '["Turning a hyperfocus into a business","Systems for the parts you avoid","Finding accountability","Pricing & admin without dread"]',
   NULL, '[]', 'coming', 13),

  ('public-health', 'Public Health & Healthcare Careers',
   'Undergrad vs. medical school, nursing vs. becoming a doctor, or public health more broadly — the early decision points.',
   'Stethoscope', 'from-cyan-50 to-white border-cyan-200', 'bg-cyan-100 text-cyan-600', 'education',
   '["Undergrad prerequisites vs. med school track","Nursing vs. MD/DO paths","Public health degrees","Choosing a specialty direction"]',
   NULL, '[]', 'coming', 14)
ON CONFLICT (key) DO NOTHING;

-- ---- "Model Jet" ------------------------------------------------------------
-- Odosa's own named path model for ADHD, OCD & Depression. Inserted as
-- 'pending', NOT 'approved' — the existing path_models workflow already
-- gates visibility on approval (see 2026_path_models.sql RLS: only approved
-- rows are publicly readable). Nothing here goes live until Odosa reviews
-- and either edits or approves it herself; the content below is a neutral,
-- widely-used starting template, not a claim about her personal experience.
-- path_models has no unique constraint on (category_key, name) — it is
-- user-submitted content where two people could reasonably pick the same
-- name, so adding one was not the right fix. Idempotency here comes from an
-- explicit existence check instead of ON CONFLICT.
INSERT INTO public.path_models (category_key, name, contributor, description, seed_goals, status)
SELECT
  'recovery',
  'Model Jet',
  'Odosa (draft — pending her review)',
  'A starting template for managing ADHD, OCD and depression together, rather than as separate tracks. Draft only — needs Odosa''s own milestones and edits before this represents her actual approach.',
  '["Build one routine that covers ADHD, OCD and mood together", "Reduce the friction between the three rather than treating them separately"]',
  'pending'
WHERE NOT EXISTS (
  SELECT 1 FROM public.path_models WHERE name = 'Model Jet' AND category_key = 'recovery'
);

-- =============================================================================
-- STEP 28 — backend/database/migrations/2026_role_model_galleria.sql
-- =============================================================================


CREATE TABLE IF NOT EXISTS public.role_models (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  bio            TEXT NOT NULL,
  photo_url      TEXT,
  -- Free-text categories rather than a fixed enum, matching how Tidbits tags
  -- already work — 'Black', 'Neurodivergent', 'Parent', 'Sibling',
  -- 'Young Leader', 'Visible Minority', etc. A closed list would fight the
  -- reality that a role model belongs to more than one at once.
  categories     TEXT[] NOT NULL DEFAULT '{}',
  -- Where the claim comes from — an interview, their own writing, a
  -- verified public statement. Not required (a submitter's own mentor may
  -- have no public source), but a review queue with no way to check a claim
  -- is worse than one that at least records where it came from.
  source_url     TEXT,
  submitted_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_models_status_idx ON public.role_models (status);
CREATE INDEX IF NOT EXISTS role_models_categories_idx ON public.role_models USING GIN (categories);

ALTER TABLE public.role_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_models_read_approved ON public.role_models;
CREATE POLICY role_models_read_approved ON public.role_models
  FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS role_models_read_own ON public.role_models;
CREATE POLICY role_models_read_own ON public.role_models
  FOR SELECT USING (auth.uid() = submitted_by);

DROP POLICY IF EXISTS role_models_insert_own ON public.role_models;
CREATE POLICY role_models_insert_own ON public.role_models
  FOR INSERT WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

-- Approval/rejection goes through the service-role admin path, same as
-- path_models — no UPDATE policy for anon/authenticated.

COMMENT ON TABLE public.role_models IS
  'Submitted role models for Hare World''s galleria. Nothing is visible until an admin approves it — no bio about a named person ships unreviewed.';

-- =============================================================================
-- STEP 29 — servicehub-mvp/scripts/2026_resource_badges.sql
-- =============================================================================
-- Missed on first write — appended after the fact so the combined runbook
-- stays complete. Trending/Rare/Highly-Requested badges.


-- STEP 34 redefines this function with two extra output columns
-- (trending_tier, first_party). CREATE OR REPLACE cannot narrow a
-- return shape back down, only widen or leave it alone -- Postgres
-- error 42P13 if the OUT-parameter row shape changes at all. Running
-- this file standalone against a database that already has STEP 34's
-- wider version applied would hit exactly that. Drop first, same as
-- STEP 34 already does before its own redefinition, so this file is
-- safe to (re)run regardless of what came before it.
DROP FUNCTION IF EXISTS public.get_resource_badges(UUID[]);

CREATE FUNCTION public.get_resource_badges(p_resource_ids UUID[])
RETURNS TABLE (
  resource_id       UUID,
  trending          BOOLEAN,
  highly_requested  BOOLEAN,
  rare              BOOLEAN,
  saves_recent      INTEGER,
  saves_total       INTEGER,
  category_count    INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  WITH target AS (
    SELECT r.id, r.category
    FROM public.resources r
    WHERE r.id = ANY(p_resource_ids)
  ),
  recent AS (
    SELECT sr.resource_id, COUNT(*)::INT AS n
    FROM public.saved_resources sr
    WHERE sr.resource_id = ANY(p_resource_ids)
      AND sr.created_at > NOW() - INTERVAL '14 days'
    GROUP BY sr.resource_id
  ),
  total AS (
    SELECT sr.resource_id, COUNT(*)::INT AS n
    FROM public.saved_resources sr
    WHERE sr.resource_id = ANY(p_resource_ids)
    GROUP BY sr.resource_id
  ),
  cat_counts AS (
    SELECT category, COUNT(*)::INT AS n
    FROM public.resources
    WHERE status = 'approved'
    GROUP BY category
  )
  SELECT
    t.id,
    COALESCE(rc.n, 0) >= 3                    AS trending,
    COALESCE(tt.n, 0) >= 10                   AS highly_requested,
    COALESCE(cc.n, 999) < 3                   AS rare,
    COALESCE(rc.n, 0),
    COALESCE(tt.n, 0),
    COALESCE(cc.n, 0)
  FROM target t
  LEFT JOIN recent rc ON rc.resource_id = t.id
  LEFT JOIN total tt ON tt.resource_id = t.id
  LEFT JOIN cat_counts cc ON cc.category = t.category;
$$;

GRANT EXECUTE ON FUNCTION public.get_resource_badges(UUID[]) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.get_resource_badges(UUID[]) IS
  'Trending/rare/highly-requested badges from real saves and category scarcity. No resource is badged without meeting a real, fixed threshold.';

-- =============================================================================
-- STEP 30 — backend/database/migrations/2026_calendar_real_dates.sql
-- =============================================================================
-- Real dates for the calendar. Additive: scheduled_date NULL keeps the
-- existing weekly-template behaviour, a set date is a one-time task.


ALTER TABLE public.calendar_tasks
  ADD COLUMN IF NOT EXISTS scheduled_date   DATE,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER
    CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 1440));

-- "What is on screen right now" — the only query the new views make.
CREATE INDEX IF NOT EXISTS calendar_tasks_user_date_idx
  ON public.calendar_tasks (user_id, scheduled_date);

-- Recurring rows are looked up by weekday instead.
CREATE INDEX IF NOT EXISTS calendar_tasks_user_recurring_idx
  ON public.calendar_tasks (user_id, day)
  WHERE scheduled_date IS NULL;

-- Backfill duration_minutes from the human-readable string already stored.
-- Only unambiguous forms are converted; anything else stays NULL rather than
-- being assigned a made-up length.
UPDATE public.calendar_tasks
   SET duration_minutes = CASE
     WHEN duration ~* '^\s*(\d+)\s*(min|mins|minute|minutes)\s*$'
       THEN (regexp_match(duration, '(\d+)'))[1]::INT
     WHEN duration ~* '^\s*(\d+)\s*(hr|hrs|hour|hours)\s*$'
       THEN (regexp_match(duration, '(\d+)'))[1]::INT * 60
     WHEN duration ~* '^\s*(\d+)\s*\.\s*5\s*(hr|hrs|hour|hours)\s*$'
       THEN (regexp_match(duration, '(\d+)'))[1]::INT * 60 + 30
     ELSE NULL
   END
 WHERE duration_minutes IS NULL
   AND duration IS NOT NULL;

COMMENT ON COLUMN public.calendar_tasks.scheduled_date IS
  'Real calendar date for a one-time task. NULL means the row recurs weekly on `day` — which is what the path-planning agents actually generate.';
COMMENT ON COLUMN public.calendar_tasks.duration_minutes IS
  'Length in minutes, for sizing a block on the time grid. Backfilled by parsing `duration`; NULL when that string was not unambiguously parseable.';

-- =============================================================================
-- STEP 31 — backend/database/migrations/2026_bulk_suggestions.sql
-- =============================================================================
-- Mass recommending. Milestones had no user-submission path at all before
-- this; resources already have one via public.resources.


CREATE TABLE IF NOT EXISTS public.milestone_suggestions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 200),
  description   TEXT,
  -- Life dimension, matching what the path planner emits so an approved
  -- suggestion can slot straight into a generated path.
  dimension     TEXT NOT NULL DEFAULT 'education'
                  CHECK (dimension IN ('education', 'workplace', 'relationships', 'health', 'barrier')),
  -- Which Path Market life category this belongs under. Free text rather
  -- than a foreign key: path_categories is editable content, and a
  -- suggestion should not be destroyed because a category was renamed.
  category_key  TEXT,
  submitted_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Groups everything from one paste, so a reviewer can accept or reject a
  -- batch together and a submitter can see what they sent as one unit.
  batch_id      UUID,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestone_suggestions_status_idx
  ON public.milestone_suggestions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS milestone_suggestions_owner_idx
  ON public.milestone_suggestions (submitted_by);
CREATE INDEX IF NOT EXISTS milestone_suggestions_batch_idx
  ON public.milestone_suggestions (batch_id);

ALTER TABLE public.milestone_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS milestone_suggestions_read_approved ON public.milestone_suggestions;
CREATE POLICY milestone_suggestions_read_approved ON public.milestone_suggestions
  FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS milestone_suggestions_read_own ON public.milestone_suggestions;
CREATE POLICY milestone_suggestions_read_own ON public.milestone_suggestions
  FOR SELECT USING (auth.uid() = submitted_by);

DROP POLICY IF EXISTS milestone_suggestions_insert_own ON public.milestone_suggestions;
CREATE POLICY milestone_suggestions_insert_own ON public.milestone_suggestions
  FOR INSERT WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

-- Approval goes through the service-role admin path, same as path_models.

COMMENT ON TABLE public.milestone_suggestions IS
  'User-contributed milestones from the bulk import. Nothing is publicly visible until approved — a bulk paste is exactly how a half-formed list reaches a shared catalogue.';


-- =============================================================================
-- STEP 32 — backend/database/migrations/2026_llm_usage.sql
-- =============================================================================
-- LLM usage ledger for the model harness. Limits were counted in process
-- memory, so Render's free tier wiped them on every sleep: the usage panel
-- read 0 tokens however much a user had generated, and the daily cap reset
-- with it. Multiple workers each held their own count, making the real limit
-- limit × worker count.

CREATE TABLE IF NOT EXISTS public.llm_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = signed-out caller. Those share one bucket by design; without it a
  -- client could mint a new identity per request to reset its own limit.
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model_id          TEXT NOT NULL,
  agent_id          TEXT,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens INTEGER NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  total_tokens      INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  -- NULL when this model has no configured price. Not zero: zero would read as
  -- "this call was free", which is a different claim.
  cost_usd          NUMERIC(12, 6),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS llm_usage_user_time_idx
  ON public.llm_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS llm_usage_time_idx
  ON public.llm_usage (created_at DESC);

ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;

-- Writes go through the service role only: a client that could insert here
-- could also inflate someone else's spend.
DROP POLICY IF EXISTS llm_usage_read_own ON public.llm_usage;
CREATE POLICY llm_usage_read_own ON public.llm_usage
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.llm_usage IS
  'One row per LLM call, for spend limits that survive a restart. Daily totals are summed from rows rather than kept as a counter, so a lost write cannot corrupt an unrecoverable total.';
COMMENT ON COLUMN public.llm_usage.cost_usd IS
  'NULL when the model had no configured price in MODEL_PRICING. Never a guessed figure.';


-- =============================================================================
-- STEP 33 — backend/database/migrations/2026_commitment_stat.sql
-- =============================================================================
-- Commitment: a fifth Life Stat, and the only nullable one. It measures whether
-- someone keeps coming back over weeks, so it cannot be computed until an
-- account has history — and a new user must not be shown "Commitment 0/10" for
-- the crime of having just signed up. NULL means "not enough history yet",
-- which is a different statement from a low score.
--
-- Requires database/life_stats.sql to have been run first.

ALTER TABLE public.life_stats_snapshots
  ADD COLUMN IF NOT EXISTS commitment smallint
    CHECK (commitment IS NULL OR commitment BETWEEN 0 AND 100);

COMMENT ON COLUMN public.life_stats_snapshots.commitment IS
  'Consistency over a 28-day window. NULL when the account is too new to judge — not the same as a score of 0.';

-- =============================================================================
-- STEP 34 — backend/database/migrations/2026_resourcehub_filters.sql
-- =============================================================================
-- Connection Type to Norm, Age Range, Autinerary's Own, commentary source,
-- and time-tiered Trending. Each filter gets real data to stand on first.


-- ---- Connection Type to Norm ------------------------------------------------
-- Odosa asked for 12 granular connection types. The existing 4-tier
-- relationship weighting (lived 1.0 / direct 0.6 / indirect 0.35 / ally 0.15)
-- is NOT replaced — the granular type sits alongside it and maps onto a tier,
-- so all existing weighted averages keep working untouched.
--
-- Note "undiagnosed_identifying" and "undiagnosed_unsure" both map to `lived`.
-- That is deliberate and matches the standing rule: assessment is expensive
-- and often inaccessible, so self-identification is valid here and is never
-- weighted below a diagnosis.
ALTER TABLE public.user_barriers
  ADD COLUMN IF NOT EXISTS connection_type TEXT
    CHECK (connection_type IS NULL OR connection_type IN (
      'diagnosed', 'undiagnosed_identifying', 'undiagnosed_unsure',
      'parent_guardian', 'sibling', 'caretaker',
      'educator', 'employer', 'coworker', 'therapist', 'researcher',
      'ally'
    ));

CREATE INDEX IF NOT EXISTS user_barriers_connection_type_idx
  ON public.user_barriers (user_id, connection_type);

-- Backfill the granular type from the coarse tier already on the row, so
-- existing users are not blanked. Only the unambiguous mappings are set;
-- 'lived' stays NULL because we cannot tell diagnosed from self-identifying
-- retroactively, and guessing would put words in someone's mouth about their
-- own diagnosis.
UPDATE public.user_barriers
   SET connection_type = CASE relationship
     WHEN 'ally' THEN 'ally'
     ELSE NULL
   END
 WHERE connection_type IS NULL
   AND relationship = 'ally';

-- Which tier a granular type carries, so weighting stays single-sourced.
CREATE OR REPLACE FUNCTION public.connection_type_tier(p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'diagnosed'               THEN 'lived'
    WHEN 'undiagnosed_identifying' THEN 'lived'
    WHEN 'undiagnosed_unsure'      THEN 'lived'
    WHEN 'parent_guardian'         THEN 'direct_support'
    WHEN 'sibling'                 THEN 'direct_support'
    WHEN 'caretaker'               THEN 'direct_support'
    WHEN 'educator'                THEN 'indirect_support'
    WHEN 'employer'                THEN 'indirect_support'
    WHEN 'coworker'                THEN 'indirect_support'
    WHEN 'therapist'               THEN 'indirect_support'
    WHEN 'researcher'              THEN 'indirect_support'
    WHEN 'ally'                    THEN 'ally'
    ELSE 'lived'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.connection_type_tier(TEXT) TO authenticated, anon, service_role;

-- Snapshot on ratings, same denormalisation reason as rater_relationships:
-- RLS blocks reading another rater's profile at render time.
ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS rater_connection_types JSONB NOT NULL DEFAULT '{}';

-- ---- Age Range --------------------------------------------------------------
-- Which age bands a resource actually serves. An array because most serve
-- several, and an empty array means "not stated" — which the UI must show as
-- unknown rather than quietly treating as "serves everyone".
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS age_ranges TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS resources_age_ranges_idx
  ON public.resources USING GIN (age_ranges);

COMMENT ON COLUMN public.resources.age_ranges IS
  'Age bands served: babies_0_4, children_5_8, preteens_9_12, teens_13_17, young_adults_18_30, adults_30_45, adults_45_65, seniors_65_plus. Empty = not stated, which is NOT the same as serves-everyone.';

-- ---- Autinerary's Own -------------------------------------------------------
-- First-party resources. Admin-set only: there is no user-facing write path,
-- because a self-applied "official" badge is worth nothing.
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS is_first_party BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS resources_first_party_idx
  ON public.resources (is_first_party) WHERE is_first_party = TRUE;

-- ---- Commentary provenance --------------------------------------------------
-- Odosa: commentaries need a source and a direct URL to the original post.
-- Without these a commentary is an unattributed quote, which is both less
-- useful and a credit problem.
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS source_type TEXT
    CHECK (source_type IS NULL OR source_type IN (
      'news',
      'reddit', 'twitter', 'facebook',
      'youtube', 'tiktok', 'instagram',
      'tidbits', 'other'
    )),
  ADD COLUMN IF NOT EXISTS source_url TEXT;

CREATE INDEX IF NOT EXISTS resources_source_type_idx
  ON public.resources (source_type) WHERE source_type IS NOT NULL;

-- ---- Special Tags: time-tiered trending -------------------------------------
-- Odosa asked for Trending split into Today (bronze), This week (silver),
-- This month (gold), This year (platinum). Longer sustained interest is the
-- rarer achievement, hence platinum at the top.
--
-- Replaces get_resource_badges from STEP 29, keeping its existing columns so
-- current callers do not break, and adding the tier. A resource returns ONE
-- trending tier — the highest it genuinely meets — rather than four badges.
--
-- Thresholds are fixed and real. Nothing is badged for merely existing.
-- Postgres refuses CREATE OR REPLACE when the OUT-parameter row shape
-- changes (here: adding trending_tier and first_party to STEP 29's
-- columns), so the old signature has to be dropped explicitly first.
-- IF EXISTS keeps this safe to re-run.
DROP FUNCTION IF EXISTS public.get_resource_badges(UUID[]);

CREATE FUNCTION public.get_resource_badges(p_resource_ids UUID[])
RETURNS TABLE (
  resource_id       UUID,
  trending          BOOLEAN,
  trending_tier     TEXT,
  highly_requested  BOOLEAN,
  rare              BOOLEAN,
  first_party       BOOLEAN,
  saves_recent      INTEGER,
  saves_total       INTEGER,
  category_count    INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  WITH target AS (
    SELECT r.id, r.category, r.is_first_party
    FROM public.resources r
    WHERE r.id = ANY(p_resource_ids)
  ),
  windows AS (
    SELECT
      sr.resource_id,
      COUNT(*) FILTER (WHERE sr.created_at > NOW() - INTERVAL '1 day')::INT   AS d1,
      COUNT(*) FILTER (WHERE sr.created_at > NOW() - INTERVAL '7 days')::INT  AS d7,
      COUNT(*) FILTER (WHERE sr.created_at > NOW() - INTERVAL '30 days')::INT AS d30,
      COUNT(*) FILTER (WHERE sr.created_at > NOW() - INTERVAL '365 days')::INT AS d365,
      COUNT(*)::INT AS total
    FROM public.saved_resources sr
    WHERE sr.resource_id = ANY(p_resource_ids)
    GROUP BY sr.resource_id
  ),
  cat_counts AS (
    SELECT category, COUNT(*)::INT AS n
    FROM public.resources
    WHERE status = 'approved'
    GROUP BY category
  )
  SELECT
    t.id,
    -- Trending at all = meets the lowest tier.
    COALESCE(w.d1, 0) >= 3 OR COALESCE(w.d7, 0) >= 10
      OR COALESCE(w.d30, 0) >= 25 OR COALESCE(w.d365, 0) >= 100    AS trending,
    -- Highest tier genuinely met, hardest first.
    CASE
      WHEN COALESCE(w.d365, 0) >= 100 THEN 'platinum'
      WHEN COALESCE(w.d30, 0)  >= 25  THEN 'gold'
      WHEN COALESCE(w.d7, 0)   >= 10  THEN 'silver'
      WHEN COALESCE(w.d1, 0)   >= 3   THEN 'bronze'
      ELSE NULL
    END                                                            AS trending_tier,
    COALESCE(w.total, 0) >= 10                                     AS highly_requested,
    COALESCE(cc.n, 999) < 3                                        AS rare,
    COALESCE(t.is_first_party, FALSE)                              AS first_party,
    COALESCE(w.d7, 0),
    COALESCE(w.total, 0),
    COALESCE(cc.n, 0)
  FROM target t
  LEFT JOIN windows w ON w.resource_id = t.id
  LEFT JOIN cat_counts cc ON cc.category = t.category;
$$;

GRANT EXECUTE ON FUNCTION public.get_resource_badges(UUID[]) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.get_resource_badges(UUID[]) IS
  'Trending (tiered bronze/silver/gold/platinum by sustained saves), rare, highly-requested and first-party badges. Every tier has a fixed real threshold; nothing is badged for existing.';

-- =============================================================================
-- STEP 35 — backend/database/migrations/2026_tidbits_quoted_comments.sql
-- =============================================================================
-- "Comment on" a highlighted passage. Quote stored as text, not offsets.


ALTER TABLE public.community_answers
  -- The passage this reply is responding to. NULL = an ordinary reply to the
  -- whole post, which stays the default.
  ADD COLUMN IF NOT EXISTS quoted_text TEXT
    CHECK (quoted_text IS NULL OR length(trim(quoted_text)) BETWEEN 1 AND 1000);

CREATE INDEX IF NOT EXISTS community_answers_quoted_idx
  ON public.community_answers (post_id)
  WHERE quoted_text IS NOT NULL;

COMMENT ON COLUMN public.community_answers.quoted_text IS
  'The passage a reader highlighted and replied to. Stored as text, not offsets, so an author editing the post cannot silently repoint every quote at the wrong words.';


-- STEP 36 — backend/database/migrations/2026_helpful_votes.sql
-- ==================================================================

-- =====================================================================
-- One "Helpful" vote per person per review
--
-- ratings.helpful_count was a bare integer that any POST could increment.
-- A tester found they could hold down the Helpful button and drive a
-- review's count up without limit, which also skews "Most Helpful" sort
-- and the helpful_total in the badge rollups. There was no record of who
-- had voted, so there was nothing to check a second click against.
--
-- This adds that record. helpful_count stays and keeps its current
-- values -- existing counts are real signal we are not discarding, and
-- they cannot be attributed retroactively. From here the column is
-- maintained by trigger from the votes table, so it can only move by one
-- per person per review, in either direction.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.rating_helpful_votes (
  rating_id  UUID        NOT NULL REFERENCES public.ratings(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rating_id, user_id)
);

COMMENT ON TABLE public.rating_helpful_votes IS
  'One row per person per review marked helpful. The composite primary key is what makes the Helpful button unspammable.';

CREATE INDEX IF NOT EXISTS rating_helpful_votes_user_idx
  ON public.rating_helpful_votes (user_id);

-- ---------------------------------------------------------------
-- Keep ratings.helpful_count in step with the votes table.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_rating_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ratings
       SET helpful_count = COALESCE(helpful_count, 0) + 1
     WHERE id = NEW.rating_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- GREATEST guards the floor: un-voting must never push a count
    -- negative, including against counts that predate this table.
    UPDATE public.ratings
       SET helpful_count = GREATEST(0, COALESCE(helpful_count, 0) - 1)
     WHERE id = OLD.rating_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rating_helpful_votes_sync ON public.rating_helpful_votes;
CREATE TRIGGER rating_helpful_votes_sync
  AFTER INSERT OR DELETE ON public.rating_helpful_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_rating_helpful_count();

-- ---------------------------------------------------------------
-- Row-level security: everyone can see the tallies, you only control
-- your own vote.
-- ---------------------------------------------------------------
ALTER TABLE public.rating_helpful_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "helpful_votes_select_all" ON public.rating_helpful_votes;
CREATE POLICY "helpful_votes_select_all"
  ON public.rating_helpful_votes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "helpful_votes_insert_own" ON public.rating_helpful_votes;
CREATE POLICY "helpful_votes_insert_own"
  ON public.rating_helpful_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "helpful_votes_delete_own" ON public.rating_helpful_votes;
CREATE POLICY "helpful_votes_delete_own"
  ON public.rating_helpful_votes FOR DELETE
  USING (auth.uid() = user_id);


-- STEP 37 — backend/database/migrations/2026_pending_request_identity.sql
-- ==================================================================

-- =====================================================================
-- You can see who is asking to connect with you
--
-- The profiles_read policy let you read a profile when it was yours,
-- when it was marked discoverable, or when you were already CONNECTED.
-- A pending request is none of those. So when someone with
-- discoverable = false sent a friend request, the recipient could not
-- read the requester's profile at all, and the inbox fell back to the
-- name stored on the connection row -- which is the name the requester
-- typed for the RECIPIENT. Testers saw their own name on the request.
--
-- Being asked to connect is itself consent to be identified to the
-- person you asked: you cannot sensibly accept or decline a request
-- from someone you are not allowed to see. This extends the policy to
-- pending rows in either direction, and no further -- a pending request
-- reveals a profile only to the two people in it.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read"
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR discoverable = true
    OR EXISTS (
      SELECT 1 FROM public.social_connections sc
      WHERE sc.status IN ('connected', 'pending')
        AND (
          (sc.owner_id = auth.uid() AND sc.target_user_id = profiles.id)
          OR (sc.target_user_id = auth.uid() AND sc.owner_id = profiles.id)
        )
    )
  );

COMMENT ON POLICY "profiles_read" ON public.profiles IS
  'Readable when it is yours, when it is discoverable, or when a connection row links you to it -- connected or pending. Pending is included so the person deciding on a friend request can see who sent it.';


-- ---------------------------------------------------------------
-- Backfill: clear the placeholder role on already-accepted rows.
--
-- `role` is a human-readable subtitle, but sending a request filled it
-- with the literal text 'Pending Request'. Accept only ever flipped
-- `status`, so connections that have been accepted for weeks still read
-- "Pending Request" on the card.
--
-- This clears that text on CONNECTED rows only, and only where it is
-- exactly one of the two placeholders the app writes. A role anybody
-- actually typed is left untouched, and no row is removed.
-- ---------------------------------------------------------------
UPDATE public.social_connections
   SET role = ''
 WHERE status = 'connected'
   AND trim(role) IN ('Pending Request', 'Pending Connection');


-- STEP 38 — backend/database/migrations/2026_sensory_scans.sql
-- ==================================================================

-- =====================================================================
-- Sensory scans: measured conditions at a physical venue
--
-- A phone already carries the sensors needed to measure the two parts
-- of sensory load that are objectively measurable: sound and light.
-- Everything here is DERIVED. No audio, no video and no image is ever
-- stored or transmitted; there is deliberately nowhere to put one. The
-- capture runs in the browser, produces a handful of numbers, and the
-- numbers are what travels.
--
-- The design point that matters: there is no "autism-friendly score"
-- column, and there must never be one. Sensory need is bidirectional.
-- One autistic person is hypersensitive to sound and another is
-- hyposensitive and seeks it out, so a low reading is good for one and
-- bad for the other. A single score would be confidently wrong for a
-- large share of users. Measurements are stored raw and interpreted
-- per person against their own profile at read time.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- -------------------------------------------------------------------
-- 1. What a person finds hard, so measurements can be interpreted
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sensory_profile (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 'hyper' finds it too much, 'hypo' seeks more of it, 'neutral' unbothered.
  sound_sensitivity       TEXT NOT NULL DEFAULT 'neutral'
                            CHECK (sound_sensitivity IN ('hyper','neutral','hypo')),
  -- Separate from level, because unpredictability is its own problem.
  sudden_noise_difficulty BOOLEAN NOT NULL DEFAULT false,
  comfortable_db_max      SMALLINT CHECK (comfortable_db_max BETWEEN 30 AND 120),
  comfortable_db_min      SMALLINT CHECK (comfortable_db_min BETWEEN 0 AND 90),

  -- Nobody seeks out flicker, so this one is not bidirectional.
  flicker_sensitivity     TEXT NOT NULL DEFAULT 'neutral'
                            CHECK (flicker_sensitivity IN ('hyper','neutral')),
  brightness_sensitivity  TEXT NOT NULL DEFAULT 'neutral'
                            CHECK (brightness_sensitivity IN ('hyper','neutral','hypo')),
  comfortable_lux_max     INTEGER CHECK (comfortable_lux_max BETWEEN 10 AND 100000),
  comfortable_lux_min     INTEGER CHECK (comfortable_lux_min BETWEEN 0 AND 10000),

  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sensible_db_range  CHECK (comfortable_db_min  IS NULL OR comfortable_db_max  IS NULL
                                       OR comfortable_db_min  < comfortable_db_max),
  CONSTRAINT sensible_lux_range CHECK (comfortable_lux_min IS NULL OR comfortable_lux_max IS NULL
                                       OR comfortable_lux_min < comfortable_lux_max)
);

COMMENT ON TABLE public.user_sensory_profile IS
  'How one person experiences sound and light. Used to interpret venue_scans for them. Never aggregated across users.';

-- -------------------------------------------------------------------
-- 2. One scan of one venue at one moment
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venue_scans (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id               UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Local wall-clock at the venue. A cafe at 08:00 and the same cafe at
  -- 13:00 are different places, so every reading is filed by when it was
  -- taken rather than averaged into one meaningless figure.
  local_hour                SMALLINT NOT NULL CHECK (local_hour BETWEEN 0 AND 23),
  day_of_week               SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  duration_seconds          SMALLINT NOT NULL CHECK (duration_seconds BETWEEN 5 AND 300),

  -- ---- Sound. Null when the scan was light-only. ----
  -- Percentile levels are the standard way to describe a soundscape:
  -- L90 is the floor you always hear, L10 is the level the loud moments
  -- reach. The gap between them is how spiky the room is, and the gap
  -- predicts distress better than the average does.
  sound_median_db           NUMERIC(5,2) CHECK (sound_median_db BETWEEN 0 AND 140),
  sound_l10_db              NUMERIC(5,2) CHECK (sound_l10_db    BETWEEN 0 AND 140),
  sound_l90_db              NUMERIC(5,2) CHECK (sound_l90_db    BETWEEN 0 AND 140),
  sound_peak_db             NUMERIC(5,2) CHECK (sound_peak_db   BETWEEN 0 AND 140),
  -- Sudden loud events per minute, and how abruptly sound arrives.
  sound_peak_events_per_min NUMERIC(6,2) CHECK (sound_peak_events_per_min >= 0),
  sound_onset_rate          NUMERIC(6,2) CHECK (sound_onset_rate >= 0),

  -- ---- Light. Null when the scan was sound-only. ----
  light_lux                 NUMERIC(9,2) CHECK (light_lux >= 0),
  -- Mains lighting flickers at 100 or 120 Hz. Modulation depth is how
  -- deep the dip is; shallow flicker is usually unnoticed, deep flicker
  -- is what causes headache and fatigue.
  flicker_hz                NUMERIC(6,2) CHECK (flicker_hz >= 0),
  flicker_modulation_pct    NUMERIC(5,2) CHECK (flicker_modulation_pct BETWEEN 0 AND 100),
  light_kelvin              INTEGER CHECK (light_kelvin BETWEEN 1000 AND 20000),

  -- ---- How much to trust this reading ----
  device_model              TEXT,
  calibration_offset_db     NUMERIC(5,2) NOT NULL DEFAULT 0,
  calibration_source        TEXT NOT NULL DEFAULT 'uncalibrated'
                              CHECK (calibration_source IN ('uncalibrated','model_table','user_calibrated')),
  confidence                NUMERIC(3,2) NOT NULL DEFAULT 0.5
                              CHECK (confidence BETWEEN 0 AND 1),
  notes                     TEXT CHECK (notes IS NULL OR length(notes) <= 500),

  -- A scan that measured nothing is not a scan.
  CONSTRAINT scan_measured_something CHECK (
    sound_median_db IS NOT NULL OR light_lux IS NOT NULL OR flicker_hz IS NOT NULL
  )
);

COMMENT ON TABLE public.venue_scans IS
  'Derived sound and light measurements for a venue. No raw audio, video or images are stored here or anywhere else; capture is on-device and only these numbers leave it.';

CREATE INDEX IF NOT EXISTS venue_scans_resource_idx
  ON public.venue_scans (resource_id, local_hour);
CREATE INDEX IF NOT EXISTS venue_scans_user_idx
  ON public.venue_scans (user_id, scanned_at DESC);

-- One person should not be able to flood a venue's average by standing
-- there scanning. At most one scan per person per venue per hour block.
-- date_trunc over a timestamptz is only STABLE, because the answer
-- depends on the session timezone, and an index expression has to be
-- IMMUTABLE. Pinning to UTC first yields a plain timestamp, which is.
CREATE UNIQUE INDEX IF NOT EXISTS venue_scans_one_per_hour
  ON public.venue_scans (resource_id, user_id, (date_trunc('hour', scanned_at AT TIME ZONE 'UTC')));

-- -------------------------------------------------------------------
-- 3. Row-level security
--
-- Scans are a shared public good: anyone can read them, because the
-- point is that other people benefit from your reading. But a sensory
-- profile is health-adjacent information about one person and is
-- readable only by them.
-- -------------------------------------------------------------------
ALTER TABLE public.venue_scans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sensory_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_scans_select_all ON public.venue_scans;
CREATE POLICY venue_scans_select_all
  ON public.venue_scans FOR SELECT USING (true);

DROP POLICY IF EXISTS venue_scans_insert_own ON public.venue_scans;
CREATE POLICY venue_scans_insert_own
  ON public.venue_scans FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS venue_scans_update_own ON public.venue_scans;
CREATE POLICY venue_scans_update_own
  ON public.venue_scans FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS venue_scans_delete_own ON public.venue_scans;
CREATE POLICY venue_scans_delete_own
  ON public.venue_scans FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sensory_profile_own ON public.user_sensory_profile;
CREATE POLICY sensory_profile_own
  ON public.user_sensory_profile FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------------------
-- 4. Venue summary, bucketed by time of day
--
-- Returns one row per part of the day that actually has readings. The
-- scan_count travels with every row on purpose: the caller must be able
-- to say "from 2 scans" rather than presenting two readings with the
-- same confidence as fifty.
-- -------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_venue_sensory(UUID);
CREATE OR REPLACE FUNCTION public.get_venue_sensory(resource_id_in UUID)
RETURNS TABLE (
  time_bucket            TEXT,
  scan_count             INT,
  median_db              NUMERIC,
  l10_db                 NUMERIC,
  l90_db                 NUMERIC,
  peak_db                NUMERIC,
  peak_events_per_min    NUMERIC,
  onset_rate             NUMERIC,
  lux                    NUMERIC,
  flicker_hz             NUMERIC,
  flicker_modulation_pct NUMERIC,
  kelvin                 NUMERIC,
  last_scanned_at        TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN vs.local_hour >= 6  AND vs.local_hour < 11 THEN 'morning'
      WHEN vs.local_hour >= 11 AND vs.local_hour < 14 THEN 'midday'
      WHEN vs.local_hour >= 14 AND vs.local_hour < 17 THEN 'afternoon'
      WHEN vs.local_hour >= 17 AND vs.local_hour < 22 THEN 'evening'
      ELSE 'night'
    END                                                        AS time_bucket,
    COUNT(*)::INT                                              AS scan_count,
    -- Medians, not means: one passing motorbike should not redefine a cafe.
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.sound_median_db::DOUBLE PRECISION)::NUMERIC           AS median_db,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.sound_l10_db::DOUBLE PRECISION)::NUMERIC              AS l10_db,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.sound_l90_db::DOUBLE PRECISION)::NUMERIC              AS l90_db,
    MAX(vs.sound_peak_db)                                                     AS peak_db,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.sound_peak_events_per_min::DOUBLE PRECISION)::NUMERIC AS peak_events_per_min,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.sound_onset_rate::DOUBLE PRECISION)::NUMERIC          AS onset_rate,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.light_lux::DOUBLE PRECISION)::NUMERIC                 AS lux,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.flicker_hz::DOUBLE PRECISION)::NUMERIC                AS flicker_hz,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.flicker_modulation_pct::DOUBLE PRECISION)::NUMERIC    AS flicker_modulation_pct,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.light_kelvin::DOUBLE PRECISION)::NUMERIC     AS kelvin,
    MAX(vs.scanned_at)                                                        AS last_scanned_at
  FROM public.venue_scans vs
  WHERE vs.resource_id = resource_id_in
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.get_venue_sensory(UUID) IS
  'Per-time-of-day sensory summary for one venue. Medians rather than means so a single passing lorry does not redefine the room. scan_count is returned so callers can disclose how thin the evidence is.';


-- STEP 39 — backend/database/migrations/2026_imported_venues.sql
-- ==================================================================

-- =====================================================================
-- Imported venues: provenance, de-duplication and freshness
--
-- ResourceHub can be seeded from open data rather than typed in by
-- hand. Three things have to be true before that is safe.
--
-- 1. Provenance. Every imported row has to say where it came from and
--    carry the credit its licence requires. OpenStreetMap is ODbL,
--    which means attribution is a condition of use, not a courtesy.
--
-- 2. De-duplication. An import that runs twice must not double the
--    directory, so the external identifier is unique.
--
-- 3. Freshness. This matters more here than in most products. Someone
--    plans a trip around a service, travels there, and finds it closed.
--    For the people this is built for that is not a minor annoyance, it
--    is a wasted day and a bad one. So an imported row records when it
--    was last confirmed against its source, and the interface can go
--    quiet about anything stale instead of pretending to know.
--
-- What is deliberately NOT imported: anything about how accessible or
-- autism-friendly a place is. A survey of 286 real venues in central
-- Toronto found names on 97% of them, wheelchair tags on 16%, and
-- hearing loops, quiet rooms or autism tags on none at all. That data
-- does not exist to import. Inventing it from an amenity type would be
-- fabrication of exactly the kind this product exists to replace, so
-- imported venues arrive as a place with an address and nothing more.
-- What it is like inside comes from ratings and sensory scans.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- Widen source_type to cover open data. The previous list only had
-- social and news origins, because until now everything came from a
-- person posting a link.
ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_source_type_check;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_source_type_check
    CHECK (source_type IS NULL OR source_type IN (
      'news',
      'reddit', 'twitter', 'facebook',
      'youtube', 'tiktok', 'instagram',
      'tidbits',
      'openstreetmap', 'open_data', 'operator',
      'other'
    ));

ALTER TABLE public.resources
  -- Stable identifier at the source, e.g. 'osm:node/1234567'. Distinct
  -- from source_url because a site can reorganise its URLs without the
  -- underlying record changing identity.
  ADD COLUMN IF NOT EXISTS source_ref TEXT,
  -- The credit line the licence obliges us to display.
  ADD COLUMN IF NOT EXISTS source_attribution TEXT,
  -- Last time this row was confirmed to still match its source.
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.resources.source_ref IS
  'Stable identifier at the origin, e.g. osm:node/1234567. Unique, so re-running an import updates rather than duplicates.';
COMMENT ON COLUMN public.resources.source_attribution IS
  'Credit line required by the source licence. ODbL makes this a condition of use, not a courtesy.';
COMMENT ON COLUMN public.resources.last_verified_at IS
  'When this row was last confirmed against its source. Someone travelling to a service that closed is a wasted day, so the UI goes quiet on stale rows rather than pretending to know.';

-- One row per external record. This is what makes re-import idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS resources_source_ref_key
  ON public.resources (source_ref) WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS resources_last_verified_idx
  ON public.resources (last_verified_at) WHERE last_verified_at IS NOT NULL;


-- STEP 40 — backend/database/migrations/2026_source_ref_conflict_fix.sql
-- ==================================================================

-- =====================================================================
-- Fix: resources.source_ref could never actually be used as an upsert
-- conflict target
--
-- STEP 39 added a UNIQUE INDEX on source_ref, but made it PARTIAL:
--   CREATE UNIQUE INDEX ... ON resources (source_ref)
--     WHERE source_ref IS NOT NULL;
--
-- Postgres can only use a partial unique index for ON CONFLICT
-- inference when the INSERT statement's own ON CONFLICT clause repeats
-- that exact WHERE predicate. Supabase's JS client -- and PostgREST's
-- upsert() in general -- issues ON CONFLICT with a bare column list and
-- has no way to also supply a predicate, so it could never match this
-- index. The result: every venue-import upsert batch failed with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification", and a real run over 20 cities found 9,620 usable
-- OpenStreetMap venues and wrote zero of them.
--
-- The partial predicate was never actually necessary. Standard SQL
-- uniqueness semantics already treat NULL as distinct from every other
-- NULL, so a PLAIN (non-partial) UNIQUE constraint on a nullable column
-- already allows unlimited rows with source_ref = NULL -- which is
-- every resource that was not imported from an external source. That
-- was the entire reason the index was made partial in the first place,
-- and it was redundant.
--
-- This drops the unusable partial index and replaces it with a real
-- UNIQUE constraint carrying the same name, so it is now a valid
-- inference target for ON CONFLICT (source_ref).
--
-- Idempotent from EITHER starting state: a bare partial index (never
-- run before) or an existing real constraint (already run once). See
-- the note below on why the order of the two DROPs matters -- getting
-- it backwards is what broke re-running this file at all.
-- =====================================================================

-- Constraint first, index second. A UNIQUE constraint is backed by an
-- index of the SAME NAME, and Postgres refuses `DROP INDEX` on an index
-- a constraint owns -- "cannot drop index ... because constraint ...
-- requires it, HINT: drop the constraint instead". That is exactly what
-- running this file a second time hit: the first run had already turned
-- resources_source_ref_key from a bare index into a real constraint, so
-- the DROP INDEX line that worked the first time failed the second.
-- Dropping the constraint first removes its backing index automatically,
-- so this now succeeds whichever shape the object is currently in --
-- and the second line's IF EXISTS makes it a no-op the rest of the time.
ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_source_ref_key;

DROP INDEX IF EXISTS public.resources_source_ref_key;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_source_ref_key UNIQUE (source_ref);

COMMENT ON CONSTRAINT resources_source_ref_key ON public.resources IS
  'Real unique constraint, not a partial index -- PostgREST upsert(onConflict: "source_ref") can only target a plain constraint, and NULL source_ref values already do not collide with each other under normal SQL semantics, so no partial predicate was needed.';


-- STEP 41 — backend/database/migrations/2026_resource_photos.sql
-- ==================================================================

-- =====================================================================
-- Resource photos: real where one exists, honestly generic where not
--
-- A survey of 1,440 venues in the same categories this app imports
-- found direct OSM image tags on 0.1% of them -- essentially none.
-- But 9.4% carry a `wikidata` tag, and of those, 75.6% resolve to a
-- real photo via Wikidata's P18 (image) property, which is always
-- sourced from Wikimedia Commons under a free licence. Net: about 7%
-- of venues can get a genuine, correctly-licensed photo of the actual
-- building at zero cost. The other ~93% get nothing real to show,
-- because nothing real exists to show.
--
-- image_url already exists on resources and now carries either kind of
-- image. The two columns below are what keep the difference honest:
-- image_is_generic tells the UI whether it is looking at a photo of
-- THIS venue or a category illustration, and image_attribution carries
-- the credit a real photo's licence requires. Wikimedia Commons
-- licences (CC-BY-SA, CC-BY, and outright public domain) all permit
-- reuse, but several require attribution as a condition, so this is
-- not optional for the real-photo rows.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS image_is_generic BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS image_attribution TEXT;

COMMENT ON COLUMN public.resources.image_is_generic IS
  'TRUE when image_url is a category illustration, not a photo of this specific venue. The UI must never present a generic image as though it depicts the real place -- that would be the same fabrication this column exists to prevent.';
COMMENT ON COLUMN public.resources.image_attribution IS
  'Credit line for a real photo sourced from Wikimedia Commons. NULL for generic images, which need none. Several Commons licences make attribution a condition of reuse, not a courtesy.';

CREATE INDEX IF NOT EXISTS resources_image_generic_idx
  ON public.resources (image_is_generic);


-- STEP 42 — backend/database/migrations/2026_embedding_text_version.sql
-- ==================================================================

-- =====================================================================
-- Record which text each profile embedding was built from
--
-- Pattern Recognition used to embed the stringified onboarding dict,
-- email and user id included. It now embeds an anonymised summary built
-- by backend/core/embedding_privacy.py. Vectors built from the two texts
-- live in different parts of the embedding space and are not comparable:
-- cosine similarity between an old-text vector and a new-text vector
-- measures the difference in the text, not the difference in the people.
--
-- This column says which text a row came from, so the backfill script
-- can re-embed only the stale rows and the retrieval experiments can
-- refuse to mix versions.
--
--   NULL       built from the original raw text (every row before this)
--   'anon-v1'  built from build_embedding_text, first version
--
-- Nullable on purpose: existing rows genuinely do not have a version, and
-- inventing one for them would hide exactly the thing this column exists
-- to expose.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.pattern_user_embeddings
  ADD COLUMN IF NOT EXISTS embedding_text_version TEXT;

COMMENT ON COLUMN public.pattern_user_embeddings.embedding_text_version IS
  'Which outbound text the embedding was built from. NULL = legacy raw text (included email and id); anon-v1 = anonymised summary from core/embedding_privacy.py. Vectors from different versions are not comparable.';

CREATE INDEX IF NOT EXISTS pattern_user_embeddings_text_version_idx
  ON public.pattern_user_embeddings (embedding_text_version);


-- STEP 43 — backend/database/migrations/2026_pattern_field_embeddings.sql
-- ==================================================================

-- =====================================================================
-- Per-field profile embeddings (Pattern Recognition experiment, arm 4)
--
-- pattern_user_embeddings holds ONE vector per user, built from goals and
-- conditions joined into a single string. This table holds one vector per
-- user PER FIELD -- goals and conditions embedded separately -- so the two
-- approaches can be compared side by side. It adds to the existing table;
-- nothing reads or writes pattern_user_embeddings differently because of it.
--
-- Experiment-only. Production retrieval does not use this table, and
-- onboarding does not write to it: scripts/embed_pattern_fields.py fills
-- it, and is re-run before each experiment.
--
-- Two things the existing table lacks, added here on purpose:
--
--   * A foreign key with ON DELETE CASCADE. pattern_user_embeddings.user_id
--     has none, so nothing removes a vector when its account is deleted --
--     the orphaned-vector risk on the data-quality slide. This table does
--     not repeat that.
--
--   * text_sha256, a hash of the exact text that was embedded. Re-running
--     the generator skips unchanged rows and rebuilds changed ones, so a
--     profile edit cannot leave a stale vector here unnoticed -- the other
--     index-health problem on that slide.
--
-- No ANN index: at two rows per user an exact scan is instant, and an
-- ivfflat index on a table this small would return approximate results
-- for no benefit.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.pattern_user_field_embeddings (
  user_id                UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field                  TEXT         NOT NULL CHECK (field IN ('goals', 'barriers')),
  embedding              VECTOR(1536) NOT NULL,
  embedding_text_version TEXT         NOT NULL,
  text_sha256            TEXT         NOT NULL,
  model                  TEXT         NOT NULL DEFAULT 'text-embedding-ada-002',
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, field)
);

-- Written only by the service-role script; no client ever reads it.
ALTER TABLE public.pattern_user_field_embeddings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pattern_user_field_embeddings IS
  'Experiment arm 4: goals and conditions embedded separately, from the anonymised per-field text in core/embedding_privacy.py. Not used by production retrieval.';
COMMENT ON COLUMN public.pattern_user_field_embeddings.text_sha256 IS
  'SHA-256 of the exact text embedded. Lets the generator skip unchanged rows and rebuild stale ones.';


-- STEP 44 — backend/database/migrations/2026_pattern_similarity_labels.sql
-- ==================================================================

-- =====================================================================
-- Human judgements of "are these two people genuinely similar?"
--
-- Pattern Recognition decides who counts as similar by cosine similarity
-- between embeddings. Nothing has ever checked that against a person's
-- judgement -- the open question on the deck. This table holds that
-- judgement: team members look at two de-identified profile summaries and
-- say similar or not similar. The experiment then asks which
-- representation (text, engineered features, concatenated, split) agrees
-- with them.
--
-- Negatives are stored as well as positives on purpose. With only
-- "similar" labels you can measure whether an arm finds those pairs, but
-- not whether it also rates dissimilar pairs highly; an arm that calls
-- everyone similar would score perfectly.
--
-- Pairs are stored in a canonical order (user_a < user_b) so (x, y) and
-- (y, x) are the same pair. Several team members may label the same pair,
-- which makes inter-rater agreement measurable; the same person labelling
-- it twice is prevented.
--
-- labeled_by is a team member's name or initials, not an account: the
-- labelling script runs with the service role. Nothing about the labelled
-- users beyond their ids is stored here.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.pattern_similarity_labels (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL CHECK (label IN ('similar', 'not_similar')),
  labeled_by  TEXT        NOT NULL CHECK (length(trim(labeled_by)) BETWEEN 1 AND 60),
  note        TEXT        CHECK (note IS NULL OR length(note) <= 500),
  -- How the pair was proposed (e.g. 'spread:high', 'disagree:text>features'),
  -- so a skew in what got labelled can be seen afterwards.
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pattern_similarity_labels_ordered CHECK (user_a < user_b),
  CONSTRAINT pattern_similarity_labels_once UNIQUE (user_a, user_b, labeled_by)
);

-- Service role only. No policies: no client should read or write this.
ALTER TABLE public.pattern_similarity_labels ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pattern_similarity_labels IS
  'Ground truth for Pattern Recognition: team judgements of whether two real users are genuinely similar. Used to test which representation tracks human judgement.';



-- STEP 45 — backend/database/migrations/2026_onboarding_funnel.sql
-- ==================================================================

-- =====================================================================
-- Onboarding funnel events and post-setup feedback
--
-- From Riipen Labs' onboarding review (Team 1, Sept 2026), "Implementation
-- considerations":
--   * analytics to track where users enter and leave the onboarding process
--   * success measures: the share of visitors who complete account creation,
--     users who return within 7 days, users who leave during onboarding
--   * surveys asking whether users got the right amount of information about
--     Autinerary before creating an account
--
-- onboarding_events answers the first two. One row per event; the funnel is
-- computed by backend/scripts/onboarding_funnel.py.
--
--   visitor_id  random UUID generated in the browser on first visit. It is
--               not linked to a person until that browser signs up, which
--               is what lets "visited the landing page" be joined to "made
--               an account" and to "came back within 7 days".
--   channel     utm_source of the first visit (e.g. 'tiktok', 'facebook'),
--               so acquisition channels can be compared.
--   step        the onboarding step id for onboarding_step_view.
--
-- Deliberately NOT stored: IP address, user agent, full URLs, anything a
-- person typed. Browsers sending Do Not Track or Global Privacy Control are
-- not counted at all (enforced in frontend/lib/funnel.ts).
--
-- onboarding_feedback holds the two-question survey shown after setup.
-- onboarding_version marks which version of onboarding someone went through,
-- so the revised flow can be compared with later revisions.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id                 BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id         UUID        NOT NULL,
  user_id            UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  event              TEXT        NOT NULL CHECK (event IN (
                       'landing_view', 'signup_view', 'signup_complete',
                       'onboarding_step_view', 'onboarding_complete', 'app_open'
                     )),
  step               TEXT        CHECK (step IS NULL OR length(step) <= 40),
  channel            TEXT        CHECK (channel IS NULL OR length(channel) <= 40),
  campaign           TEXT        CHECK (campaign IS NULL OR length(campaign) <= 80),
  referrer_host      TEXT        CHECK (referrer_host IS NULL OR length(referrer_host) <= 120),
  onboarding_version TEXT        NOT NULL CHECK (length(onboarding_version) <= 40),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_events_event_time_idx
  ON public.onboarding_events (event, created_at);
CREATE INDEX IF NOT EXISTS onboarding_events_visitor_idx
  ON public.onboarding_events (visitor_id);
CREATE INDEX IF NOT EXISTS onboarding_events_user_time_idx
  ON public.onboarding_events (user_id, created_at) WHERE user_id IS NOT NULL;

-- Written only by the server route (service role) after validating the
-- event; no client reads or writes it directly, so no policies.
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.onboarding_events IS
  'Onboarding funnel: landing visit -> sign-up -> each setup step -> setup complete -> return visits. No IP, user agent, URLs or typed content. See backend/scripts/onboarding_funnel.py.';


CREATE TABLE IF NOT EXISTS public.onboarding_feedback (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- "Before you made an account, how much did you know about what
  -- Autinerary would do for you?"
  info_before_signup TEXT        CHECK (info_before_signup IN ('too_little', 'about_right', 'too_much')),
  -- "How easy was setup?" 1 = very hard ... 5 = very easy
  setup_ease         SMALLINT    CHECK (setup_ease BETWEEN 1 AND 5),
  comment            TEXT        CHECK (comment IS NULL OR length(comment) <= 1000),
  onboarding_version TEXT        NOT NULL CHECK (length(onboarding_version) <= 40),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_feedback_once UNIQUE (user_id, onboarding_version),
  CONSTRAINT onboarding_feedback_answered CHECK (
    info_before_signup IS NOT NULL OR setup_ease IS NOT NULL OR comment IS NOT NULL
  )
);

ALTER TABLE public.onboarding_feedback ENABLE ROW LEVEL SECURITY;

-- People can submit and read back their own answers, nobody else's.
DROP POLICY IF EXISTS onboarding_feedback_insert_own ON public.onboarding_feedback;
CREATE POLICY onboarding_feedback_insert_own ON public.onboarding_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS onboarding_feedback_select_own ON public.onboarding_feedback;
CREATE POLICY onboarding_feedback_select_own ON public.onboarding_feedback
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.onboarding_feedback IS
  'Two-question survey after setup: was there enough information before sign-up, and how easy was setup. One response per user per onboarding version.';



-- STEP 46 — backend/database/migrations/2026_checkins.sql
-- ==================================================================

-- =====================================================================
-- Check-ins: why people stop, and whether active users find it useful
--
-- Riipen Labs, Group 2 ("Improving the Autinerary User Experience"):
--   * "Understand user drop-off ... send a very short survey to inactive
--     users"
--   * "Ask active users about usefulness and inactive users why they
--     disengaged"
--   * "Add email and notification opt-in so a check-in can reach users who
--     stop opening the app"
--
-- checkin_responses holds the answers, from three places:
--   inactive_email  the one-question email sent after two weeks away, only to
--                   people who opted in (profiles.preferences.checkin.optIn)
--   welcome_back    asked in the app when someone returns after two weeks
--   usefulness      asked in the app to active users, after the team's
--                   existing feedback form, never at the same time
--
-- checkin_state is what the daily email job needs, for opted-in people only:
--   last_seen_on  the last day they opened the app (written by
--                 /api/checkin/seen, so it works even when the browser blocks
--                 analytics with Do Not Track or Global Privacy Control)
--   last_sent_at  when a check-in email was last sent. One email per absence:
--                 nobody is emailed again unless they came back and then
--                 stopped again, and never twice within 60 days.
-- Written only by server routes (service role).
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.checkin_responses (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind               TEXT        NOT NULL CHECK (kind IN ('inactive_email', 'welcome_back', 'usefulness')),
  -- Why they stopped (inactive_email, welcome_back).
  reason             TEXT        CHECK (reason IN (
                       'too_much', 'not_what_i_needed', 'hard_to_find', 'no_time',
                       'not_useful_yet', 'just_exploring', 'other'
                     )),
  -- Is it useful so far (usefulness).
  usefulness         TEXT        CHECK (usefulness IN ('very', 'somewhat', 'not_yet')),
  comment            TEXT        CHECK (comment IS NULL OR length(comment) <= 1000),
  onboarding_version TEXT        CHECK (onboarding_version IS NULL OR length(onboarding_version) <= 40),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT checkin_responses_answered CHECK (reason IS NOT NULL OR usefulness IS NOT NULL OR comment IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS checkin_responses_kind_time_idx
  ON public.checkin_responses (kind, created_at);
CREATE INDEX IF NOT EXISTS checkin_responses_user_idx
  ON public.checkin_responses (user_id, created_at DESC);

ALTER TABLE public.checkin_responses ENABLE ROW LEVEL SECURITY;

-- In-app answers are written with the person's own session; email answers
-- come through the server route (service role) after the link's signature
-- has been checked. People can read back only their own.
DROP POLICY IF EXISTS checkin_responses_insert_own ON public.checkin_responses;
CREATE POLICY checkin_responses_insert_own ON public.checkin_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS checkin_responses_select_own ON public.checkin_responses;
CREATE POLICY checkin_responses_select_own ON public.checkin_responses
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.checkin_responses IS
  'Why people stop using Autinerary (email check-in, welcome-back question) and whether active users find it useful. See backend/scripts/onboarding_funnel.py.';


CREATE TABLE IF NOT EXISTS public.checkin_state (
  user_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_on DATE,
  last_sent_at TIMESTAMPTZ,
  send_count   INTEGER     NOT NULL DEFAULT 0 CHECK (send_count >= 0)
);

-- Service role only (server routes). No policies.
ALTER TABLE public.checkin_state ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.checkin_state IS
  'For people who opted in to the check-in email: the last day they opened the app and when the email was last sent (one per absence, at most one in 60 days).';


-- STEP 47 — backend/database/migrations/2026_push_subscriptions.sql
-- ==================================================================

-- =====================================================================
-- Push notifications
--
-- Riipen Labs, Group 2: "add email and notification opt-in so a check-in can
-- reach users who stop opening the app". Email was STEP 46; this is the
-- notification half.
--
-- One row per device (browser) a person turned notifications on for, from
-- Settings or the page after setup (app/components/PushOptIn.tsx). The
-- endpoint is the device's address at its browser's push service; p256dh and
-- auth are the keys notifications are encrypted with, so the push service
-- cannot read them. A device that turns notifications on again, or changes
-- hands, replaces its row.
--
-- Sent by the inactive-user check-in (app/api/cron/inactive-checkin), plus
-- one confirmation when notifications are turned on. Rows the push service
-- reports as gone are deleted when a send fails.
--
-- Written only by server routes (service role): no policies.
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint     TEXT        PRIMARY KEY CHECK (length(endpoint) <= 1000),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p256dh       TEXT        NOT NULL CHECK (length(p256dh) <= 200),
  auth         TEXT        NOT NULL CHECK (length(auth) <= 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.push_subscriptions IS
  'Devices a person turned notifications on for (Web Push). Used for the inactive-user check-in. Service role only.';

-- STEP 48 — backend/database/migrations/2026_start_here_events.sql
-- ==================================================================

-- =====================================================================
-- "Start here" funnel events
--
-- Riipen Labs, Group 4 recommended a guided "Start Here" (who you are here
-- for, what you need today, then a first pathway of resources) and measuring
-- it: completion ("select a role and goal, then reach a resource list"),
-- relevance ("users mark results as useful or save the path") and
-- confidence ("choose a next action"). These five events join the funnel's
-- vocabulary (STEP 45). The step column carries the answers chosen, never
-- anything typed:
--
--   start_role     chose who they are here for   step 'child'
--   start_pathway  saw a pathway                 step 'child.services'
--   start_open     opened one of its resources   step 'child.services.therapists'
--   start_useful   answered "Was this useful?"   step 'child.services.yes' or '.no'
--   start_save     pressed "Save this path"      step 'child.services'
--
-- Reported by backend/scripts/onboarding_funnel.py. Until this is applied
-- those events are dropped (the old check refuses them and /api/events
-- ignores the error); nothing else is affected.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- STEP 45's check on event has a generated name: drop whichever check lists
-- the events, then add the wider one under a fixed name.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.onboarding_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%landing_view%'
  LOOP
    EXECUTE format('ALTER TABLE public.onboarding_events DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.onboarding_events
  ADD CONSTRAINT onboarding_events_event_check CHECK (event IN (
    'landing_view', 'signup_view', 'signup_complete',
    'onboarding_step_view', 'onboarding_complete', 'app_open',
    'start_role', 'start_pathway', 'start_open', 'start_useful', 'start_save'
  ));

-- STEP 49 — backend/database/migrations/2026_feature_use_events.sql
-- ==================================================================

-- =====================================================================
-- Which parts of the app people use
--
-- Riipen Labs, Group 5 suggested tracking, after the beta, "drop-off points
-- and which features different user groups actually use". One event joins
-- the funnel's vocabulary (STEPS 45 and 48):
--
--   feature_use   opened a part of the app   step: 'calendar', 'tidbits', ...
--
-- At most once a day per part per browser, for signed-in people who have
-- finished setup; the parts are listed in frontend/lib/funnel.ts. Nothing
-- typed, no addresses. Reported by backend/scripts/onboarding_funnel.py,
-- split by who people are here for. Until this is applied those events are
-- dropped; nothing else is affected.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.onboarding_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%landing_view%'
  LOOP
    EXECUTE format('ALTER TABLE public.onboarding_events DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.onboarding_events
  ADD CONSTRAINT onboarding_events_event_check CHECK (event IN (
    'landing_view', 'signup_view', 'signup_complete',
    'onboarding_step_view', 'onboarding_complete', 'app_open',
    'start_role', 'start_pathway', 'start_open', 'start_useful', 'start_save',
    'feature_use'
  ));

-- STEP 50 — backend/database/migrations/2026_ask_later_events.sql
-- ==================================================================

-- =====================================================================
-- Questions asked later: are they answered?
--
-- Riipen Labs, Group 7 recommended asking optional setup questions later,
-- with an "assumption to test, not assume: users will actually engage ...
-- later if not asked upfront". The Path asks them one group at a time
-- (frontend/app/components/AskLaterCard.tsx). One event joins the funnel's
-- vocabulary (STEPS 45, 48 and 49):
--
--   ask_later   step 'shown.<group>'      the group was shown (once per browser)
--               step 'done.<question>'    a question was answered or opened
--               step 'closed.<group>'     the group was closed without answering
--
-- Groups and questions are listed in frontend/lib/askLater.ts. Nothing typed
-- is sent. Reported by backend/scripts/onboarding_funnel.py. Until this is
-- applied those events are dropped; nothing else is affected.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.onboarding_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%landing_view%'
  LOOP
    EXECUTE format('ALTER TABLE public.onboarding_events DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.onboarding_events
  ADD CONSTRAINT onboarding_events_event_check CHECK (event IN (
    'landing_view', 'signup_view', 'signup_complete',
    'onboarding_step_view', 'onboarding_complete', 'app_open',
    'start_role', 'start_pathway', 'start_open', 'start_useful', 'start_save',
    'feature_use', 'ask_later'
  ));

-- STEP 51 — backend/database/migrations/2026_resourcehub_events.sql
-- ==================================================================

-- =====================================================================
-- ResourceHub's first session: setup, first place opened, nearby results
--
-- Riipen Labs, Group 8 recommended a three-step ResourceHub setup (role,
-- one topic, a first place to start), results sorted by distance, and
-- prompts that ask for more later, measured by "onboarding completion
-- rate, time from landing to first resource viewed, and ... the
-- percentage of search results returned within the user's stated radius",
-- with each prompt validated "before adding more". ResourceHub sends these
-- to the funnel table (STEP 45) through its own /api/events
-- (servicehub-mvp/app/api/events/route.ts):
--
--   rh_visit            'first' | 'return'          first visit from this browser, or
--                                                   its first on a later day
--   rh_setup_step       'role' | 'topic' | 'first'  a setup step was shown
--   rh_setup_complete   'topic' | 'no_topic'        setup was saved
--   rh_first_resource   'setup' | 'browse'          first place opened, and from where
--   rh_search           '<near>/<shown>'            a search with a location, page 1
--   rh_prompt           '<shown|yes|no|later>.<sharpen|more_like_these|add_topic>'
--
-- This replaces STEP 50's list and keeps every event in it, so if STEP 50
-- was not applied, this alone is enough. Nothing typed is sent. Reported by
-- backend/scripts/onboarding_funnel.py. Until this is applied ResourceHub's
-- events are dropped; nothing else is affected.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.onboarding_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%landing_view%'
  LOOP
    EXECUTE format('ALTER TABLE public.onboarding_events DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.onboarding_events
  ADD CONSTRAINT onboarding_events_event_check CHECK (event IN (
    'landing_view', 'signup_view', 'signup_complete',
    'onboarding_step_view', 'onboarding_complete', 'app_open',
    'start_role', 'start_pathway', 'start_open', 'start_useful', 'start_save',
    'feature_use', 'ask_later',
    'rh_visit', 'rh_setup_step', 'rh_setup_complete', 'rh_first_resource',
    'rh_search', 'rh_prompt'
  ));

-- STEP 52 — backend/database/migrations/2026_stories_and_newsletter.sql
-- ==================================================================

-- =====================================================================
-- Stories people share, and the weekly email (STEP 52)
--
-- Riipen Labs, Group 11 recommended "lived-experience testimonials ...
-- shared with consent" and "a value-led newsletter ... and a soft email ask
-- after the preview: 'Want these saved and emailed to you?' Never a hard
-- email wall."
--
-- public.stories: a story someone chose to share, with the consent choices
-- from docs/beta/testimonials.md. The team shortens it if needed
-- (final_text) and sets status 'awaiting_approval'; the person approves that
-- exact text in the app (/share-your-story); the team then sets 'published'
-- and it can appear on the home page. The person can withdraw it at any
-- time. Deleting the account deletes their stories.
--
-- public.newsletter_subscribers: people who asked, without an account, for
-- the weekly email and/or their Start here list by email. Nothing is sent
-- until they confirm from the email itself (double opt-in), so a typed-in
-- address can never be signed up by someone else; the token in each link
-- confirms or unsubscribes. ip_hash is a salted hash, only for limiting
-- sign-ups from one place; it cannot be turned back into an address.
--
-- Both are read and written only by the app's server (service role), which
-- checks who is asking; RLS is on with no policies.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.stories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story         TEXT        NOT NULL CHECK (length(story) BETWEEN 20 AND 1500),
  -- Written here; audio or video is recorded with the team afterwards.
  format        TEXT        NOT NULL DEFAULT 'text' CHECK (format IN ('text', 'audio', 'video')),
  role          TEXT        CHECK (role IN ('self', 'parent', 'sibling', 'family', 'professional', 'ally', 'other')),
  show_role     BOOLEAN     NOT NULL DEFAULT false,
  province      TEXT        CHECK (length(province) <= 40),
  show_province BOOLEAN     NOT NULL DEFAULT false,
  display_name  TEXT        CHECK (length(display_name) <= 40),
  name_display  TEXT        NOT NULL DEFAULT 'none' CHECK (name_display IN ('first_name', 'initials', 'none')),
  share_site    BOOLEAN     NOT NULL DEFAULT true,
  share_social  BOOLEAN     NOT NULL DEFAULT false,
  adult         BOOLEAN     NOT NULL CHECK (adult),
  status        TEXT        NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('submitted', 'awaiting_approval', 'approved', 'published', 'declined', 'withdrawn')),
  -- The version the person approves and the site shows (the team may shorten it).
  final_text    TEXT        CHECK (length(final_text) <= 1500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at   TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  withdrawn_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stories_user_idx ON public.stories (user_id);
CREATE INDEX IF NOT EXISTS stories_status_idx ON public.stories (status, published_at DESC);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.stories IS
  'Stories people chose to share, with their consent choices (docs/beta/testimonials.md). Service role only.';

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  email_key       TEXT        NOT NULL UNIQUE CHECK (email_key = lower(email)),
  -- Their Start here answers, for what the emails pick (lib/startHere.ts).
  role            TEXT        CHECK (length(role) <= 20),
  need            TEXT        CHECK (length(need) <= 20),
  weekly          BOOLEAN     NOT NULL DEFAULT false,
  send_list       BOOLEAN     NOT NULL DEFAULT false,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  token           TEXT        NOT NULL UNIQUE CHECK (length(token) >= 32),
  consent_text    TEXT        NOT NULL CHECK (length(consent_text) <= 500),
  ip_hash         TEXT        CHECK (length(ip_hash) <= 64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirm_sent_at TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  list_sent_at    TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  last_sent_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS newsletter_status_idx ON public.newsletter_subscribers (status, weekly);
CREATE INDEX IF NOT EXISTS newsletter_ip_idx ON public.newsletter_subscribers (ip_hash, created_at);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.newsletter_subscribers IS
  'Weekly email and emailed Start here lists, double opt-in (app/api/newsletter). Service role only.';

-- STEP 53 — backend/database/migrations/2026_user_paths_is_legacy.sql
-- ==================================================================
-- =====================================================================
-- Flag paths written before the agents computed their own numbers (STEP 53)
--
-- Until 064801c (26 August 2026, "derive confidence from real signals") the
-- agents wrote fixed numbers into every path they generated: path planning's
-- confidence 0.85, calendar optimization's 0.82, pattern recognition's 0.80,
-- and pattern recognition's "patterns" carried a made-up success_rate of 0.82
-- (and 0.79). Those values describe the old code, not the person. Paths
-- generated since then compute them.
--
-- is_legacy marks the rows from before, so any evaluation that assumes real
-- computed values can leave them out. Nothing is deleted or changed: the
-- payload stays exactly as it was.
--
-- How a legacy row is recognised: the same change added `nameSource` to every
-- milestone, so a path none of whose milestones carries it was written by the
-- old code. Checked on 8 October 2026 against all 95 rows: it marks exactly
-- the 16 paths generated before 26 August, and none after. The fixed values
-- alone are not a safe test: pattern recognition's computed confidence can
-- legitimately round to 0.80, and does in 4 paths generated in September.
--
--   rule (fixed value present in the path)            paths
--   path planning confidence 0.85                        16
--   calendar optimization confidence 0.82                16
--   pattern recognition confidence 0.80                  16  (+4 later paths
--                                                             where 0.80 was
--                                                             computed: not flagged)
--   pattern recognition patterns[].success_rate 0.82    14
--   flagged in total (rows written before 064801c)       16
--
-- A boolean rather than a data_version column: it is the smaller change (one
-- column, no writer changes, since every new row is simply not legacy) and it
-- answers the only question asked of it, "can these numbers be trusted?".
-- A data_version would need every writer to stamp a version from now on.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.user_paths
  ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_paths.is_legacy IS
  'true = generated before 064801c (26 Aug 2026): agent confidences and pattern success_rate in the payload are fixed values from the old code, not computed. Exclude from evaluations of those values.';

-- Every array function is wrapped in CASE: Postgres does not evaluate AND
-- left to right, so a type check beside it does not protect it.
UPDATE public.user_paths AS p
SET is_legacy = true
WHERE NOT p.is_legacy
  -- has milestones at all
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.payload::jsonb -> 'races') = 'array'
           THEN p.payload::jsonb -> 'races' ELSE '[]'::jsonb END
    ) AS r(race)
    WHERE CASE WHEN jsonb_typeof(r.race -> 'milestones') = 'array'
               THEN jsonb_array_length(r.race -> 'milestones') ELSE 0 END > 0
  )
  -- and none of them carries nameSource
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.payload::jsonb -> 'races') = 'array'
           THEN p.payload::jsonb -> 'races' ELSE '[]'::jsonb END
    ) AS r(race)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.race -> 'milestones') = 'array'
           THEN r.race -> 'milestones' ELSE '[]'::jsonb END
    ) AS m(milestone)
    WHERE jsonb_typeof(m.milestone) = 'object' AND m.milestone ? 'nameSource'
  );

CREATE INDEX IF NOT EXISTS user_paths_is_legacy_idx
  ON public.user_paths (is_legacy) WHERE is_legacy;


-- STEP 54 — backend/database/migrations/2026_milestone_ratings.sql
-- ==================================================================
-- =====================================================================
-- Milestone ratings: how useful a step of someone's plan was (STEP 54)
--
-- There are 0 reflections and the ratings table holds ResourceHub's place
-- ratings, almost all from seed personas, so Reflection Analysis and
-- Adaptation have no real signal about plans. This starts collecting one: on
-- a milestone's page, "How useful was this step for you?" 1 to 5.
--
-- One row per rating, never updated: rating a step again adds a row, and the
-- latest one counts. The history stays, which is what a label set needs.
-- path_id is part of the key because milestone ids repeat across one
-- person's paths ('milestone_g0_education_0' exists in each of them).
--
-- path_rating_scores rolls the latest rating of each milestone up to a path
-- score in [0, 1]: (rating - 1) / 4, averaged over the rated milestones.
-- It is a security_invoker view, so it shows each person only their own rows.
--
-- Written by the backend (POST /api/milestone-ratings), which then re-embeds
-- the person's profile vector with the path score as its success_rate, the
-- same call a reflection makes (orchestrator.index_user).
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.milestone_ratings (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id      TEXT        NOT NULL CHECK (length(path_id) BETWEEN 1 AND 100),
  milestone_id TEXT        NOT NULL CHECK (length(milestone_id) BETWEEN 1 AND 200),
  rating       SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestone_ratings_latest_idx
  ON public.milestone_ratings (user_id, path_id, milestone_id, created_at DESC);

ALTER TABLE public.milestone_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own milestone ratings" ON public.milestone_ratings;
CREATE POLICY "Read own milestone ratings" ON public.milestone_ratings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Add own milestone ratings" ON public.milestone_ratings;
CREATE POLICY "Add own milestone ratings" ON public.milestone_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.milestone_ratings IS
  'How useful a milestone was to the person (1-5). Append-only; the latest row per (user, path, milestone) counts.';

CREATE OR REPLACE VIEW public.path_rating_scores
WITH (security_invoker = true) AS
SELECT
  user_id,
  path_id,
  count(*)                                AS rated_milestones,
  round(avg((rating - 1) / 4.0), 3)       AS score,
  max(created_at)                         AS last_rated_at
FROM (
  SELECT DISTINCT ON (user_id, path_id, milestone_id)
         user_id, path_id, milestone_id, rating, created_at
  FROM public.milestone_ratings
  ORDER BY user_id, path_id, milestone_id, created_at DESC
) AS latest
GROUP BY user_id, path_id;

COMMENT ON VIEW public.path_rating_scores IS
  'Path score in [0,1] from the latest rating of each rated milestone: avg((rating-1)/4).';


-- STEP 55 — backend/database/migrations/2026_admin_users.sql
-- ==================================================================
-- =====================================================================
-- A real admin role (STEP 55)
--
-- There was no admin role. Admin work was done by holding the service_role
-- key, which bypasses every RLS policy, and ResourceHub and Tidbits treated
-- profiles.role = 'admin' as admin. profiles.role is also the "who are you"
-- answer people set themselves, and the profiles policy lets a signed-in
-- person update their own row, so nothing in the database stopped someone
-- setting their own role to 'admin' (0 profiles have it today).
--
-- 1. public.admin_users: who is an admin. Granted only in the SQL editor (no
--    policy lets the API add or change a row):
--      INSERT INTO public.admin_users (user_id, granted_by, note)
--      SELECT id, 'aayush', 'team' FROM auth.users WHERE email = '<their email>';
-- 2. public.is_admin(): whether the signed-in caller is one. Usable in RLS
--    policies and through the API (rpc('is_admin')). It answers only for the
--    caller, so it cannot be used to find out who the admins are.
-- 3. A guard on profiles: a signed-in session can no longer set role to
--    'admin'. Every remaining check on profiles.role = 'admin' (Tidbits
--    moderation, the moderation queue policy, ResourceHub's admin pages) is
--    therefore only as reachable as this table, until each moves to
--    is_admin(). The SQL editor and the service role are unaffected.
-- 4. The worked example: path model review. Admins may read every path
--    model and change only its status, through RLS, so approving no longer
--    needs the service_role key (frontend/app/api/path-models/[id]/approve).
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note       TEXT
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- People can see whether they themselves are an admin; nothing else.
DROP POLICY IF EXISTS "See your own admin row" ON public.admin_users;
CREATE POLICY "See your own admin row" ON public.admin_users
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE public.admin_users IS
  'Who may do admin work. Rows are added in the SQL editor only; is_admin() reads it for the signed-in caller.';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. Nobody grants themselves role 'admin' on their profile.
CREATE OR REPLACE FUNCTION public.protect_profile_admin_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.role = 'admin'
     AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'admin') THEN
    RAISE EXCEPTION 'The admin role is granted by the team (public.admin_users), not from a profile.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_profile_admin_role ON public.profiles;
CREATE TRIGGER protect_profile_admin_role
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_role();

-- 4. Path model review through RLS: admins read everything and change status only.
DROP POLICY IF EXISTS "path_models_admin_read" ON public.path_models;
CREATE POLICY "path_models_admin_read" ON public.path_models
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "path_models_admin_review" ON public.path_models;
CREATE POLICY "path_models_admin_review" ON public.path_models
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- The only column a signed-in session may change is status (and only admins
-- pass the policy above). Submitting stays as before (INSERT is untouched).
REVOKE UPDATE ON public.path_models FROM authenticated, anon;
GRANT UPDATE (status) ON public.path_models TO authenticated;


-- STEP 56 — backend/database/migrations/2026_vector_integrity.sql
-- ==================================================================
-- =====================================================================
-- Vector-store integrity: no orphaned vectors, no stale ones (STEP 56)
--
-- Orphaned vectors. pattern_user_embeddings.user_id had no foreign key, so
-- deleting an account left its vector behind. Counted before writing this
-- (8 October 2026): 0 of 72 rows point at an account that no longer exists.
-- The constraint is added checked when there are none, as now. If any appear
-- before this runs, it is added NOT VALID instead, which still applies to
-- every new or changed row and to future deletions, and the count is shown:
-- nothing is deleted here.
--
-- Stale vectors. A vector was rebuilt only at setup and after a reflection,
-- so a condition added later (in ResourceHub, for example) never reached it.
-- On 8 Oct 5 of 72 vectors lacked a condition the person has since added.
-- (The timestamp check on the deck said 11; only 2 of those differ in
-- content, because re-embedding never refreshed updated_at. Fixed below.)
--
--   * reindex_requested_at: set by a trigger whenever someone's conditions
--     change (user_barriers insert, delete, or a changed barrier_type), from
--     any app. The backend rebuilds those vectors with the same anonymiser
--     (core/pattern_reindex.py) and clears the mark. Goals change only when
--     a path is generated, which already rebuilds the vector.
--   * updated_at is now refreshed on every update, so it says when the
--     vector was last written.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

DO $$
DECLARE
  orphans integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pattern_user_embeddings'::regclass
      AND conname = 'pattern_user_embeddings_user_id_fkey'
  ) THEN
    SELECT count(*) INTO orphans
    FROM public.pattern_user_embeddings e
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.user_id);

    IF orphans = 0 THEN
      ALTER TABLE public.pattern_user_embeddings
        ADD CONSTRAINT pattern_user_embeddings_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    ELSE
      ALTER TABLE public.pattern_user_embeddings
        ADD CONSTRAINT pattern_user_embeddings_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
      RAISE NOTICE 'pattern_user_embeddings: % orphaned row(s) kept; the foreign key is NOT VALID until they are reviewed', orphans;
    END IF;
  END IF;
END $$;

ALTER TABLE public.pattern_user_embeddings
  ADD COLUMN IF NOT EXISTS reindex_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.pattern_user_embeddings.reindex_requested_at IS
  'Set when the person''s conditions change after the vector was built; the backend rebuilds it and clears this (core/pattern_reindex.py).';

CREATE INDEX IF NOT EXISTS pattern_user_embeddings_reindex_idx
  ON public.pattern_user_embeddings (reindex_requested_at)
  WHERE reindex_requested_at IS NOT NULL;

-- Mark a person's vector when their conditions change. SECURITY DEFINER:
-- ResourceHub writes user_barriers as the person, who cannot write here.
CREATE OR REPLACE FUNCTION public.request_pattern_reindex()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pattern_user_embeddings
     SET reindex_requested_at = now()
   WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN NULL;
END
$$;

-- Catch up: mark every vector whose stored conditions differ from the
-- person's current ones (ignoring case and surrounding spaces), so the first
-- sweep rebuilds the ones already stale: 5 of 72 on 8 Oct.
UPDATE public.pattern_user_embeddings AS e
   SET reindex_requested_at = now()
 WHERE e.reindex_requested_at IS NULL
   AND (SELECT coalesce(array_agg(DISTINCT lower(btrim(b.barrier_type)) ORDER BY lower(btrim(b.barrier_type))), '{}')
          FROM public.user_barriers AS b
         WHERE b.user_id = e.user_id AND btrim(b.barrier_type) <> '')
       IS DISTINCT FROM
       (SELECT coalesce(array_agg(DISTINCT lower(btrim(x)) ORDER BY lower(btrim(x))), '{}')
          FROM unnest(e.barriers) AS x
         WHERE btrim(x) <> '');

DROP TRIGGER IF EXISTS request_pattern_reindex ON public.user_barriers;
CREATE TRIGGER request_pattern_reindex
  AFTER INSERT OR DELETE OR UPDATE OF barrier_type, user_id ON public.user_barriers
  FOR EACH ROW EXECUTE FUNCTION public.request_pattern_reindex();

-- updated_at says when the vector was last written.
CREATE OR REPLACE FUNCTION public.touch_pattern_user_embeddings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.embedding IS DISTINCT FROM OLD.embedding THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS touch_pattern_user_embeddings ON public.pattern_user_embeddings;
CREATE TRIGGER touch_pattern_user_embeddings
  BEFORE UPDATE ON public.pattern_user_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.touch_pattern_user_embeddings();


-- STEP 57 — backend/database/migrations/2026_condition_vocabulary.sql
-- ==================================================================
-- =====================================================================
-- Normalised condition vocabulary (STEP 57)
--
-- user_barriers.barrier_type keeps what people chose or typed, as they wrote
-- it. On 8 Oct 2026 that was 92 distinct values (68 among real users) for 65
-- distinct meanings (55): "ADHD" and "adhd", "Autism" and "Autism spectrum
-- disorder" are the same condition. The Pattern Recognition filter already
-- normalises at query time with core/condition_taxonomy.py. This stores that
-- map's answer for every stored value, so SQL and reports can use it too.
--
--   condition_vocabulary       one row per distinct stored value: its kind
--                              (condition, placeholder or unmapped), canonical
--                              key, label and category. Written only by
--                              scripts/sync_condition_vocabulary.py from the
--                              same map, so it is that map's output, not a
--                              second map.
--   user_barriers_normalized   user_barriers with those columns joined on.
--
-- The raw values are not changed. Placeholders ("Prefer not to share", "No
-- current barriers") are their own kind, never a condition. A value the map
-- doesn't know is 'unmapped', for a person to decide on. A value written
-- after the last sync has no row yet (condition_kind is NULL in the view)
-- until the script runs again.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.condition_vocabulary (
  raw_value        TEXT        PRIMARY KEY,
  kind             TEXT        NOT NULL CHECK (kind IN ('condition', 'placeholder', 'unmapped')),
  canonical        TEXT,
  label            TEXT,
  category         TEXT,
  taxonomy_version TEXT        NOT NULL,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT condition_vocabulary_canonical_check CHECK ((kind = 'unmapped') = (canonical IS NULL))
);

COMMENT ON TABLE public.condition_vocabulary IS
  'The condition map''s answer (core/condition_taxonomy.py) for each distinct stored condition value. Written by scripts/sync_condition_vocabulary.py.';

ALTER TABLE public.condition_vocabulary ENABLE ROW LEVEL SECURITY;

-- Mapped values are the app's own option labels, so anyone signed in may
-- read them. Unmapped ones are text someone typed; only the service role
-- sees those. Nobody but the service role writes.
DROP POLICY IF EXISTS "Read mapped condition vocabulary" ON public.condition_vocabulary;
CREATE POLICY "Read mapped condition vocabulary" ON public.condition_vocabulary
  FOR SELECT TO authenticated
  USING (kind <> 'unmapped');

REVOKE ALL ON public.condition_vocabulary FROM anon, authenticated;
GRANT SELECT ON public.condition_vocabulary TO authenticated;

-- security_invoker: whoever reads it sees only the user_barriers rows they
-- could read anyway (their own, under user_barriers' policies).
CREATE OR REPLACE VIEW public.user_barriers_normalized
WITH (security_invoker = true) AS
SELECT b.id,
       b.user_id,
       b.barrier_category,
       b.barrier_type,
       b.created_at,
       v.kind     AS condition_kind,
       v.canonical AS condition_key,
       v.label    AS condition_label,
       v.category AS condition_category
FROM public.user_barriers AS b
LEFT JOIN public.condition_vocabulary AS v ON v.raw_value = b.barrier_type;

COMMENT ON VIEW public.user_barriers_normalized IS
  'user_barriers with the normalised condition joined on (STEP 57). barrier_type is the raw value, unchanged.';

REVOKE ALL ON public.user_barriers_normalized FROM anon, authenticated;
GRANT SELECT ON public.user_barriers_normalized TO authenticated;


-- STEP 58 — backend/database/migrations/2026_admin_role_tidbits.sql
-- ==================================================================
-- =====================================================================
-- Tidbits admin actions without the service-role key (STEP 58)
--
-- Needs STEP 55 (public.admin_users and public.is_admin()).
--
-- ResourceHub's Tidbits admin routes checked profiles.role = 'admin' and then
-- wrote with the service-role key, which skips every policy. Each section
-- below lets one of them run as the signed-in admin instead, so the database
-- decides what an admin may change (docs/admin-role.md).
--
-- Every policy here is TO authenticated. is_admin() is granted only to
-- authenticated, and a signed-out reader must never evaluate it: a policy
-- that applied to anon would turn their reads into permission errors.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Lock or unlock a post (POST /api/community/posts/[id]/lock).
DROP POLICY IF EXISTS community_posts_admin_update ON public.community_posts;
CREATE POLICY community_posts_admin_update ON public.community_posts
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2. Edit a post (PATCH /api/community/posts/[id]). Nothing new: the author
--    edits under community_posts_update, an admin under the policy in 1.

-- 3. Edit an answer (PATCH /api/community/answers/[id]).
DROP POLICY IF EXISTS community_answers_admin_update ON public.community_answers;
CREATE POLICY community_answers_admin_update ON public.community_answers
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Edit someone's community profile (PATCH /api/community/profiles/[id]).
--    An admin must see a private profile to update it. There is no admin
--    INSERT policy: an admin edits a profile, never creates one for someone
--    who has not opted in. Admins also see private profiles' pseudonyms
--    elsewhere now, as the moderation queue needs.
DROP POLICY IF EXISTS community_profiles_admin_read ON public.community_profiles;
CREATE POLICY community_profiles_admin_read ON public.community_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS community_profiles_admin_update ON public.community_profiles;
CREATE POLICY community_profiles_admin_update ON public.community_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Soft-delete a post (DELETE /api/community/posts/[id]), for its author or
--    an admin. A policy is not enough: an UPDATE that filters on a column
--    must leave a row the caller can still read, and a deleted post fails
--    community_posts_select (is_deleted = FALSE). So a function does it,
--    checking who is asking itself.
CREATE OR REPLACE FUNCTION public.community_delete_post(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_author UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign-in required' USING ERRCODE = '28000';
  END IF;
  SELECT author_id INTO v_author
    FROM public.community_posts
   WHERE id = p_post_id AND is_deleted = FALSE
   FOR UPDATE;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_author <> v_caller AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not your post' USING ERRCODE = '42501';
  END IF;
  UPDATE public.community_posts
     SET is_deleted = TRUE, deleted_by = v_caller, deleted_at = now()
   WHERE id = p_post_id;
END
$$;

REVOKE ALL ON FUNCTION public.community_delete_post(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_delete_post(UUID) TO authenticated;

-- 6. Soft-delete an answer (DELETE /api/community/answers/[id]), for its
--    author or an admin. A function, as in 5. Run as the caller, the answer
--    count trigger could not update a post that isn't theirs: RLS would
--    skip that row and the count would drift. In here it runs as the
--    function's owner.
CREATE OR REPLACE FUNCTION public.community_delete_answer(p_answer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_author UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign-in required' USING ERRCODE = '28000';
  END IF;
  SELECT author_id INTO v_author
    FROM public.community_answers
   WHERE id = p_answer_id AND is_deleted = FALSE
   FOR UPDATE;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'Answer not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_author <> v_caller AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not your answer' USING ERRCODE = '42501';
  END IF;
  UPDATE public.community_answers
     SET is_deleted = TRUE, deleted_by = v_caller, deleted_at = now()
   WHERE id = p_answer_id;
END
$$;

REVOKE ALL ON FUNCTION public.community_delete_answer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_delete_answer(UUID) TO authenticated;

-- 7. The moderation queue (GET /api/community/admin/reports): every report,
--    and what each one points at, even when that post or answer is already
--    deleted. Private profiles' pseudonyms come from the policy in 4. Every
--    other read of posts with a person's session already filters out
--    deleted rows, so admins' ordinary browsing doesn't change.
DROP POLICY IF EXISTS community_reports_admin_read ON public.community_reports;
CREATE POLICY community_reports_admin_read ON public.community_reports
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS community_posts_admin_read ON public.community_posts;
CREATE POLICY community_posts_admin_read ON public.community_posts
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS community_answers_admin_read ON public.community_answers;
CREATE POLICY community_answers_admin_read ON public.community_answers
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 8. Resolve a report (POST /api/community/admin/reports/[id]/resolve), and
--    optionally remove what it points at or lock the post. The route made up
--    to three writes one after another and, if removing or locking failed,
--    logged it and resolved the report anyway. Here they happen together or
--    not at all, for an admin only.
CREATE OR REPLACE FUNCTION public.community_resolve_report(
  p_report_id     UUID,
  p_status        TEXT,
  p_note          TEXT DEFAULT NULL,
  p_remove_target BOOLEAN DEFAULT FALSE,
  p_lock_post     BOOLEAN DEFAULT FALSE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_report public.community_reports%ROWTYPE;
BEGIN
  IF v_caller IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('resolved_kept', 'resolved_removed', 'resolved_warned') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_report FROM public.community_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_report.status <> 'open' THEN
    RAISE EXCEPTION 'Report already resolved' USING ERRCODE = '55000';
  END IF;

  IF p_remove_target AND v_report.target_type = 'post' THEN
    UPDATE public.community_posts
       SET is_deleted = TRUE, deleted_by = v_caller, deleted_at = now()
     WHERE id = v_report.target_id AND is_deleted = FALSE;
  ELSIF p_remove_target AND v_report.target_type = 'answer' THEN
    UPDATE public.community_answers
       SET is_deleted = TRUE, deleted_by = v_caller, deleted_at = now()
     WHERE id = v_report.target_id AND is_deleted = FALSE;
  END IF;
  IF p_lock_post AND v_report.target_type = 'post' THEN
    UPDATE public.community_posts
       SET is_locked = TRUE, locked_reason = left(p_note, 500), locked_by = v_caller, locked_at = now()
     WHERE id = v_report.target_id;
  END IF;

  UPDATE public.community_reports
     SET status = p_status, resolved_by = v_caller, resolved_at = now(),
         resolution_note = left(p_note, 1000)
   WHERE id = p_report_id;
END
$$;

REVOKE ALL ON FUNCTION public.community_resolve_report(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_resolve_report(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

-- 9. Accept an answer (POST /api/community/posts/[id]/accept), for the post's
--    author or an admin. The function trusted p_acting_user_id, and any
--    signed-in person may execute it, so anyone could call it directly with
--    the author's id (readable on every post) and accept any answer, adding
--    karma and writing the "Solved" lines onto someone else's post. Now the
--    caller's session says who is acting. The id passed in counts only for
--    the service role, so the route still works while it changes over. The
--    signature is unchanged; admins come from admin_users.
CREATE OR REPLACE FUNCTION public.community_accept_answer(
    p_post_id         UUID,
    p_answer_id       UUID,
    p_acting_user_id  UUID,
    p_tldr            TEXT,
    p_key_insight    TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_post_author    UUID;
    v_answer_author  UUID;
    v_answer_post_id UUID;
    v_is_admin       BOOLEAN;
    -- Who is acting: the signed-in caller. p_acting_user_id counts only when
    -- the server calls with the service-role key (the route before STEP 58).
    v_actor          UUID := CASE WHEN auth.role() = 'service_role'
                                  THEN p_acting_user_id ELSE auth.uid() END;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Sign-in required' USING ERRCODE = '28000';
    END IF;

    -- Validate solved metadata up front.
    IF p_tldr IS NULL OR length(trim(p_tldr)) = 0 THEN
        RAISE EXCEPTION 'Solved TLDR is required';
    END IF;
    IF p_key_insight IS NULL OR length(trim(p_key_insight)) = 0 THEN
        RAISE EXCEPTION 'Solved key insight is required';
    END IF;

    -- Load post + answer in a way that locks them for the duration of the txn.
    SELECT author_id INTO v_post_author
      FROM public.community_posts
     WHERE id = p_post_id AND is_deleted = FALSE
     FOR UPDATE;
    IF v_post_author IS NULL THEN
        RAISE EXCEPTION 'Post not found or deleted';
    END IF;

    SELECT author_id, post_id INTO v_answer_author, v_answer_post_id
      FROM public.community_answers
     WHERE id = p_answer_id AND is_deleted = FALSE
     FOR UPDATE;
    IF v_answer_author IS NULL OR v_answer_post_id <> p_post_id THEN
        RAISE EXCEPTION 'Answer not found, deleted, or does not belong to the post';
    END IF;

    -- Permission: post author OR admin (public.admin_users, STEP 55).
    SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_actor)
      INTO v_is_admin;
    IF v_post_author <> v_actor AND COALESCE(v_is_admin, FALSE) = FALSE THEN
        RAISE EXCEPTION 'Only the post author or an admin can accept an answer';
    END IF;

    -- Clear any previously accepted answer on this post.
    UPDATE public.community_answers
       SET is_accepted = FALSE,
           accepted_at = NULL
     WHERE post_id = p_post_id AND is_accepted = TRUE AND id <> p_answer_id;

    -- Accept the new answer.
    UPDATE public.community_answers
       SET is_accepted = TRUE,
           accepted_at = now()
     WHERE id = p_answer_id;

    -- Stamp the post.
    UPDATE public.community_posts
       SET accepted_answer_id = p_answer_id,
           solved_tldr        = p_tldr,
           solved_key_insight = p_key_insight,
           last_activity_at   = now()
     WHERE id = p_post_id;

    -- Karma bonus for an accepted answer (StackOverflow convention: +15).
    IF v_answer_author <> v_post_author THEN
        UPDATE public.community_profiles
           SET karma = karma + 15
         WHERE user_id = v_answer_author;
    END IF;

    -- Auto-grant the problem_solver badge to the answerer (idempotent).
    INSERT INTO public.community_badge_grants (user_id, badge_slug, granted_by)
    VALUES (v_answer_author, 'problem_solver', NULL)
    ON CONFLICT (user_id, badge_slug) DO NOTHING;
END;
$$;


-- STEP 59 — backend/database/migrations/2026_community_vote_identity.sql
-- ==================================================================
-- =====================================================================
-- Tidbits votes: the caller votes as themselves (STEP 59)
--
-- community_cast_vote(p_voter_id, ...) is SECURITY DEFINER, executable by
-- any signed-in person, and recorded the vote as whoever p_voter_id named.
-- So anyone could call it directly and vote as anyone else, once for every
-- account id they know (author ids show on every post). Shown on a local
-- Postgres with the repo's SQL on 8 Oct 2026; not yet verified against
-- production.
--
-- Now the vote is the signed-in caller's. p_voter_id counts only when the
-- server calls with the service-role key, which is how the vote routes call
-- it, so they keep working unchanged. Same signature, so grants stay.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.community_cast_vote(
    p_voter_id     UUID,
    p_target_type  TEXT,
    p_target_id    UUID,
    p_value        SMALLINT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_author UUID;
    -- Who is voting: the signed-in caller. p_voter_id counts only when the
    -- server calls with the service-role key, as the vote routes do.
    v_voter         UUID := CASE WHEN auth.role() = 'service_role'
                                 THEN p_voter_id ELSE auth.uid() END;
BEGIN
    IF v_voter IS NULL THEN
        RAISE EXCEPTION 'Sign-in required' USING ERRCODE = '28000';
    END IF;
    IF p_value NOT IN (-1, 0, 1) THEN
        RAISE EXCEPTION 'Vote value must be -1, 0, or 1';
    END IF;

    -- Identify the target author so we can block self-votes early.
    IF p_target_type = 'post' THEN
        SELECT author_id INTO v_target_author
          FROM public.community_posts WHERE id = p_target_id;
    ELSIF p_target_type = 'answer' THEN
        SELECT author_id INTO v_target_author
          FROM public.community_answers WHERE id = p_target_id;
    ELSE
        RAISE EXCEPTION 'Invalid target_type %', p_target_type;
    END IF;
    IF v_target_author IS NULL THEN
        RAISE EXCEPTION 'Vote target not found';
    END IF;
    IF v_target_author = v_voter THEN
        -- Silent no-op: self-votes are a UX dead-end, not an error.
        RETURN;
    END IF;

    -- Upsert: 0 = retract the vote, +/-1 = set it.
    IF p_value = 0 THEN
        DELETE FROM public.community_votes
         WHERE voter_id = v_voter
           AND target_type = p_target_type
           AND target_id = p_target_id;
    ELSE
        INSERT INTO public.community_votes (voter_id, target_type, target_id, value)
        VALUES (v_voter, p_target_type, p_target_id, p_value)
        ON CONFLICT (voter_id, target_type, target_id)
        DO UPDATE SET value = EXCLUDED.value, created_at = now();
    END IF;
END;
$$;


-- STEP 60 — backend/database/migrations/2026_similar_group_feedback.sql
-- ==================================================================
-- =====================================================================
-- Similar-group feedback: ground truth for Pattern Recognition (STEP 60)
--
-- There are 0 similarity labels (pattern_similarity_labels is unchanged by
-- this). When the feature is on (SIMILAR_GROUP_FEEDBACK_ENABLED), opening the
-- "Found N similar users" banner shows an anonymous summary of the group a
-- plan was matched with: its size, and the conditions at least 3 members
-- share (condition vocabulary, no placeholders, no free text). It then asks
-- "Does this sound like people in a situation similar to yours?". This
-- table keeps the answers (core/similar_group.py).
--
--   member_ids        who the summary described. The backend works this
--                     out from the stored plan; the browser never sends or
--                     sees it.
--   shown_conditions  the vocabulary keys the summary named
--   note              optional, at most 500 characters, for the team to
--                     read. Nothing sends it to an LLM.
--
-- Server-side only: RLS on and no policies, and anon and authenticated have
-- no grants. Only the service role (the backend, the experiment harness)
-- reads or writes it. One row per answer; answering again adds a row, and
-- the harness uses the latest per person and plan.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.similar_group_feedback (
  id               BIGSERIAL   PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id          TEXT        NOT NULL CHECK (length(path_id) BETWEEN 1 AND 100),
  answer           TEXT        NOT NULL CHECK (answer IN ('yes', 'somewhat', 'no')),
  note             TEXT        CHECK (note IS NULL OR length(note) <= 500),
  member_ids       UUID[]      NOT NULL,
  group_size       SMALLINT    NOT NULL CHECK (group_size >= 0),
  shown_conditions TEXT[]      NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS similar_group_feedback_user_idx
  ON public.similar_group_feedback (user_id, path_id, created_at DESC);

ALTER TABLE public.similar_group_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.similar_group_feedback FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.similar_group_feedback_id_seq FROM anon, authenticated;

COMMENT ON TABLE public.similar_group_feedback IS
  'Answers to "Does this sound like people in a situation similar to yours?" about the group behind a plan. Server-side only (core/similar_group.py, STEP 60).';


-- STEP 61 — backend/database/migrations/2026_evaluation_runs.sql
-- ==================================================================
-- =====================================================================
-- Experiment run log for Pattern Recognition (STEP 61)
--
-- One row per run of the experiment harness (scripts/pattern_experiment.py,
-- core/evaluation_runs.py): the script, its git commit, when it started and
-- ended, and the inputs that decide its result:
--   * embeddings, and how many are stale;
--   * the anonymisation text version;
--   * a hash of the condition canonicalisation map;
--   * how many similarity labels there are;
--   * match_threshold, and the run's own settings.
-- Counts and settings only: no user ids, emails or free text.
--
-- Once this is applied, each run writes its row here, unless
-- EVALUATION_RUNS_DSN points it at another database. The run doesn't
-- change any other table. ended_at stays empty for a run that didn't finish.
--
-- Server-side only: RLS on, no policies, no grants to anon or authenticated.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.evaluation_runs (
  run_id      UUID        PRIMARY KEY,
  script      TEXT        NOT NULL CHECK (length(script) BETWEEN 1 AND 200),
  git_commit  TEXT        CHECK (git_commit IS NULL OR length(git_commit) <= 64),
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  inputs      JSONB       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS evaluation_runs_started_idx
  ON public.evaluation_runs (script, started_at DESC);

ALTER TABLE public.evaluation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evaluation_runs FROM anon, authenticated;

COMMENT ON TABLE public.evaluation_runs IS
  'One row per Pattern Recognition experiment run: commit, times, and the inputs that decide its result. No user data (STEP 61).';


-- STEP 62 — backend/database/migrations/2026_onboarding_next_step.sql
-- ==================================================================

-- =====================================================================
-- "Do you know what to do next?" after setup (STEP 62)
--
-- Riipen Labs' cohort report (all 36 teams, September 2026) asked for "one
-- short qualitative question such as 'Did you know what to do next?'" and,
-- against mistaking completion for satisfaction, to "ask whether users
-- understood what to do next". The moderated sessions ask it; people using
-- the app on their own were never asked.
--
-- One more optional answer in the questions after setup (yes, not sure, no),
-- in the same row as the others. The app works before this is applied: the
-- answer is simply not kept (app/api/onboarding-feedback).
--
-- Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.onboarding_feedback
  ADD COLUMN IF NOT EXISTS next_step TEXT CHECK (next_step IN ('yes', 'not_sure', 'no'));

COMMENT ON COLUMN public.onboarding_feedback.next_step IS
  '"Do you know what to do next?" on the page after setup: yes, not_sure or no (STEP 62).';

-- A response may now be this answer alone.
ALTER TABLE public.onboarding_feedback DROP CONSTRAINT IF EXISTS onboarding_feedback_answered;
ALTER TABLE public.onboarding_feedback ADD CONSTRAINT onboarding_feedback_answered CHECK (
  info_before_signup IS NOT NULL OR setup_ease IS NOT NULL OR comment IS NOT NULL OR next_step IS NOT NULL
);

-- STEP 63 — backend/database/migrations/2026_badge_wording.sql
-- ==================================================================
-- =====================================================================
-- Tidbits badges say what earns them (STEP 63)
--
-- Riipen Labs, Group 34 found karma and up-votes unexplained. Tidbits now
-- calls karma "helpful points" and explains the rule (up-votes minus
-- down-votes, plus 15 for each accepted answer). Two badge descriptions
-- disagreed with how they are earned: "Helpful" said "Received 5 upvotes on
-- an answer" but is granted at 25 points, and "Community Pillar" said
-- "karma". Only these two rows change, and only while they still have the
-- old wording. The app works before this is applied: the old text shows.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

UPDATE public.community_badges
   SET description = 'Reached 25 helpful points'
 WHERE slug = 'helpful' AND description = 'Received 5 upvotes on an answer';

UPDATE public.community_badges
   SET description = 'Reached 1,000 helpful points'
 WHERE slug = 'community_pillar' AND description = 'Reached 1000 karma';

-- STEP 64 — backend/database/migrations/2026_profile_privacy.sql
-- ==================================================================
-- =====================================================================
-- Profiles: private by default, public fields through a view (STEP 64)
--
-- Found on 10 October 2026 while building Riipen Labs Group 34's profile
-- and friend card. The read rule on public.profiles ("profiles_read") let
-- anyone see the WHOLE row of a profile that was discoverable, or linked to
-- them by a connection or a pending request: email, date of birth,
-- preferences (which can hold a phone number for text reminders), location,
-- the app journey log and plan. A discoverable row was readable even
-- signed out, with the public key the website ships. The app's screens
-- never showed those fields, but the database API did.
--
-- 1. profiles: a person reads only their own row.
-- 2. public_profiles: what other people may see (name, picture, dream and
--    the new public fields below), for the same rows as before: your own,
--    discoverable ones, and anyone a connection or pending request links you
--    to. It runs with its owner's rights so it can read those rows, and
--    returns only these columns.
-- 3. search_profiles(q): Hare World's people search. Matches a display name
--    or username, or a WHOLE email address; it used to match any part of an
--    email, so searching "gmail" listed everyone discoverable with Gmail.
-- 4. New public profile fields for Group 34's profile page (slide 21) and
--    setup (slide 25): username, pronouns, bio, avatar_url (a photo).
-- 5. An "avatars" storage bucket for profile photos: 2 MB, PNG, JPEG or
--    WebP; each person can only write in, list and remove from their own
--    folder. Anyone with a photo's link can open it.
--
-- The app works before and after this is applied: it reads public_profiles
-- and search_profiles when they exist and falls back otherwise.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- 4. New public fields --------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pronouns   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_.]{3,20}$');
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pronouns_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pronouns_length
  CHECK (pronouns IS NULL OR char_length(pronouns) <= 60);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bio_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_length
  CHECK (bio IS NULL OR char_length(bio) <= 500);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_length
  CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 500);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (username) WHERE username IS NOT NULL;

COMMENT ON COLUMN public.profiles.username IS 'Optional @name other members see: 3-20 of a-z, 0-9, _ and . (STEP 64).';
COMMENT ON COLUMN public.profiles.pronouns IS 'Optional pronouns other members see (STEP 64).';
COMMENT ON COLUMN public.profiles.bio IS 'Optional short bio other members see, up to 500 characters (STEP 64).';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Optional profile photo, in the avatars storage bucket (STEP 64).';

-- 1. Own row only -------------------------------------------------------
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

COMMENT ON POLICY "profiles_read" ON public.profiles IS
  'Your own row only. Other people''s public fields come from public.public_profiles (STEP 64).';

-- 2. What other people may see -------------------------------------------
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT p.id,
       p.display_name,
       p.avatar_emoji,
       p.dream,
       p.full_name,
       p.role,
       p.discoverable,
       p.created_at,
       p.username,
       p.pronouns,
       p.bio,
       p.avatar_url
  FROM public.profiles p
 WHERE p.id = auth.uid()
    OR p.discoverable = TRUE
    OR EXISTS (
         SELECT 1 FROM public.social_connections sc
          WHERE sc.status IN ('connected', 'pending')
            AND (
                  (sc.owner_id = auth.uid() AND sc.target_user_id = p.id)
               OR (sc.target_user_id = auth.uid() AND sc.owner_id = p.id)
                )
       );

COMMENT ON VIEW public.public_profiles IS
  'The public part of a profile, for the rows profiles_read used to allow: your own, discoverable ones, and anyone a connected or pending connection links you to. Runs with its owner''s rights and returns only these columns (STEP 64).';

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 3. People search -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_profiles(q TEXT)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  avatar_emoji TEXT,
  dream TEXT,
  username TEXT,
  pronouns TEXT,
  avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH term AS (
    SELECT ltrim(trim(coalesce(q, '')), '@') AS t
  ), pattern AS (
    SELECT t,
           replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') AS esc
      FROM term
  )
  SELECT p.id, p.display_name, p.avatar_emoji, p.dream, p.username, p.pronouns, p.avatar_url
    FROM public.profiles p, pattern
   WHERE auth.uid() IS NOT NULL
     AND char_length(pattern.t) >= 2
     AND p.discoverable = TRUE
     AND p.id <> auth.uid()
     AND (
           p.display_name ILIKE '%' || pattern.esc || '%'
        OR p.username ILIKE pattern.esc || '%'
        OR lower(p.email) = lower(pattern.t)
         )
   ORDER BY p.display_name NULLS LAST
   LIMIT 20
$$;

COMMENT ON FUNCTION public.search_profiles(TEXT) IS
  'Hare World people search: discoverable profiles by display name, username prefix, or a whole email address. Returns public fields only (STEP 64).';

REVOKE ALL ON FUNCTION public.search_profiles(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(TEXT) TO authenticated;

-- 5. Profile photos ------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Listing and removing your own photos need to read your own folder.
DROP POLICY IF EXISTS "avatars_read_own" ON storage.objects;
CREATE POLICY "avatars_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);


-- STEP 65 — backend/database/migrations/2026_blocks_and_account_deletion.sql
-- ==================================================================
-- =====================================================================
-- Blocking, "friends since", and deleting your own account (STEP 65)
--
-- Riipen Labs, Group 34: a person's card (slide 20) has Block and says how
-- long you have been connected; Your profile (slide 21) has Delete account.
--
-- 1. social_connections.connected_at: when a request was accepted. Rows
--    accepted before this stay empty (nobody recorded it), and the card
--    says when the request was sent instead. Set only by the database.
-- 2. user_blocks and block_user(target). Blocking someone removes every
--    connection and request between you, both ways; hides each of you from
--    the other (public_profiles, search_profiles); and refuses new requests
--    between you (a trigger). Only the person who blocked can see or undo
--    it, and the other person is not told. my_blocked_people() lists them
--    with names, since a block hides the blocked person's profile.
-- 3. delete_my_account(confirm): deletes the signed-in person's account and
--    everything linked to it, straight away. confirm must be 'DELETE';
--    anything else deletes nothing and answers 'not_confirmed', which the
--    app uses to check this is switched on. Team accounts (role admin or
--    moderator) answer 'staff' and are never deleted this way.
-- 4. Reading your own folder of the avatars bucket, which listing and
--    removing your own photos need. (Added to STEP 64 on 10 October too;
--    repeated here for a database that ran STEP 64 before then.)
--
-- Run after STEP 64. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. When you connected ---------------------------------------------------
ALTER TABLE public.social_connections ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

COMMENT ON COLUMN public.social_connections.connected_at IS
  'When the request was accepted (STEP 65). Empty for rows accepted before STEP 65, and for rows that are not connected.';

CREATE OR REPLACE FUNCTION public.stamp_connected_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'connected' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'connected' THEN
      NEW.connected_at := now();
    ELSE
      -- Nobody can rewrite when it happened.
      NEW.connected_at := OLD.connected_at;
    END IF;
  ELSE
    NEW.connected_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_connected_at ON public.social_connections;
CREATE TRIGGER trg_stamp_connected_at
  BEFORE INSERT OR UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.stamp_connected_at();

-- 2. Blocking --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

COMMENT ON TABLE public.user_blocks IS
  'Who blocked whom (STEP 65). Only the blocker can read or delete their rows; rows are added by block_user().';

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_blocks_read_own" ON public.user_blocks;
CREATE POLICY "user_blocks_read_own" ON public.user_blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own" ON public.user_blocks
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

REVOKE ALL ON public.user_blocks FROM anon;
REVOKE INSERT, UPDATE ON public.user_blocks FROM authenticated;
GRANT SELECT, DELETE ON public.user_blocks TO authenticated;

CREATE OR REPLACE FUNCTION public.block_user(target UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;
  IF target IS NULL OR target = me THEN
    RAISE EXCEPTION 'Choose someone else to block' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (me, target)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.social_connections
   WHERE (owner_id = me AND target_user_id = target)
      OR (owner_id = target AND target_user_id = me);
END;
$$;

COMMENT ON FUNCTION public.block_user(UUID) IS
  'Block someone: removes every connection and request between you, both ways, and hides you from each other (STEP 65).';

REVOKE ALL ON FUNCTION public.block_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_blocked_people()
RETURNS TABLE (id UUID, display_name TEXT, avatar_emoji TEXT, blocked_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.blocked_id, p.display_name, p.avatar_emoji, b.created_at
    FROM public.user_blocks b
    LEFT JOIN public.profiles p ON p.id = b.blocked_id
   WHERE b.blocker_id = auth.uid()
   ORDER BY b.created_at DESC
$$;

COMMENT ON FUNCTION public.my_blocked_people() IS
  'The people you blocked, with their display name and picture, so you can unblock them (STEP 65).';

REVOKE ALL ON FUNCTION public.my_blocked_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_blocked_people() TO authenticated;

-- No new connection or request between two people when either blocked the
-- other. The hint says which, for the message the app shows.
CREATE OR REPLACE FUNCTION public.refuse_blocked_connection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.target_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_blocks
              WHERE blocker_id = NEW.owner_id AND blocked_id = NEW.target_user_id) THEN
    RAISE EXCEPTION 'You blocked this person' USING ERRCODE = 'P0001', HINT = 'blocked_by_you';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_blocks
              WHERE blocker_id = NEW.target_user_id AND blocked_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'This person can''t be added' USING ERRCODE = 'P0001', HINT = 'unavailable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refuse_blocked_connection ON public.social_connections;
CREATE TRIGGER trg_refuse_blocked_connection
  BEFORE INSERT OR UPDATE OF target_user_id, owner_id ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_connection();

-- What other people may see (STEP 64), now leaving out anyone either of you
-- blocked.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT p.id,
       p.display_name,
       p.avatar_emoji,
       p.dream,
       p.full_name,
       p.role,
       p.discoverable,
       p.created_at,
       p.username,
       p.pronouns,
       p.bio,
       p.avatar_url
  FROM public.profiles p
 WHERE p.id = auth.uid()
    OR (
         NOT EXISTS (
           SELECT 1 FROM public.user_blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
               OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
         )
     AND (
           p.discoverable = TRUE
        OR EXISTS (
             SELECT 1 FROM public.social_connections sc
              WHERE sc.status IN ('connected', 'pending')
                AND (
                      (sc.owner_id = auth.uid() AND sc.target_user_id = p.id)
                   OR (sc.target_user_id = auth.uid() AND sc.owner_id = p.id)
                    )
           )
         )
       );

COMMENT ON VIEW public.public_profiles IS
  'The public part of a profile, for the rows profiles_read used to allow: your own, discoverable ones, and anyone a connected or pending connection links you to; never someone either of you blocked. Runs with its owner''s rights and returns only these columns (STEP 64, blocks STEP 65).';

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_profiles(q TEXT)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  avatar_emoji TEXT,
  dream TEXT,
  username TEXT,
  pronouns TEXT,
  avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH term AS (
    SELECT ltrim(trim(coalesce(q, '')), '@') AS t
  ), pattern AS (
    SELECT t,
           replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') AS esc
      FROM term
  )
  SELECT p.id, p.display_name, p.avatar_emoji, p.dream, p.username, p.pronouns, p.avatar_url
    FROM public.profiles p, pattern
   WHERE auth.uid() IS NOT NULL
     AND char_length(pattern.t) >= 2
     AND p.discoverable = TRUE
     AND p.id <> auth.uid()
     AND NOT EXISTS (
           SELECT 1 FROM public.user_blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
               OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
         )
     AND (
           p.display_name ILIKE '%' || pattern.esc || '%'
        OR p.username ILIKE pattern.esc || '%'
        OR lower(p.email) = lower(pattern.t)
         )
   ORDER BY p.display_name NULLS LAST
   LIMIT 20
$$;

COMMENT ON FUNCTION public.search_profiles(TEXT) IS
  'Hare World people search: discoverable profiles by display name, username prefix, or a whole email address, leaving out anyone either of you blocked. Returns public fields only (STEP 64, blocks STEP 65).';

REVOKE ALL ON FUNCTION public.search_profiles(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(TEXT) TO authenticated;

-- 3. Deleting your own account -------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_my_account(confirm TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  r RECORD;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = me AND role IN ('admin', 'moderator')) THEN
    RETURN 'staff';
  END IF;
  IF confirm IS DISTINCT FROM 'DELETE' THEN
    RETURN 'not_confirmed';
  END IF;

  -- Tables that hold a person's id without a foreign key, so nothing below
  -- would reach them. Each only if it exists here.
  FOR r IN
    SELECT t.tbl, t.col
      FROM (VALUES
              ('reflections', 'user_id'),
              ('adaptation_outcomes', 'user_id'),
              ('calendar_outcomes', 'user_id'),
              ('pattern_user_embeddings', 'user_id'),
              ('pattern_user_feedback', 'query_user_id'),
              ('pattern_user_feedback', 'retrieved_user_id'),
              ('user_latest_context', 'user_id'),
              ('servicehub_agent_decisions', 'user_id'),
              ('generation_jobs', 'user_id'),
              ('agent_memory', 'user_id'),
              ('user_paths', 'user_id')
           ) AS t(tbl, col)
     WHERE EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema = 'public' AND c.table_name = t.tbl AND c.column_name = t.col)
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col) USING me;
  END LOOP;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'user_latest_context' AND column_name = 'retrieved_user_ids') THEN
    EXECUTE 'UPDATE public.user_latest_context SET retrieved_user_ids = array_remove(retrieved_user_ids, $1) WHERE $1 = ANY (retrieved_user_ids)' USING me;
  END IF;

  -- References with no ON DELETE rule would stop the delete. Clear the
  -- optional ones (who locked, resolved or reviewed something), so other
  -- people's records stay; remove rows that can't exist without the person.
  FOR r IN
    SELECT con.conrelid::regclass AS tbl, att.attname AS col, att.attnotnull AS required
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
       AND con.confdeltype IN ('a', 'r')
       AND array_length(con.conkey, 1) = 1
       AND con.connamespace = 'public'::regnamespace
       AND con.conrelid <> 'public.profiles'::regclass
  LOOP
    IF r.required THEN
      EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING me;
    ELSE
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1', r.tbl, r.col, r.col) USING me;
    END IF;
  END LOOP;

  -- The profile, and with it everything that cascades from it.
  DELETE FROM public.profiles WHERE id = me;

  -- The sign-in itself, and everything that cascades from it. Where this
  -- database role may not touch auth.users, the app finishes with the
  -- admin API.
  BEGIN
    DELETE FROM auth.users WHERE id = me;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 'profile_deleted';
  END;
  RETURN 'deleted';
END;
$$;

COMMENT ON FUNCTION public.delete_my_account(TEXT) IS
  'Deletes the signed-in person''s account and everything linked to it when confirm = ''DELETE''; otherwise deletes nothing and answers not_confirmed. Team accounts answer staff (STEP 65).';

REVOKE ALL ON FUNCTION public.delete_my_account(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(TEXT) TO authenticated;

-- 4. Your own photos -----------------------------------------------------
DROP POLICY IF EXISTS "avatars_read_own" ON storage.objects;
CREATE POLICY "avatars_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);


-- STEP 66 — backend/database/migrations/2026_social_features.sql
-- ==================================================================
-- =====================================================================
-- Hare World's people features, with rules in the database (STEP 66)
--
-- Riipen Labs, Group 34 found that most of Hare World's people features
-- didn't work (slides 8, 19 and 20): messages went to the wrong person and
-- were never shown, the meme feed showed only your own, "Mentor call" was a
-- timer, and mentor tasks, notes of support and working on a race together
-- had nothing behind them. The app now reads and writes these tables as the
-- signed-in person, so the rules below are what keeps them private.
--
-- Everything here is only between two people a connection links (accepted,
-- either direction), never between people where either blocked the other
-- (STEP 65), and has a limit per hour or day against floods.
--
-- 1. messages: chat, and notes of support (kind = 'support'). Each person
--    reads their own conversations; sends as themselves; can unsend what
--    they sent; marks what they received as read (mark_conversation_read).
--    report_message() keeps a copy for the team to review.
-- 2. memes: an emoji or a short text with a caption, for your connections
--    (all of them, or the ones you pick). Likes are counted by the database.
-- 3. video_calls: a call booked with a time and a link to a video room.
--    Either person can cancel it or mark it done (set_call_status).
-- 4. mentor_tasks: someone who chose you as their mentor can be sent small
--    tasks; they accept, decline or tick them off (set_mentor_task_status).
-- 5. race_collabs: invite a connection to work on one of your goals
--    together; they accept or decline (respond_race_collab).
-- 6. block_user() also clears what was waiting between two people: calls
--    still booked, task suggestions and invitations.
--
-- Updates from your people need no table: connected people can already read
-- each other's progress (race_progress) and paths (user_paths).
--
-- The tables in 1 to 3 came from the first schema (database/schema.sql) and
-- were repointed at profiles in STEP 22. Whatever rules they had are removed
-- first, so only these apply.
--
-- Run after STEP 65. Idempotent. Safe to re-run.
-- =====================================================================

-- Helpers ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.connected_pair(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_connections sc
     WHERE sc.status = 'connected'
       AND ((sc.owner_id = a AND sc.target_user_id = b)
         OR (sc.owner_id = b AND sc.target_user_id = a))
  )
$$;

CREATE OR REPLACE FUNCTION public.blocked_pair(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks ub
     WHERE (ub.blocker_id = a AND ub.blocked_id = b)
        OR (ub.blocker_id = b AND ub.blocked_id = a)
  )
$$;

REVOKE ALL ON FUNCTION public.connected_pair(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.blocked_pair(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connected_pair(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blocked_pair(UUID, UUID) TO authenticated;

-- The check every new row between two people goes through.
CREATE OR REPLACE FUNCTION public.check_people_pair(a UUID, b UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF a IS NULL OR b IS NULL OR a = b THEN
    RAISE EXCEPTION 'Choose someone else' USING ERRCODE = 'P0001', HINT = 'not_connected';
  END IF;
  IF public.blocked_pair(a, b) THEN
    RAISE EXCEPTION 'Not available' USING ERRCODE = 'P0001', HINT = 'unavailable';
  END IF;
  IF NOT public.connected_pair(a, b) THEN
    RAISE EXCEPTION 'Only with people you are connected to' USING ERRCODE = 'P0001', HINT = 'not_connected';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_people_pair(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Start from no rules on the old tables.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('messages', 'memes', 'meme_likes', 'video_calls')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- 1. Messages and notes of support ---------------------------------------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'message';
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_kind_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_kind_check CHECK (kind IN ('message', 'support'));

CREATE INDEX IF NOT EXISTS messages_sender_receiver_idx ON public.messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_receiver_unread_idx ON public.messages (receiver_id) WHERE read_at IS NULL;

COMMENT ON COLUMN public.messages.kind IS 'message: chat. support: a note of support (STEP 66).';

CREATE OR REPLACE FUNCTION public.check_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_people_pair(NEW.sender_id, NEW.receiver_id);
  NEW.content := btrim(coalesce(NEW.content, ''));
  IF NEW.content = '' THEN
    RAISE EXCEPTION 'Write something first' USING ERRCODE = 'P0001', HINT = 'empty';
  END IF;
  IF char_length(NEW.content) > (CASE WHEN NEW.kind = 'support' THEN 300 ELSE 2000 END) THEN
    RAISE EXCEPTION 'Too long' USING ERRCODE = 'P0001', HINT = 'too_long';
  END IF;
  IF (SELECT count(*) FROM public.messages
       WHERE sender_id = NEW.sender_id AND created_at > (now() - interval '1 hour')) >= 120 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.created_at := now();
  NEW.read_at := NULL;
  NEW.deleted_at := NULL;
  -- Shown at once. Reports (report_message) go to the team.
  NEW.is_moderated := FALSE;
  NEW.moderation_status := 'approved';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_new_message ON public.messages;
CREATE TRIGGER trg_check_new_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.check_new_message();

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_read_own" ON public.messages
  FOR SELECT TO authenticated
  USING (auth.uid() IN (sender_id, receiver_id) AND deleted_at IS NULL);

CREATE POLICY "messages_send_as_self" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_unsend_own" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(other UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;
  UPDATE public.messages
     SET read_at = now()
   WHERE receiver_id = auth.uid() AND sender_id = other AND read_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.message_reports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       UUID        REFERENCES public.messages(id) ON DELETE SET NULL,
  reporter_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  content_snapshot TEXT,
  reason           TEXT        CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.message_reports IS
  'Messages reported by the person who received them, with a copy of the text, for the team to review (STEP 66).';

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_reports_read" ON public.message_reports;
CREATE POLICY "message_reports_read" ON public.message_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'moderator'))
  );

REVOKE ALL ON public.message_reports FROM anon, authenticated;
GRANT SELECT ON public.message_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.report_message(message UUID, why TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.messages%ROWTYPE;
  report_id UUID;
BEGIN
  SELECT * INTO m FROM public.messages WHERE id = message AND receiver_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'P0001', HINT = 'not_found';
  END IF;
  INSERT INTO public.message_reports (message_id, reporter_id, reported_user_id, content_snapshot, reason)
  VALUES (m.id, auth.uid(), m.sender_id, m.content, left(nullif(btrim(coalesce(why, '')), ''), 500))
  RETURNING id INTO report_id;
  RETURN report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_message(UUID, TEXT) TO authenticated;

-- 2. Memes -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_new_meme()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  person UUID;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'No author' USING ERRCODE = 'P0001', HINT = 'empty';
  END IF;
  -- Pictures would need checking before others see them; emoji and words don't.
  IF NEW.content_type NOT IN ('emoji', 'text') THEN
    RAISE EXCEPTION 'Emoji or text only' USING ERRCODE = 'P0001', HINT = 'type';
  END IF;
  NEW.content := btrim(coalesce(NEW.content, ''));
  NEW.caption := nullif(btrim(coalesce(NEW.caption, '')), '');
  IF NEW.content = '' THEN
    RAISE EXCEPTION 'Write something first' USING ERRCODE = 'P0001', HINT = 'empty';
  END IF;
  IF char_length(NEW.content) > 300 OR char_length(coalesce(NEW.caption, '')) > 200 THEN
    RAISE EXCEPTION 'Too long' USING ERRCODE = 'P0001', HINT = 'too_long';
  END IF;
  NEW.shared_with := coalesce(NEW.shared_with, '{}');
  FOREACH person IN ARRAY NEW.shared_with LOOP
    PERFORM public.check_people_pair(NEW.user_id, person);
  END LOOP;
  IF (SELECT count(*) FROM public.memes
       WHERE user_id = NEW.user_id AND created_at > (now() - interval '1 hour')) >= 30 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.likes := 0;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_new_meme ON public.memes;
CREATE TRIGGER trg_check_new_meme
  BEFORE INSERT ON public.memes
  FOR EACH ROW EXECUTE FUNCTION public.check_new_meme();

ALTER TABLE public.memes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memes_read" ON public.memes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.connected_pair(auth.uid(), user_id)
      AND NOT public.blocked_pair(auth.uid(), user_id)
      AND (cardinality(coalesce(shared_with, '{}')) = 0 OR auth.uid() = ANY (shared_with))
    )
  );

CREATE POLICY "memes_post_as_self" ON public.memes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "memes_delete_own" ON public.memes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.memes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.memes TO authenticated;

ALTER TABLE public.meme_likes ENABLE ROW LEVEL SECURITY;

-- A like is seen with a meme you can see (the memes rule applies inside).
CREATE POLICY "meme_likes_read" ON public.meme_likes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.memes m WHERE m.id = meme_id));

CREATE POLICY "meme_likes_add_own" ON public.meme_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.memes m WHERE m.id = meme_id));

CREATE POLICY "meme_likes_remove_own" ON public.meme_likes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.meme_likes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.meme_likes TO authenticated;

CREATE OR REPLACE FUNCTION public.count_meme_likes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target UUID := coalesce(NEW.meme_id, OLD.meme_id);
BEGIN
  UPDATE public.memes
     SET likes = (SELECT count(*) FROM public.meme_likes WHERE meme_id = target)
   WHERE id = target;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_count_meme_likes ON public.meme_likes;
CREATE TRIGGER trg_count_meme_likes
  AFTER INSERT OR DELETE ON public.meme_likes
  FOR EACH ROW EXECUTE FUNCTION public.count_meme_likes();

-- 3. Calls -------------------------------------------------------------------
ALTER TABLE public.video_calls ADD COLUMN IF NOT EXISTS room_url TEXT;
ALTER TABLE public.video_calls DROP CONSTRAINT IF EXISTS video_calls_room_url_check;
ALTER TABLE public.video_calls ADD CONSTRAINT video_calls_room_url_check
  CHECK (room_url IS NULL OR (room_url ~ '^https://[^[:space:]<>"]+$' AND char_length(room_url) <= 300));

COMMENT ON COLUMN public.video_calls.room_url IS 'The video room for the call: one the app made, or a link the person pasted (STEP 66).';

CREATE OR REPLACE FUNCTION public.check_new_call()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_people_pair(NEW.caller_id, NEW.receiver_id);
  NEW.notes := nullif(btrim(coalesce(NEW.notes, '')), '');
  IF char_length(coalesce(NEW.notes, '')) > 500 THEN
    RAISE EXCEPTION 'Too long' USING ERRCODE = 'P0001', HINT = 'too_long';
  END IF;
  IF (SELECT count(*) FROM public.video_calls
       WHERE caller_id = NEW.caller_id AND created_at > (now() - interval '1 day')) >= 20 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.status := 'scheduled';
  NEW.scheduled_at := coalesce(NEW.scheduled_at, now());
  NEW.started_at := NULL;
  NEW.ended_at := NULL;
  NEW.duration := NULL;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_new_call ON public.video_calls;
CREATE TRIGGER trg_check_new_call
  BEFORE INSERT ON public.video_calls
  FOR EACH ROW EXECUTE FUNCTION public.check_new_call();

ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_calls_read_own" ON public.video_calls
  FOR SELECT TO authenticated
  USING (auth.uid() IN (caller_id, receiver_id));

CREATE POLICY "video_calls_book_as_self" ON public.video_calls
  FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid());

REVOKE ALL ON public.video_calls FROM anon, authenticated;
GRANT SELECT, INSERT ON public.video_calls TO authenticated;

CREATE OR REPLACE FUNCTION public.set_call_status(call UUID, new_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_status NOT IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'Cancel it or mark it done' USING ERRCODE = '22023';
  END IF;
  UPDATE public.video_calls
     SET status = new_status,
         ended_at = CASE WHEN new_status = 'completed' THEN now() ELSE ended_at END
   WHERE id = call AND auth.uid() IN (caller_id, receiver_id) AND status = 'scheduled';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found' USING ERRCODE = 'P0001', HINT = 'not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_call_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_call_status(UUID, TEXT) TO authenticated;

-- 4. Tasks from mentors --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentee_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  note       TEXT        CHECK (note IS NULL OR char_length(note) <= 500),
  due_on     DATE,
  status     TEXT        NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'done', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mentor_tasks_not_self CHECK (mentor_id <> mentee_id)
);

CREATE INDEX IF NOT EXISTS mentor_tasks_mentee_idx ON public.mentor_tasks (mentee_id, status);
CREATE INDEX IF NOT EXISTS mentor_tasks_mentor_idx ON public.mentor_tasks (mentor_id);

COMMENT ON TABLE public.mentor_tasks IS
  'Small tasks a mentor suggests to someone who chose them as a mentor; that person accepts, declines or ticks them off (STEP 66).';

CREATE OR REPLACE FUNCTION public.check_new_mentor_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_people_pair(NEW.mentor_id, NEW.mentee_id);
  -- Only someone the mentee chose as their mentor.
  IF NOT EXISTS (
    SELECT 1 FROM public.social_connections sc
     WHERE sc.owner_id = NEW.mentee_id AND sc.target_user_id = NEW.mentor_id
       AND sc.category = 'mentors' AND sc.status = 'connected'
  ) THEN
    RAISE EXCEPTION 'Only for people who chose you as a mentor' USING ERRCODE = 'P0001', HINT = 'not_mentor';
  END IF;
  NEW.title := btrim(coalesce(NEW.title, ''));
  NEW.note := nullif(btrim(coalesce(NEW.note, '')), '');
  IF (SELECT count(*) FROM public.mentor_tasks
       WHERE mentor_id = NEW.mentor_id AND created_at > (now() - interval '1 day')) >= 30 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.status := 'suggested';
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_new_mentor_task ON public.mentor_tasks;
CREATE TRIGGER trg_check_new_mentor_task
  BEFORE INSERT ON public.mentor_tasks
  FOR EACH ROW EXECUTE FUNCTION public.check_new_mentor_task();

ALTER TABLE public.mentor_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentor_tasks_read_own" ON public.mentor_tasks;
CREATE POLICY "mentor_tasks_read_own" ON public.mentor_tasks
  FOR SELECT TO authenticated
  USING (auth.uid() IN (mentor_id, mentee_id));

DROP POLICY IF EXISTS "mentor_tasks_suggest_as_self" ON public.mentor_tasks;
CREATE POLICY "mentor_tasks_suggest_as_self" ON public.mentor_tasks
  FOR INSERT TO authenticated
  WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "mentor_tasks_remove_own" ON public.mentor_tasks;
CREATE POLICY "mentor_tasks_remove_own" ON public.mentor_tasks
  FOR DELETE TO authenticated
  USING (auth.uid() IN (mentor_id, mentee_id));

REVOKE ALL ON public.mentor_tasks FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.mentor_tasks TO authenticated;

CREATE OR REPLACE FUNCTION public.set_mentor_task_status(task UUID, new_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_status NOT IN ('accepted', 'done', 'declined', 'suggested') THEN
    RAISE EXCEPTION 'Accept, decline or tick it off' USING ERRCODE = '22023';
  END IF;
  UPDATE public.mentor_tasks
     SET status = new_status, updated_at = now()
   WHERE id = task AND mentee_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0001', HINT = 'not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_mentor_task_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_mentor_task_status(UUID, TEXT) TO authenticated;

-- 5. Goals together ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.race_collabs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal         TEXT        NOT NULL CHECK (char_length(goal) BETWEEN 1 AND 200),
  note         TEXT        CHECK (note IS NULL OR char_length(note) <= 300),
  status       TEXT        NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT race_collabs_not_self CHECK (owner_id <> partner_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS race_collabs_once ON public.race_collabs (owner_id, partner_id, lower(goal));
CREATE INDEX IF NOT EXISTS race_collabs_partner_idx ON public.race_collabs (partner_id, status);

COMMENT ON TABLE public.race_collabs IS
  'One of your goals, worked on with a connection who accepted (STEP 66).';

CREATE OR REPLACE FUNCTION public.check_new_race_collab()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_people_pair(NEW.owner_id, NEW.partner_id);
  NEW.goal := btrim(coalesce(NEW.goal, ''));
  NEW.note := nullif(btrim(coalesce(NEW.note, '')), '');
  IF (SELECT count(*) FROM public.race_collabs
       WHERE owner_id = NEW.owner_id AND created_at > (now() - interval '1 day')) >= 20 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.status := 'invited';
  NEW.responded_at := NULL;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_new_race_collab ON public.race_collabs;
CREATE TRIGGER trg_check_new_race_collab
  BEFORE INSERT ON public.race_collabs
  FOR EACH ROW EXECUTE FUNCTION public.check_new_race_collab();

ALTER TABLE public.race_collabs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "race_collabs_read_own" ON public.race_collabs;
CREATE POLICY "race_collabs_read_own" ON public.race_collabs
  FOR SELECT TO authenticated
  USING (auth.uid() IN (owner_id, partner_id));

DROP POLICY IF EXISTS "race_collabs_invite_as_self" ON public.race_collabs;
CREATE POLICY "race_collabs_invite_as_self" ON public.race_collabs
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "race_collabs_leave" ON public.race_collabs;
CREATE POLICY "race_collabs_leave" ON public.race_collabs
  FOR DELETE TO authenticated
  USING (auth.uid() IN (owner_id, partner_id));

REVOKE ALL ON public.race_collabs FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.race_collabs TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_race_collab(collab UUID, accept BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.race_collabs
     SET status = CASE WHEN accept THEN 'accepted' ELSE 'declined' END,
         responded_at = now()
   WHERE id = collab AND partner_id = auth.uid() AND status = 'invited';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0001', HINT = 'not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_race_collab(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_race_collab(UUID, BOOLEAN) TO authenticated;

-- 6. Blocking clears what was waiting ----------------------------------------
CREATE OR REPLACE FUNCTION public.block_user(target UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;
  IF target IS NULL OR target = me THEN
    RAISE EXCEPTION 'Choose someone else to block' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (me, target)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.social_connections
   WHERE (owner_id = me AND target_user_id = target)
      OR (owner_id = target AND target_user_id = me);

  -- What was waiting between the two of you (STEP 66).
  UPDATE public.video_calls SET status = 'cancelled'
   WHERE status = 'scheduled'
     AND ((caller_id = me AND receiver_id = target) OR (caller_id = target AND receiver_id = me));
  DELETE FROM public.mentor_tasks
   WHERE status = 'suggested'
     AND ((mentor_id = me AND mentee_id = target) OR (mentor_id = target AND mentee_id = me));
  DELETE FROM public.race_collabs
   WHERE status = 'invited'
     AND ((owner_id = me AND partner_id = target) OR (owner_id = target AND partner_id = me));
END;
$$;

COMMENT ON FUNCTION public.block_user(UUID) IS
  'Block someone: removes every connection and request between you, both ways, hides you from each other (STEP 65), and clears booked calls, task suggestions and invitations between you (STEP 66).';

REVOKE ALL ON FUNCTION public.block_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;


-- STEP 67 — backend/database/migrations/2026_message_report_review.sql
-- ==================================================================
-- =====================================================================
-- Reviewing reported messages (STEP 67)
--
-- STEP 66 kept a copy of every reported message in message_reports, but
-- nobody could review them except in the database. ResourceHub's admin
-- area now has Reported messages (/admin/messages), where the team reads
-- each report, writes what was done, marks it resolved, and can ban the
-- sender from there.
--
-- 1. message_reports.resolution: what the team did, in a sentence.
-- 2. A banned account (profiles.role = 'banned', set in Admin, then Users)
--    can no longer message, send notes, share memes, book
--    calls, suggest tasks or invite people to goals, and nobody can do those
--    with them. Until now a ban only applied in ResourceHub.
--
-- Run after STEP 66. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. What was done ---------------------------------------------------------
ALTER TABLE public.message_reports ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE public.message_reports DROP CONSTRAINT IF EXISTS message_reports_resolution_length;
ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_resolution_length
  CHECK (resolution IS NULL OR char_length(resolution) <= 500);

COMMENT ON COLUMN public.message_reports.resolution IS
  'What the team did about the report, written when it was resolved (STEP 67).';

CREATE INDEX IF NOT EXISTS message_reports_open_idx
  ON public.message_reports (created_at DESC) WHERE resolved_at IS NULL;

-- 2. A ban applies to Hare World too ---------------------------------------
CREATE OR REPLACE FUNCTION public.check_people_pair(a UUID, b UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF a IS NULL OR b IS NULL OR a = b THEN
    RAISE EXCEPTION 'Choose someone else' USING ERRCODE = 'P0001', HINT = 'not_connected';
  END IF;
  -- Banned by the team (STEP 67). Said the same way as a block, so the other
  -- person isn't told why.
  IF EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id IN (a, b) AND pr.role = 'banned') THEN
    RAISE EXCEPTION 'Not available' USING ERRCODE = 'P0001', HINT = 'unavailable';
  END IF;
  IF public.blocked_pair(a, b) THEN
    RAISE EXCEPTION 'Not available' USING ERRCODE = 'P0001', HINT = 'unavailable';
  END IF;
  IF NOT public.connected_pair(a, b) THEN
    RAISE EXCEPTION 'Only with people you are connected to' USING ERRCODE = 'P0001', HINT = 'not_connected';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_people_pair(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Memes shared with all your connections name nobody, so the check above
-- isn't reached; the meme check says it itself.
CREATE OR REPLACE FUNCTION public.check_new_meme()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  person UUID;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'No author' USING ERRCODE = 'P0001', HINT = 'empty';
  END IF;
  -- Banned by the team (STEP 67): no memes, even for all connections.
  IF EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = NEW.user_id AND pr.role = 'banned') THEN
    RAISE EXCEPTION 'Not available' USING ERRCODE = 'P0001', HINT = 'unavailable';
  END IF;
  -- Pictures would need checking before others see them; emoji and words don't.
  IF NEW.content_type NOT IN ('emoji', 'text') THEN
    RAISE EXCEPTION 'Emoji or text only' USING ERRCODE = 'P0001', HINT = 'type';
  END IF;
  NEW.content := btrim(coalesce(NEW.content, ''));
  NEW.caption := nullif(btrim(coalesce(NEW.caption, '')), '');
  IF NEW.content = '' THEN
    RAISE EXCEPTION 'Write something first' USING ERRCODE = 'P0001', HINT = 'empty';
  END IF;
  IF char_length(NEW.content) > 300 OR char_length(coalesce(NEW.caption, '')) > 200 THEN
    RAISE EXCEPTION 'Too long' USING ERRCODE = 'P0001', HINT = 'too_long';
  END IF;
  NEW.shared_with := coalesce(NEW.shared_with, '{}');
  FOREACH person IN ARRAY NEW.shared_with LOOP
    PERFORM public.check_people_pair(NEW.user_id, person);
  END LOOP;
  IF (SELECT count(*) FROM public.memes
       WHERE user_id = NEW.user_id AND created_at > (now() - interval '1 hour')) >= 30 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.likes := 0;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;


-- STEP 68 — backend/database/migrations/2026_security_hardening.sql
-- ==================================================================
-- =====================================================================
-- Security hardening (STEP 68)
--
-- Items from the October 2026 review that were left open, now closed.
--
-- 1. Connections need consent. The app always sent a request to a real
--    person as 'pending', but the database let a signed-in person insert a
--    row already 'connected' (or 'matched'), or set their own pending request
--    to 'connected', straight through the API. A connection opens the other
--    person's plan, calendar and progress (is_connected_to) and, since STEP
--    66, messages and calls. Now a request to a real person starts pending,
--    and only the person asked can accept it. Cards saved by name (no
--    account behind them) are unchanged. The server (service role) and the
--    SQL editor are trusted, as before.
-- 2. Roles are given by the team. profiles.role is also the "who are you"
--    answer people set in ResourceHub (self advocate, parent, caregiver, and
--    so on), and STEP 55 only stopped people giving themselves 'admin'. Now
--    nobody can give themselves 'admin', 'moderator' or 'banned', or change
--    their role once the team has set one of those: a ban sticks.
-- 3. One admin check. is_admin() was public.admin_users only, while
--    ResourceHub's admin area checked profiles.role = 'admin'. Now either
--    counts. With 2, role 'admin' can only be set by the team.
-- 4. Reported messages are read by admins (is_admin()), not by anyone with
--    role 'moderator', which people could give themselves until 2.
-- 5. Saved plans no longer hold other people. Each plan kept the people
--    Pattern Recognition matched it with (account ids, conditions, goals
--    summary, success rate), and plans are readable by their owner and by
--    connected people through the API. They move to public.plan_matches,
--    which only the server reads (the "people like you" feature, STEP 60);
--    the plan keeps how many there were (similar_users_count). The planning
--    service saves new plans the same way. Someone who deletes their account
--    is taken out of every match list.
--
-- Run after STEP 67. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Connections need consent --------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_connection_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  -- The server and the SQL editor are trusted.
  IF me IS NULL THEN
    RETURN NEW;
  END IF;
  -- A card saved by name has nobody to ask.
  IF NEW.target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'A request to someone starts as pending' USING ERRCODE = 'P0001', HINT = 'pending_only';
    END IF;
    RETURN NEW;
  END IF;

  -- Pointing a row at someone else starts it over.
  IF (NEW.target_user_id IS DISTINCT FROM OLD.target_user_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id)
     AND NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'A request to someone starts as pending' USING ERRCODE = 'P0001', HINT = 'pending_only';
  END IF;

  -- Only the person asked accepts, and only a pending request.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('connected', 'matched') THEN
    IF OLD.status IS DISTINCT FROM 'pending' OR me IS DISTINCT FROM NEW.target_user_id THEN
      RAISE EXCEPTION 'Only the person asked can accept' USING ERRCODE = 'P0001', HINT = 'not_yours';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_connection_consent ON public.social_connections;
CREATE TRIGGER trg_guard_connection_consent
  BEFORE INSERT OR UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_consent();

-- 2. Roles are given by the team ------------------------------------------
-- Same function and trigger as STEP 55, now covering every role the team
-- gives, and keeping it once given.
CREATE OR REPLACE FUNCTION public.protect_profile_admin_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.role IN ('admin', 'moderator', 'banned')
       AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM NEW.role) THEN
      RAISE EXCEPTION 'This role is given by the team, not from a profile.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD.role IN ('admin', 'moderator', 'banned')
       AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'This role was set by the team and can only be changed by the team.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_profile_admin_role ON public.profiles;
CREATE TRIGGER protect_profile_admin_role
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_role();

-- 3. One admin check -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Whether the signed-in caller is an admin: in public.admin_users, or profiles.role = ''admin'' (which only the team can set, STEP 68).';

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 4. Reported messages: admins only ---------------------------------------
DROP POLICY IF EXISTS "message_reports_read" ON public.message_reports;
CREATE POLICY "message_reports_read" ON public.message_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_admin());

-- 5. Saved plans no longer hold other people ------------------------------
CREATE TABLE IF NOT EXISTS public.plan_matches (
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id            TEXT        NOT NULL,
  similar_users      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  retrieved_user_ids JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, path_id)
);

COMMENT ON TABLE public.plan_matches IS
  'The people Pattern Recognition matched each plan with. Server only (no policies); the plan keeps only how many (STEP 68).';

ALTER TABLE public.plan_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_matches FROM anon, authenticated;

-- Move what the saved plans hold. Each step leaves alone anything that isn't
-- the shape it expects. Only plans whose account still exists are copied:
-- production has plans left by deleted accounts (5 on 11 October), and one
-- of them stopped the whole step. Those are still emptied below; there is
-- nobody to keep their matches for. One copy per plan, its last answer.
INSERT INTO public.plan_matches (user_id, path_id, similar_users, retrieved_user_ids)
SELECT DISTINCT ON (up.user_id, up.path_id)
       up.user_id,
       up.path_id,
       CASE WHEN jsonb_typeof(e.r->'result'->'similar_users') = 'array' THEN e.r->'result'->'similar_users' ELSE '[]'::jsonb END,
       CASE WHEN jsonb_typeof(e.r->'result'->'retrieved_user_ids') = 'array' THEN e.r->'result'->'retrieved_user_ids' ELSE '[]'::jsonb END
  FROM public.user_paths up
 CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(up.payload->'agentResponses') = 'array' THEN up.payload->'agentResponses' ELSE '[]'::jsonb END
       ) WITH ORDINALITY AS e(r, ord)
 WHERE up.path_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = up.user_id)
   AND e.r->>'agentId' = 'pattern_recognition'
   AND jsonb_typeof(e.r->'result') = 'object'
   AND (e.r->'result' ? 'similar_users' OR e.r->'result' ? 'retrieved_user_ids')
 ORDER BY up.user_id, up.path_id, e.ord DESC
ON CONFLICT (user_id, path_id) DO UPDATE
  SET similar_users = EXCLUDED.similar_users,
      retrieved_user_ids = EXCLUDED.retrieved_user_ids,
      updated_at = now();

UPDATE public.user_paths up
   SET payload = jsonb_set(
         up.payload,
         '{agentResponses}',
         (SELECT jsonb_agg(
                   CASE
                     WHEN r->>'agentId' = 'pattern_recognition' AND jsonb_typeof(r->'result') = 'object' THEN
                       jsonb_set(r, '{result}',
                         ((r->'result') - 'similar_users' - 'retrieved_user_ids')
                         || jsonb_build_object('similar_users_count',
                              CASE WHEN jsonb_typeof(r->'result'->'similar_users') = 'array'
                                   THEN jsonb_array_length(r->'result'->'similar_users')
                                   ELSE 0 END))
                     ELSE r
                   END
                   ORDER BY ord)
            FROM jsonb_array_elements(up.payload->'agentResponses') WITH ORDINALITY AS e(r, ord)))
 WHERE jsonb_typeof(up.payload->'agentResponses') = 'array'
   AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(up.payload->'agentResponses') AS r
          WHERE r->>'agentId' = 'pattern_recognition'
            AND jsonb_typeof(r->'result') = 'object'
            AND (r->'result' ? 'similar_users' OR r->'result' ? 'retrieved_user_ids'));

-- Someone who deletes their account leaves every match list too. Before
-- this, a deleted person's entry (conditions, goals summary) stayed inside
-- other people's saved plans.
CREATE OR REPLACE FUNCTION public.forget_in_plan_matches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.plan_matches pm
     SET similar_users = coalesce((
           SELECT jsonb_agg(e) FROM jsonb_array_elements(pm.similar_users) AS e
            WHERE coalesce(e->>'user_id', e->>'userId', '') <> OLD.id::text), '[]'::jsonb),
         retrieved_user_ids = coalesce((
           SELECT jsonb_agg(x) FROM jsonb_array_elements(pm.retrieved_user_ids) AS x
            WHERE (x #>> '{}') <> OLD.id::text), '[]'::jsonb),
         updated_at = now()
   WHERE jsonb_typeof(pm.similar_users) = 'array'
     AND jsonb_typeof(pm.retrieved_user_ids) = 'array'
     AND (pm.similar_users::text LIKE '%' || OLD.id::text || '%'
       OR pm.retrieved_user_ids::text LIKE '%' || OLD.id::text || '%');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_forget_in_plan_matches ON public.profiles;
CREATE TRIGGER trg_forget_in_plan_matches
  AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.forget_in_plan_matches();


-- STEP 69 — backend/database/migrations/2026_feedback_and_device.sql
-- ==================================================================
-- =====================================================================
-- Feedback at any time, and phone or computer (STEP 69)
--
-- Riipen Labs, Groups 31 to 33 (September 2026):
--
-- 1. Group 31: "allow first-time users to continue to submit more feedback
--    based off of their own experiences with the app", "what they liked/
--    found overwhelming"; Group 32: "their feedback directly shapes the
--    app". Until now that was an email address, or answering a check-in
--    when the app asked. The glossary (/help#tell-us) now has a short form
--    anyone signed in can use at any time. Its answers are kept with the
--    check-ins (STEP 46) as kind 'feedback', apart from the check-ins the
--    app asks for, so the share who find it useful is not skewed by people
--    who came to tell us something.
--
-- 2. Group 33: "mobile metrics", and setup that works the same on a phone.
--    The funnel's events (STEP 45) record whether the visit was on a phone,
--    a tablet or a computer (from the screen, nothing else), so the funnel
--    report can compare setup and returns by device.
--
-- Until this is applied, feedback is kept as a usefulness check-in and
-- events are kept without the device. Nothing else changes.
--
-- Run after STEP 68. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Feedback at any time ---------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.checkin_responses'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%inactive_email%'
  LOOP
    EXECUTE format('ALTER TABLE public.checkin_responses DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.checkin_responses ADD CONSTRAINT checkin_responses_kind_check
  CHECK (kind IN ('inactive_email', 'welcome_back', 'usefulness', 'feedback'));

COMMENT ON COLUMN public.checkin_responses.kind IS
  'inactive_email and welcome_back: why they stopped; usefulness: the in-app question; feedback: sent from the glossary''s form at any time (STEP 69).';

-- 2. Phone, tablet or computer ---------------------------------------------
ALTER TABLE public.onboarding_events ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE public.onboarding_events DROP CONSTRAINT IF EXISTS onboarding_events_device_check;
ALTER TABLE public.onboarding_events ADD CONSTRAINT onboarding_events_device_check
  CHECK (device IS NULL OR device IN ('phone', 'tablet', 'computer'));

COMMENT ON COLUMN public.onboarding_events.device IS
  'phone, tablet or computer, from the screen width and a touch screen, for the funnel report (STEP 69).';



-- STEP 70 — backend/database/migrations/2026_express_setup.sql
-- ==================================================================
-- =====================================================================
-- Express setup: the tour's tasks, and "was making your account clear and
-- quick?" (STEP 70)
--
-- Riipen Labs, Groups 25 to 30 (September 2026):
--
-- 1. Group 27: the tour should have "prompts that have users complete a
--    task before moving to the next feature", and the employer should
--    "track onboarding completion, drop-off by step, and return usage".
--    The tour now asks for one small thing on each part (open your next
--    step, open the Calendar, pick today's energy, open Display) and sends
--    'tour' events: "start", "task.<id>" when done, "skip.<id>", "finish"
--    and "close". Nothing typed is sent.
--
-- 2. Group 25: "Autinerary could also directly ask beta testers if signup
--    felt clear and quick." One more optional answer in the questions after
--    setup (yes, mostly, no), in the same row as the others.
--
-- The "Complete your profile" card (Groups 29 and 30) needs nothing here:
-- it sends the ask_later events STEP 50 already allows.
--
-- This replaces STEP 51's list of events and keeps every event in it. Until
-- this is applied, tour events are dropped and the new answer is not kept;
-- nothing else changes (app/api/events, app/api/onboarding-feedback).
-- Reported by backend/scripts/onboarding_funnel.py.
--
-- Run after STEP 69. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. The tour's events -------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.onboarding_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%landing_view%'
  LOOP
    EXECUTE format('ALTER TABLE public.onboarding_events DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.onboarding_events
  ADD CONSTRAINT onboarding_events_event_check CHECK (event IN (
    'landing_view', 'signup_view', 'signup_complete',
    'onboarding_step_view', 'onboarding_complete', 'app_open',
    'start_role', 'start_pathway', 'start_open', 'start_useful', 'start_save',
    'feature_use', 'ask_later',
    'rh_visit', 'rh_setup_step', 'rh_setup_complete', 'rh_first_resource',
    'rh_search', 'rh_prompt',
    'tour'
  ));

-- 2. "Was making your account clear and quick?" -----------------------------
ALTER TABLE public.onboarding_feedback
  ADD COLUMN IF NOT EXISTS signup_clear TEXT CHECK (signup_clear IN ('yes', 'mostly', 'no'));

COMMENT ON COLUMN public.onboarding_feedback.signup_clear IS
  '"Was making your account clear and quick?" on the page after setup: yes, mostly or no (STEP 70).';

-- A response may now be this answer alone.
ALTER TABLE public.onboarding_feedback DROP CONSTRAINT IF EXISTS onboarding_feedback_answered;
ALTER TABLE public.onboarding_feedback ADD CONSTRAINT onboarding_feedback_answered CHECK (
  info_before_signup IS NOT NULL OR setup_ease IS NOT NULL OR comment IS NOT NULL
  OR next_step IS NOT NULL OR signup_clear IS NOT NULL
);



-- STEP 71 — backend/database/migrations/2026_paced_setup.sql
-- ==================================================================
-- =====================================================================
-- Paced setup: the energy check-in and Start here's optional questions
-- (STEP 71)
--
-- Riipen Labs, Groups 20 to 24 (September 2026):
--
-- 1. Group 23: "Introduce an initial question asking users to select their
--    current energy level ... so the setup length dynamically adapts to what
--    they can handle in that moment", and compare "completion, time-to-finish,
--    points of confusion, and early engagement" for the shorter and fuller
--    paths. Setup's first step now asks, optionally, how much energy someone
--    has for setting up today, and sends 'setup_energy' with the answer
--    (low, some or plenty).
--
-- 2. Group 21: "a short survey guide ... that asks users 5 targeted simple
--    multiple choice questions and directs them to the most relevant
--    section". Start here asks two; after the starter resources it now offers
--    three more, optional (where you are, how soon, how you like to start), and
--    sends 'start_refine' with the answer (for example "soon.today").
--
-- Nothing typed is sent. This replaces STEP 70's list of events and keeps
-- every event in it. Until this is applied, both new events are dropped and
-- nothing else changes (app/api/events always answers 204). Reported by
-- backend/scripts/onboarding_funnel.py.
--
-- Run after STEP 70. Idempotent. Safe to re-run.
-- =====================================================================

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.onboarding_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%landing_view%'
  LOOP
    EXECUTE format('ALTER TABLE public.onboarding_events DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.onboarding_events
  ADD CONSTRAINT onboarding_events_event_check CHECK (event IN (
    'landing_view', 'signup_view', 'signup_complete',
    'onboarding_step_view', 'onboarding_complete', 'app_open',
    'start_role', 'start_pathway', 'start_open', 'start_useful', 'start_save',
    'feature_use', 'ask_later',
    'rh_visit', 'rh_setup_step', 'rh_setup_complete', 'rh_first_resource',
    'rh_search', 'rh_prompt',
    'tour',
    'setup_energy', 'start_refine'
  ));


-- =====================================================================
-- STEP 72 — backend/database/migrations/2026_schedule_feedback.sql
-- =====================================================================
-- =====================================================================
-- Schedule feedback: "Did this schedule work for you?" (STEP 72)
--
-- Calendar Optimization has nothing to judge a week by: calendar_outcomes
-- and reflections have 0 rows, and the confidence it reported was 0.75 for
-- everyone (docs/reports/calendar-optimization-2026-10-13.md). This asks
-- the person, once per generated schedule, yes or no.
--
-- Same pattern as milestone_ratings (STEP 54): written by the backend
-- (POST /api/schedule-feedback), which checks the schedule is in the
-- person's own path; read back by GET /api/schedule-feedback/{pathId}.
--   * schedule_id: the calendar result's scheduleId, or 'path:<path_id>' for
--     a schedule generated before schedules had ids. path_id is kept too, so
--     an answer can be joined to its path.
--   * Once per schedule: one row per (user_id, schedule_id), never updated.
--     An answer given stands; there is no update policy.
--
-- Behind a flag, off by default: SCHEDULE_FEEDBACK_ENABLED=true on the
-- backend and NEXT_PUBLIC_SCHEDULE_FEEDBACK_ENABLED=true in the app. Until
-- this is applied the route answers that feedback isn't available, and the
-- app shows nothing.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.schedule_feedback (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id      TEXT        NOT NULL CHECK (length(path_id) BETWEEN 1 AND 100),
  schedule_id  TEXT        NOT NULL CHECK (length(schedule_id) BETWEEN 1 AND 120),
  answer       TEXT        NOT NULL CHECK (answer IN ('yes', 'no')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, schedule_id)
);

ALTER TABLE public.schedule_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own schedule feedback" ON public.schedule_feedback;
CREATE POLICY "Read own schedule feedback" ON public.schedule_feedback
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Add own schedule feedback" ON public.schedule_feedback;
CREATE POLICY "Add own schedule feedback" ON public.schedule_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.schedule_feedback IS
  '"Did this schedule work for you?" yes or no, once per generated schedule (STEP 72).';


-- =====================================================================
-- STEP 73 — backend/database/migrations/2026_adaptation_offers.sql
-- =====================================================================
-- =====================================================================
-- Adaptation offers: a suggested change, offered and answered (STEP 73)
--
-- Adaptation never changed anyone's plan: its rules couldn't fire, and no
-- route applied one (8 October audit). It now suggests one change to one
-- milestone at a time, on the Path page, and only the person's Accept
-- changes their stored path (docs/reports/adaptation-2026-10-13.md).
--
-- Every offer and its answer is a row in adaptation_outcomes:
--   * path_id, milestone_id: the step it names (ids repeat across a
--     person's paths, so both);
--   * suggestion_id: fixed by rule, path and milestone, unique per person,
--     so a suggestion is offered once, whatever the answer;
--   * change: what it would change, and the words it was offered with;
--   * offered_at, accepted_at, dismissed_at ("Not now"): one answer at most.
-- rule_fired holds the rule's name, as for the rows before.
--
-- close_adaptation_loop credited every unresolved row of the last 14 days
-- with the next journal entry's reward. Offers are not fired adaptations,
-- so it now leaves them out.
--
-- Written by the backend only (api/routes/adaptations.py), as before: RLS
-- stays on with no policies. Off unless ADAPTATION_OFFERS_ENABLED=true on
-- the backend and NEXT_PUBLIC_ADAPTATION_OFFERS_ENABLED=true in the app;
-- until this is applied the route says offers aren't available.
--
-- Run after STEP 71. Independent of STEP 72 (schedule feedback), which may come
-- before or after it. Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.adaptation_outcomes
  ADD COLUMN IF NOT EXISTS path_id        TEXT,
  ADD COLUMN IF NOT EXISTS milestone_id   TEXT,
  ADD COLUMN IF NOT EXISTS suggestion_id  TEXT,
  ADD COLUMN IF NOT EXISTS change         JSONB,
  ADD COLUMN IF NOT EXISTS offered_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_at   TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS adaptation_outcomes_offer_once
  ON public.adaptation_outcomes (user_id, suggestion_id)
  WHERE suggestion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS adaptation_outcomes_offers_by_path
  ON public.adaptation_outcomes (user_id, path_id)
  WHERE suggestion_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adaptation_outcomes_one_answer') THEN
    ALTER TABLE public.adaptation_outcomes
      ADD CONSTRAINT adaptation_outcomes_one_answer CHECK (accepted_at IS NULL OR dismissed_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adaptation_outcomes_offer_named') THEN
    ALTER TABLE public.adaptation_outcomes
      ADD CONSTRAINT adaptation_outcomes_offer_named
      CHECK (suggestion_id IS NULL OR (path_id IS NOT NULL AND milestone_id IS NOT NULL AND offered_at IS NOT NULL));
  END IF;
END $$;

-- The journal's reward loop: unchanged, except that offers are left out.
CREATE OR REPLACE FUNCTION public.close_adaptation_loop(
  user_id_in UUID,
  reward_in  REAL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE public.adaptation_outcomes
     SET next_reflection_reward = reward_in,
         outcome_resolved_at    = NOW()
   WHERE user_id = user_id_in
     AND next_reflection_reward IS NULL
     AND suggestion_id IS NULL
     AND created_at > NOW() - INTERVAL '14 days';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON COLUMN public.adaptation_outcomes.suggestion_id IS
  'An offered change (STEP 73): fixed by rule, path and milestone; offered once per person.';


-- =====================================================================
-- STEP 74 — backend/database/migrations/2026_adaptation_helped.sql
-- =====================================================================
-- =====================================================================
-- Adaptation offers: "Did that help?", twice (STEP 74)
--
-- After someone accepts a suggested change (STEP 73), the Path asks once,
-- yes or no, whether it helped; and once more on their first visit to the
-- Path at least 7 days after accepting. No scheduled job: the backend works
-- out which question is due when the Path asks for its suggestions
-- (api/routes/adaptations.py). Both answers are kept on the offer's row.
--
--   helped_first, helped_first_at    the answer after accepting
--   helped_second, helped_second_at  the answer 7 days or more later
--
-- Only an accepted offer can have an answer. Written by the backend only.
-- Off unless ADAPTATION_OFFERS_ENABLED=true and
-- NEXT_PUBLIC_ADAPTATION_OFFERS_ENABLED=true.
--
-- Run after STEP 73. Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.adaptation_outcomes
  ADD COLUMN IF NOT EXISTS helped_first      TEXT,
  ADD COLUMN IF NOT EXISTS helped_first_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS helped_second     TEXT,
  ADD COLUMN IF NOT EXISTS helped_second_at  TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adaptation_outcomes_helped_answers') THEN
    ALTER TABLE public.adaptation_outcomes
      ADD CONSTRAINT adaptation_outcomes_helped_answers
      CHECK ((helped_first IS NULL OR helped_first IN ('yes', 'no'))
         AND (helped_second IS NULL OR helped_second IN ('yes', 'no')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adaptation_outcomes_helped_after_accept') THEN
    ALTER TABLE public.adaptation_outcomes
      ADD CONSTRAINT adaptation_outcomes_helped_after_accept
      CHECK ((helped_first IS NULL AND helped_second IS NULL) OR accepted_at IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.adaptation_outcomes.helped_second IS
  '"Did it help?" asked again on the first Path visit 7 or more days after accepting (STEP 74).';


-- =====================================================================
-- STEP 75 — backend/database/migrations/2026_tidbits_content_notes.sql
-- =====================================================================
-- =====================================================================
-- Tidbits: a content note on a post (STEP 75)
--
-- Riipen Labs, Group 15 (September 2026): "Visible safety signals in
-- community spaces: clear moderation policy, content warnings, and an easy
-- report path, especially for first-time posters".
--
-- A post about something hard can carry one note, from a fixed list
-- (servicehub-mvp/lib/community/contentNotes.ts). Readers see the note
-- first; the post and its answers open only when they choose, and the feed
-- shows the note instead of the post's first lines.
--
-- Posts are written by ResourceHub's server (service role), as before; RLS
-- is unchanged. Until this is applied, a post asked with a note is saved
-- without it, and nothing else changes.
--
-- STEPs 72 to 74 (schedule feedback, adaptation offers) came with the
-- agent work, merged on 15 October; this one does not depend on them.
-- Run after STEP 71. Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS content_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_content_note_check') THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_content_note_check
      CHECK (content_note IS NULL OR content_note IN ('self_harm', 'abuse', 'crisis', 'medical', 'food', 'loss', 'other'));
  END IF;
END $$;

COMMENT ON COLUMN public.community_posts.content_note IS
  'A content note the author chose (STEP 75): readers see it first and open the post when they choose.';

-- =====================================================================
-- STEP 76 — backend/database/migrations/2026_early_checkin.sql
-- =====================================================================
-- =====================================================================
-- The day-3 check-in (STEP 76)
--
-- Riipen Labs, Group 12 (September 2026): "Trigger quick micro-surveys on
-- Day 3 and Day 7 to gather actionable product feedback during the user's
-- initial 7-14 day experience." Day 7 is the existing usefulness question
-- (STEP 46). Day 3 is new: the Path asks, once, how it is going and what, if
-- anything, is in the way (components/CheckinPrompt.tsx), and offers a
-- change matched to the answer, as the other check-ins do (lib/checkin.ts).
--
-- Its answers are kept with the other check-ins (STEP 46) as kind 'early'.
-- Two of its answers are new: 'going_fine' ("It's going well") and
-- 'unclear_next' ("I'm not sure what to do next"). The rest are the stop
-- reasons already allowed.
--
-- Until this is applied, a day-3 answer is kept as a usefulness check-in
-- whose comment starts "Day 3 check-in:", and the funnel report counts it
-- as day 3. Nothing else changes.
--
-- Run after STEP 75. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. The kind ---------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.checkin_responses'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%inactive_email%'
  LOOP
    EXECUTE format('ALTER TABLE public.checkin_responses DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.checkin_responses ADD CONSTRAINT checkin_responses_kind_check
  CHECK (kind IN ('inactive_email', 'welcome_back', 'usefulness', 'feedback', 'early'));

-- 2. The answers ------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.checkin_responses'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%not_what_i_needed%'
  LOOP
    EXECUTE format('ALTER TABLE public.checkin_responses DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.checkin_responses ADD CONSTRAINT checkin_responses_reason_check
  CHECK (reason IN (
    'too_much', 'not_what_i_needed', 'hard_to_find', 'no_time',
    'not_useful_yet', 'just_exploring', 'other',
    'going_fine', 'unclear_next'
  ));

COMMENT ON COLUMN public.checkin_responses.kind IS
  'inactive_email, welcome_back, usefulness (asked in the app from day 7, or the day-14 email), feedback (the glossary form, STEP 69), early (asked in the app on days 3 to 6, STEP 76).';

-- =====================================================================
-- STEP 77 — backend/database/migrations/2026_resource_search_scale.sql
-- =====================================================================
-- =====================================================================
-- ResourceHub search for tens of thousands of places (STEP 77)
--
-- The team's planning note (October 2026), Goal 0: up to 50,000 more
-- services in Ontario, domain-specific (diagnosis, therapists, doctors,
-- riding and animal programs, swimming, job training and hiring) and
-- general (study spots, cafés, zoos, amusement parks, restaurants, hotels,
-- banks), shown on every ResourceHub that reads this database.
--
-- Search read every matching place into the app's server and sorted there,
-- capped at 20,000 matches in id order. With about 60,000 places a broad
-- search would have ranked and counted an arbitrary third of them, and
-- nearby places could have been missing. This moves the work into the
-- database:
--
--   1. search_resource_page(p jsonb): the same filters, the same order
--      (near first, then the chosen sort) and the same counts as
--      servicehub-mvp/lib/supabase/queries.ts, one page at a time. Runs
--      with the caller's rights, so row-level security still applies.
--   2. A trigram index over each approved place's name, description and
--      category, which the text filters use.
--   3. resource_categories(): the category list, every category however
--      many places there are (it was read 1,000 rows at a time, to 20,000).
--   4. resources.import_batch: which bulk import added a row, so a batch can
--      be found, checked and, if needed, hidden again (status 'rejected');
--      nothing is deleted.
--   5. resources.geo_lat, geo_lng and geo_province: the map point and the
--      province from the location, kept as columns the database works out
--      when a row is written, so distance is plain arithmetic at search time.
--   6. The team columns on saved_resources (calls_scheduled, contract_sent,
--      added_to_team_at), from servicehub-mvp/scripts/add-build-team-fields.sql,
--      which never reached this runbook. "Add to my team" and "Sign them on"
--      use them (the planning note's three clicks). Nothing if they are there.
--
-- Until this is applied, ResourceHub searches the way it did, and nothing
-- else changes. Run after STEP 76. Idempotent. Safe to re-run.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 4. The import batch -------------------------------------------------------
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS import_batch TEXT;

CREATE INDEX IF NOT EXISTS resources_import_batch_idx
  ON public.resources (import_batch)
  WHERE import_batch IS NOT NULL;

COMMENT ON COLUMN public.resources.import_batch IS
  'Which bulk import added this row (e.g. ontario-2026-10), so the batch can be found and, if needed, hidden again (STEP 77). Empty for everything else.';

-- 2. The text index ---------------------------------------------------------
-- The same expression search_resource_page() matches against, written the
-- same way, so the planner can use it.
CREATE INDEX IF NOT EXISTS resources_search_trgm_idx
  ON public.resources
  USING gin ((lower(coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))) gin_trgm_ops)
  WHERE status = 'approved';

-- Provinces, as servicehub-mvp/lib/places/province.ts compares them:
-- "Ontario", "ON" and "on." are the same place. Defined before the columns
-- that use it.
CREATE OR REPLACE FUNCTION public.province_key(v TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN x IS NULL OR x = '' THEN NULL
    WHEN x IN ('ab', 'alberta') THEN 'AB'
    WHEN x IN ('bc', 'british columbia', 'colombie-britannique') THEN 'BC'
    WHEN x IN ('mb', 'manitoba') THEN 'MB'
    WHEN x IN ('nb', 'new brunswick', 'nouveau-brunswick') THEN 'NB'
    WHEN x IN ('nl', 'newfoundland and labrador', 'newfoundland', 'labrador', 'terre-neuve-et-labrador') THEN 'NL'
    WHEN x IN ('ns', 'nova scotia', 'nouvelle-écosse') THEN 'NS'
    WHEN x IN ('nt', 'northwest territories', 'territoires du nord-ouest') THEN 'NT'
    WHEN x IN ('nu', 'nunavut') THEN 'NU'
    WHEN x IN ('on', 'ontario') THEN 'ON'
    WHEN x IN ('pe', 'prince edward island', 'pei', 'île-du-prince-édouard') THEN 'PE'
    WHEN x IN ('qc', 'quebec', 'québec') THEN 'QC'
    WHEN x IN ('sk', 'saskatchewan') THEN 'SK'
    WHEN x IN ('yt', 'yukon', 'yukon territory') THEN 'YT'
    ELSE x
  END
  FROM (SELECT regexp_replace(lower(btrim(v)), '\.$', '') AS x) n
$$;

-- 5. The map point and province, worked out when a row is written ----------
-- A coordinate that is missing, not a number, or 0 counts as no point, as in
-- the app (calculateDistance is only used when lat and lng are set).
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS geo_lat DOUBLE PRECISION GENERATED ALWAYS AS (
    CASE WHEN (location->>'lat') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN nullif((location->>'lat')::double precision, 0) END
  ) STORED,
  ADD COLUMN IF NOT EXISTS geo_lng DOUBLE PRECISION GENERATED ALWAYS AS (
    CASE WHEN (location->>'lng') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN nullif((location->>'lng')::double precision, 0) END
  ) STORED,
  ADD COLUMN IF NOT EXISTS geo_province TEXT GENERATED ALWAYS AS (public.province_key(location->>'province')) STORED;

COMMENT ON COLUMN public.resources.geo_lat IS 'location.lat as a number, or empty when there is no usable point (STEP 77).';
COMMENT ON COLUMN public.resources.geo_lng IS 'location.lng as a number, or empty when there is no usable point (STEP 77).';
COMMENT ON COLUMN public.resources.geo_province IS 'location.province as a comparable key, ON for Ontario (STEP 77).';

-- 1. One page of search results ---------------------------------------------
-- p (all optional):
--   groups        [[term, ...], ...]  every group must match: any of its terms
--                                      in the name, description or category
--   soft          [term, ...]          count towards relevance only
--   categories    [text]               category, ignoring case
--   age_ranges    [text]               serves any of these
--   first_party   boolean              Autinerary's own
--   source_types  [text]
--   min_price, max_price
--   life          [keyword]            any of a life area's keywords
--   cond_keys     [text], cond_ids [uuid]   a condition: in the text, or rated for it
--   allowed       [uuid]               narrowed by ratings (minimum, norms, raters)
--   lat, lng, province, radius_km, max_km, near_first
--   sort          [{key, direction}]   relevance, rating, reviews, distance, newest, cost
--   offset, limit
-- Returns {total, near_count, rows: [{id, distance, avg, n}]}.
CREATE OR REPLACE FUNCTION public.search_resource_page(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  hay CONSTANT TEXT := 'lower(coalesce(r.name, '''') || '' '' || coalesce(r.description, '''') || '' '' || coalesce(r.category, ''''))';
  w TEXT[];
  g JSONB;
  t TEXT;
  ors TEXT[];
  all_terms TEXT[] := '{}';
  score TEXT := '0';
  ord TEXT[] := '{}';
  rule JSONB;
  dir TEXT;
  lat DOUBLE PRECISION := CASE WHEN jsonb_typeof(p->'lat') = 'number' THEN (p->>'lat')::double precision END;
  lng DOUBLE PRECISION := CASE WHEN jsonb_typeof(p->'lng') = 'number' THEN (p->>'lng')::double precision END;
  radius DOUBLE PRECISION := coalesce(CASE WHEN jsonb_typeof(p->'radius_km') = 'number' THEN (p->>'radius_km')::double precision END, 50);
  max_km DOUBLE PRECISION := CASE WHEN jsonb_typeof(p->'max_km') = 'number' THEN (p->>'max_km')::double precision END;
  prov TEXT := public.province_key(p->>'province');
  near_first BOOLEAN := coalesce((p->>'near_first')::boolean, false) AND lat IS NOT NULL AND lng IS NOT NULL;
  lim INTEGER := least(greatest(coalesce((p->>'limit')::integer, 20), 1), 100);
  off INTEGER := least(greatest(coalesce((p->>'offset')::integer, 0), 0), 100000);
  categories TEXT[];
  ages TEXT[];
  sources TEXT[];
  cond_ids UUID[];
  allowed UUID[];
  min_price NUMERIC := CASE WHEN jsonb_typeof(p->'min_price') = 'number' THEN (p->>'min_price')::numeric END;
  max_price NUMERIC := CASE WHEN jsonb_typeof(p->'max_price') = 'number' THEN (p->>'max_price')::numeric END;
  result JSONB;

  -- A search term as the app cleans it (lib/search/words.ts): lower case,
  -- letters, digits, spaces, apostrophes, hyphens and underscores.
  clean TEXT;
BEGIN
  w := ARRAY[format('r.status = %L', CASE WHEN p->>'status' = 'pending' THEN 'pending' ELSE 'approved' END)];

  -- Text groups: each must match.
  FOR g IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'groups') = 'array' THEN p->'groups' ELSE '[]'::jsonb END)
  LOOP
    ors := '{}';
    FOR t IN SELECT value FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g) = 'array' THEN g ELSE '[]'::jsonb END)
    LOOP
      clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
      CONTINUE WHEN clean = '';
      ors := ors || format('%s LIKE %L', hay, '%' || clean || '%');
      all_terms := all_terms || clean;
    END LOOP;
    IF array_length(ors, 1) > 0 THEN
      w := w || ('(' || array_to_string(ors, ' OR ') || ')');
    END IF;
  END LOOP;

  FOR t IN SELECT value FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'soft') = 'array' THEN p->'soft' ELSE '[]'::jsonb END)
  LOOP
    clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
    CONTINUE WHEN clean = '';
    all_terms := all_terms || clean;
  END LOOP;

  -- Relevance: each term in the name 10, in the description 5, as the app scores it.
  FOR t IN SELECT DISTINCT unnest(all_terms)
  LOOP
    score := score || format(' + (CASE WHEN lower(r.name) LIKE %1$L THEN 10 ELSE 0 END) + (CASE WHEN lower(coalesce(r.description, '''')) LIKE %1$L THEN 5 ELSE 0 END)', '%' || t || '%');
  END LOOP;

  IF jsonb_typeof(p->'categories') = 'array' AND jsonb_array_length(p->'categories') > 0 THEN
    SELECT array_agg(value) INTO categories FROM jsonb_array_elements_text(p->'categories');
    w := w || 'r.category ILIKE ANY ($3)'::text;
  END IF;
  IF jsonb_typeof(p->'age_ranges') = 'array' AND jsonb_array_length(p->'age_ranges') > 0 THEN
    SELECT array_agg(value) INTO ages FROM jsonb_array_elements_text(p->'age_ranges');
    w := w || 'r.age_ranges && $4'::text;
  END IF;
  IF coalesce((p->>'first_party')::boolean, false) THEN
    w := w || 'r.is_first_party'::text;
  END IF;
  IF jsonb_typeof(p->'source_types') = 'array' AND jsonb_array_length(p->'source_types') > 0 THEN
    SELECT array_agg(value) INTO sources FROM jsonb_array_elements_text(p->'source_types');
    w := w || 'r.source_type = ANY ($5)'::text;
  END IF;

  -- Price: a place with no price is shown unless a minimum above 0 is set.
  IF min_price IS NOT NULL AND min_price > 0 THEN
    w := w || format('r.price >= %s', min_price);
    IF max_price IS NOT NULL THEN w := w || format('r.price <= %s', max_price); END IF;
  ELSIF max_price IS NOT NULL THEN
    w := w || format('(r.price IS NULL OR r.price <= %s)', max_price);
  END IF;

  -- A life area: any of its keywords.
  IF jsonb_typeof(p->'life') = 'array' AND jsonb_array_length(p->'life') > 0 THEN
    ors := '{}';
    FOR t IN SELECT value FROM jsonb_array_elements_text(p->'life')
    LOOP
      clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
      CONTINUE WHEN clean = '';
      ors := ors || format('%s LIKE %L', hay, '%' || clean || '%');
    END LOOP;
    IF array_length(ors, 1) > 0 THEN w := w || ('(' || array_to_string(ors, ' OR ') || ')'); END IF;
  END IF;

  -- A condition: in the place's text, or among the norms it was rated for.
  IF jsonb_typeof(p->'cond_keys') = 'array' AND jsonb_array_length(p->'cond_keys') > 0 THEN
    ors := '{}';
    FOR t IN SELECT value FROM jsonb_array_elements_text(p->'cond_keys')
    LOOP
      clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
      CONTINUE WHEN clean = '';
      ors := ors || format('%s LIKE %L', hay, '%' || clean || '%');
    END LOOP;
    IF jsonb_typeof(p->'cond_ids') = 'array' AND jsonb_array_length(p->'cond_ids') > 0 THEN
      SELECT array_agg(value::uuid) INTO cond_ids FROM jsonb_array_elements_text(p->'cond_ids');
      ors := ors || 'r.id = ANY ($6)'::text;
    END IF;
    IF array_length(ors, 1) > 0 THEN w := w || ('(' || array_to_string(ors, ' OR ') || ')'); END IF;
  END IF;

  -- Narrowed by ratings. An empty list means nothing matches.
  IF jsonb_typeof(p->'allowed') = 'array' THEN
    SELECT coalesce(array_agg(value::uuid), '{}') INTO allowed FROM jsonb_array_elements_text(p->'allowed');
    w := w || 'r.id = ANY ($7)'::text;
  END IF;

  -- Order: near first when asked, then each sort rule, then id.
  IF near_first THEN
    ord := ord || 'near_group'::text || 'CASE WHEN near_group = 1 THEN no_province::int END'::text || 'distance ASC NULLS LAST'::text;
  END IF;
  FOR rule IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'sort') = 'array' THEN p->'sort' ELSE '[{"key": "relevance", "direction": "desc"}]'::jsonb END)
  LOOP
    dir := CASE WHEN rule->>'direction' = 'asc' THEN 'ASC' ELSE 'DESC' END;
    CASE rule->>'key'
      WHEN 'cost' THEN ord := ord || ('price ' || dir || ' NULLS LAST');
      WHEN 'rating' THEN ord := ord || ('avg_rating ' || dir) || 'n DESC'::text;
      WHEN 'reviews' THEN ord := ord || ('n ' || dir);
      WHEN 'distance' THEN ord := ord || (CASE WHEN dir = 'ASC' THEN 'distance ASC NULLS LAST' ELSE 'distance DESC NULLS FIRST' END);
      WHEN 'newest' THEN ord := ord || ('created_at ' || dir);
      ELSE ord := ord || ('score ' || dir) || 'n DESC'::text;
    END CASE;
  END LOOP;
  ord := ord || 'id'::text;

  EXECUTE format($q$
    WITH s AS (
      SELECT resource_id, avg(overall_score)::double precision AS avg_rating, count(*)::int AS n
      FROM public.ratings
      GROUP BY resource_id
    ),
    m AS (
      SELECT r.id,
             (%1$s) + coalesce(s.avg_rating, 0) AS score,
             coalesce(s.avg_rating, 0) AS avg_rating,
             coalesce(s.n, 0) AS n,
             r.price,
             r.created_at,
             d.distance,
             r.geo_province IS NULL AS no_province,
             CASE
               WHEN d.distance IS NOT NULL THEN CASE WHEN d.distance <= $8 THEN 0 ELSE 2 END
               WHEN r.geo_province IS NULL THEN 1
               WHEN $9::text IS NOT NULL AND r.geo_province = $9::text THEN 1
               ELSE 2
             END AS near_group
      FROM public.resources r
      LEFT JOIN s ON s.resource_id = r.id
      CROSS JOIN LATERAL (
        SELECT CASE
          WHEN $1::double precision IS NULL OR $2::double precision IS NULL OR r.geo_lat IS NULL OR r.geo_lng IS NULL THEN NULL
          ELSE 6371 * 2 * asin(least(1, sqrt(
            power(sin(radians((r.geo_lat - $1::double precision) / 2)), 2)
            + cos(radians($1::double precision)) * cos(radians(r.geo_lat))
              * power(sin(radians((r.geo_lng - $2::double precision) / 2)), 2)
          )))
        END AS distance
      ) d
      WHERE %2$s
    ),
    k AS (
      SELECT m.*, row_number() OVER (ORDER BY %3$s) AS ord
      FROM m
      WHERE $10::double precision IS NULL OR m.distance IS NULL OR m.distance <= $10::double precision
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM k),
      'near_count', (SELECT count(*) FROM k WHERE k.near_group = 0),
      'rows', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', k.id, 'distance', k.distance, 'avg', k.avg_rating, 'n', k.n) ORDER BY k.ord)
        FROM k WHERE k.ord > $11 AND k.ord <= $11 + $12
      ), '[]'::jsonb)
    )
  $q$, score, array_to_string(w, ' AND '), array_to_string(ord, ', '))
  INTO result
  USING lat, lng, categories, ages, sources, cond_ids, allowed, radius, prov, max_km, off, lim;

  RETURN result;
END
$fn$;

COMMENT ON FUNCTION public.search_resource_page(JSONB) IS
  'One page of ResourceHub search results: the filters, near-first order and counts of servicehub-mvp/lib/supabase/queries.ts, done in the database for tens of thousands of places. Runs with the caller''s rights (STEP 77).';

GRANT EXECUTE ON FUNCTION public.search_resource_page(JSONB) TO anon, authenticated;

-- 3. The category list ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resource_categories()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT category FROM public.resources
  WHERE status = 'approved' AND category IS NOT NULL AND category <> ''
  ORDER BY 1
$$;

COMMENT ON FUNCTION public.resource_categories() IS
  'Every category among approved places, for ResourceHub''s filter list (STEP 77).';

GRANT EXECUTE ON FUNCTION public.resource_categories() TO anon, authenticated;

-- 6. The team columns -------------------------------------------------------
ALTER TABLE public.saved_resources
  ADD COLUMN IF NOT EXISTS calls_scheduled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS added_to_team_at TIMESTAMPTZ;

COMMENT ON COLUMN public.saved_resources.calls_scheduled IS
  'A first meeting is booked, or to be booked: set by "Add to my team" or by hand in Build a Team (STEP 77).';
COMMENT ON COLUMN public.saved_resources.added_to_team_at IS
  'When they were signed on (status current) (STEP 77).';

-- =====================================================================
-- STEP 78 — backend/database/migrations/2026_service_directory_tags.sql
-- =====================================================================
-- =====================================================================
-- The service directory's tags and fields (STEP 78)
--
-- The team's planning note (October 2026), "Goal 1: Service Directory":
-- education levels from daycare to a PhD, free or paid on every service with
-- its cost in its own currency, "requires a diagnosis", "provides medical
-- diagnosis", funding resources, new to the country or city, the age of a
-- service, community groups (local, in person, online), charities, advocacy,
-- respite care, recreation, career levels, adulting, parenting; "already
-- read" for articles; "self-diagnosed" as a connection to a norm; and Spot
-- Guides, who review what the service-adding loop finds.
--
--   1. resources.tags: the tags, from one vocabulary
--      (servicehub-mvp/lib/filters/tags.ts), with an index.
--   2. resources.cost_type ('free' or 'paid'), cost_source ('listed': the
--      place or its operator says so; 'usual': what that kind of place
--      usually is), and currency (the price's currency, CAD in Canada).
--      price stays the amount.
--   3. resources.delivery ('in_person', 'online' or 'both') and started_on
--      (when the service began, when known).
--   4. Every existing place gets free or paid and its currency from its
--      category (and from its price when it has one), places on the map are
--      in person, and tags that their kind and name make plain (a daycare,
--      a secondary school, an employment service, a support group, a park).
--      Nothing else is changed, and a place that already has them is left.
--   5. resource_reads: which articles each person has opened, for "Already
--      read". Each person sees and writes only their own.
--   6. 'self_diagnosed' as a connection to a norm, weighed as lived
--      experience, like the others who are not formally diagnosed.
--   7. spot_guides and is_spot_guide(): who may review the places the
--      service-adding loop finds (admins may too).
--   8. search_resource_page() understands tags, free or paid, online, and the
--      age of a service.
--
-- Run after STEP 77. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Tags --------------------------------------------------------------------
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS resources_tags_idx ON public.resources USING gin (tags);

COMMENT ON COLUMN public.resources.tags IS
  'What the service is or offers, from servicehub-mvp/lib/filters/tags.ts (edu_daycare, funding, requires_diagnosis, ...). Never what it is like for someone with a norm: that comes from ratings (STEP 78).';

-- 2 and 3. Cost, currency, delivery, start -----------------------------------
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS cost_type TEXT,
  ADD COLUMN IF NOT EXISTS cost_source TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS delivery TEXT,
  ADD COLUMN IF NOT EXISTS started_on DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_cost_type_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_cost_type_check CHECK (cost_type IS NULL OR cost_type IN ('free', 'paid'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_cost_source_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_cost_source_check CHECK (cost_source IS NULL OR cost_source IN ('listed', 'usual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_delivery_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_delivery_check CHECK (delivery IS NULL OR delivery IN ('in_person', 'online', 'both'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_currency_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_currency_check CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS resources_cost_type_idx ON public.resources (cost_type) WHERE status = 'approved';

COMMENT ON COLUMN public.resources.cost_type IS 'free or paid (STEP 78). With cost_source: listed (the place says so) or usual (what that kind of place usually is).';
COMMENT ON COLUMN public.resources.currency IS 'The currency of price, ISO 4217 (CAD in Canada) (STEP 78).';
COMMENT ON COLUMN public.resources.delivery IS 'in_person, online or both (STEP 78).';
COMMENT ON COLUMN public.resources.started_on IS 'When the service began, when known; the age of a service falls back to when it was added (STEP 78).';

-- 4. What every existing place already makes plain ---------------------------
-- A price says it outright.
UPDATE public.resources SET cost_type = 'paid', cost_source = 'listed'
 WHERE cost_type IS NULL AND price > 0;
UPDATE public.resources SET cost_type = 'free', cost_source = 'listed'
 WHERE cost_type IS NULL AND price = 0;

-- Otherwise, what the kind of place usually is.
UPDATE public.resources
   SET cost_type = CASE
         WHEN category = 'School' AND name ~* '(universit|\mcollege\M|polytechnic|montessori|academy|private|preparatory|\mprep\M)' THEN 'paid'
         WHEN category IN ('Park', 'Community Center', 'Support Group', 'Employment', 'Food Support', 'Shelter',
                           'Social Services', 'School', 'Doctor', 'Funding & Benefits', 'Newcomer Services',
                           'Education Support', 'Legal & Future Planning', 'organization', 'Organization') THEN 'free'
         ELSE 'paid'
       END,
       cost_source = 'usual'
 WHERE cost_type IS NULL;

-- Canadian places are priced in Canadian dollars.
UPDATE public.resources SET currency = 'CAD'
 WHERE currency IS NULL
   AND (geo_province IN ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT')
        OR coalesce(location->>'country', 'Canada') IN ('Canada', 'CA'));

-- A place on the map is visited in person.
UPDATE public.resources SET delivery = 'in_person'
 WHERE delivery IS NULL AND geo_lat IS NOT NULL AND source_type = 'openstreetmap';

-- Tags the kind and name make plain. Each only adds a tag the place lacks.
UPDATE public.resources SET tags = array_append(tags, 'edu_daycare')
 WHERE NOT ('edu_daycare' = ANY (tags))
   AND (category = 'Child Care' OR name ~* '(day ?care|child ?care|early learning|nursery school)');
UPDATE public.resources SET tags = array_append(tags, 'edu_kindergarten')
 WHERE NOT ('edu_kindergarten' = ANY (tags)) AND name ~* '(kindergarten|preschool|pre-school)';
UPDATE public.resources SET tags = array_append(tags, 'edu_elementary')
 WHERE NOT ('edu_elementary' = ANY (tags)) AND category = 'School'
   AND name ~* '(public school|elementary|junior school|primary school|\mp\.s\.)' AND name !~* 'senior public school';
UPDATE public.resources SET tags = array_append(tags, 'edu_middle')
 WHERE NOT ('edu_middle' = ANY (tags)) AND category = 'School' AND name ~* '(middle school|senior public school|intermediate school)';
UPDATE public.resources SET tags = array_append(tags, 'edu_secondary')
 WHERE NOT ('edu_secondary' = ANY (tags)) AND category = 'School'
   AND name ~* '(secondary school|high school|collegiate|composite school|\ms\.s\.)';
UPDATE public.resources SET tags = array_append(tags, 'edu_university')
 WHERE NOT ('edu_university' = ANY (tags)) AND category = 'School' AND name ~* '(university|université)';
UPDATE public.resources SET tags = array_append(tags, 'edu_college')
 WHERE NOT ('edu_college' = ANY (tags)) AND category = 'School'
   AND name ~* '(algonquin|cambrian|canadore|centennial|boréal|boreal|conestoga|confederation college|durham college|fanshawe|fleming college|george brown|georgian college|humber|la cité|lambton college|loyalist college|mohawk college|niagara college|northern college|st\.? clair college|st\.? lawrence college|sault college|seneca|sheridan)';
UPDATE public.resources SET tags = array_append(tags, 'job_opportunities')
 WHERE NOT ('job_opportunities' = ANY (tags)) AND category = 'Employment';
UPDATE public.resources SET tags = array_append(tags, 'community_group')
 WHERE NOT ('community_group' = ANY (tags)) AND category = 'Support Group';
UPDATE public.resources SET tags = array_append(tags, 'recreation')
 WHERE NOT ('recreation' = ANY (tags))
   AND category IN ('Park', 'Recreation', 'Swimming', 'Horseback Riding', 'Zoo & Aquarium', 'Amusement Park', 'Museum');

-- 5. Articles read -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resource_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);

ALTER TABLE public.resource_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_reads_own_read ON public.resource_reads;
CREATE POLICY resource_reads_own_read ON public.resource_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS resource_reads_own_write ON public.resource_reads;
CREATE POLICY resource_reads_own_write ON public.resource_reads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS resource_reads_own_delete ON public.resource_reads;
CREATE POLICY resource_reads_own_delete ON public.resource_reads
  FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.resource_reads TO authenticated;

COMMENT ON TABLE public.resource_reads IS
  'Articles each person has opened, for "Already read" (STEP 78). Only the person sees and writes their own.';

-- 6. Self-diagnosed ----------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.user_barriers'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%undiagnosed_identifying%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_barriers DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.user_barriers ADD CONSTRAINT user_barriers_connection_type_check
  CHECK (connection_type IS NULL OR connection_type IN (
    'diagnosed', 'self_diagnosed', 'undiagnosed_identifying', 'undiagnosed_unsure',
    'parent_guardian', 'sibling', 'caretaker',
    'educator', 'employer', 'coworker', 'therapist', 'researcher',
    'ally'
  ));

CREATE OR REPLACE FUNCTION public.connection_type_tier(p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'diagnosed'               THEN 'lived'
    WHEN 'self_diagnosed'          THEN 'lived'
    WHEN 'undiagnosed_identifying' THEN 'lived'
    WHEN 'undiagnosed_unsure'      THEN 'lived'
    WHEN 'parent_guardian'         THEN 'direct_support'
    WHEN 'sibling'                 THEN 'direct_support'
    WHEN 'caretaker'               THEN 'direct_support'
    WHEN 'educator'                THEN 'indirect_support'
    WHEN 'employer'                THEN 'indirect_support'
    WHEN 'coworker'                THEN 'indirect_support'
    WHEN 'therapist'               THEN 'indirect_support'
    WHEN 'researcher'              THEN 'indirect_support'
    WHEN 'ally'                    THEN 'ally'
    ELSE 'lived'
  END;
$$;

-- 7. Spot Guides -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spot_guides (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.spot_guides ENABLE ROW LEVEL SECURITY;

-- No policies: rows are added in the SQL editor, like admin_users (STEP 55).
COMMENT ON TABLE public.spot_guides IS
  'People who review the places the service-adding loop finds (STEP 78). Rows are added only in the SQL editor.';

CREATE OR REPLACE FUNCTION public.is_spot_guide()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.spot_guides WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.is_spot_guide() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_spot_guide() TO authenticated;

COMMENT ON FUNCTION public.is_spot_guide() IS
  'Whether the signed-in caller is a Spot Guide or an admin (STEP 78). Answers only for the caller.';

-- The batches waiting for a Spot Guide, with how many places are pending,
-- approved and hidden in each. Only Spot Guides and admins get rows.
CREATE OR REPLACE FUNCTION public.spot_guide_batches()
RETURNS TABLE (batch TEXT, pending BIGINT, approved BIGINT, hidden BIGINT, first_added TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT import_batch,
         count(*) FILTER (WHERE status = 'pending'),
         count(*) FILTER (WHERE status = 'approved'),
         count(*) FILTER (WHERE status = 'rejected'),
         min(created_at)
  FROM public.resources
  WHERE import_batch IS NOT NULL AND public.is_spot_guide()
  GROUP BY import_batch
  ORDER BY min(created_at) DESC
$$;

REVOKE ALL ON FUNCTION public.spot_guide_batches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spot_guide_batches() TO authenticated;

COMMENT ON FUNCTION public.spot_guide_batches() IS
  'The import and loop batches with their pending, approved and hidden counts, for Spot Guides and admins only (STEP 78).';

-- 8. Search with tags, cost, delivery and age (replaces STEP 77's) -----------
-- p as in STEP 77, and:
--   tag_groups    [[tag, ...], ...]   every group, any of its tags
--   cost_type     'free' | 'paid'
--   delivery      'online' | 'in_person'   (each includes 'both')
--   started_after 'YYYY-MM-DD'        started, or was added, on or after
CREATE OR REPLACE FUNCTION public.search_resource_page(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  hay CONSTANT TEXT := 'lower(coalesce(r.name, '''') || '' '' || coalesce(r.description, '''') || '' '' || coalesce(r.category, ''''))';
  w TEXT[];
  g JSONB;
  t TEXT;
  ors TEXT[];
  all_terms TEXT[] := '{}';
  score TEXT := '0';
  ord TEXT[] := '{}';
  rule JSONB;
  dir TEXT;
  lat DOUBLE PRECISION := CASE WHEN jsonb_typeof(p->'lat') = 'number' THEN (p->>'lat')::double precision END;
  lng DOUBLE PRECISION := CASE WHEN jsonb_typeof(p->'lng') = 'number' THEN (p->>'lng')::double precision END;
  radius DOUBLE PRECISION := coalesce(CASE WHEN jsonb_typeof(p->'radius_km') = 'number' THEN (p->>'radius_km')::double precision END, 50);
  max_km DOUBLE PRECISION := CASE WHEN jsonb_typeof(p->'max_km') = 'number' THEN (p->>'max_km')::double precision END;
  prov TEXT := public.province_key(p->>'province');
  near_first BOOLEAN := coalesce((p->>'near_first')::boolean, false) AND lat IS NOT NULL AND lng IS NOT NULL;
  lim INTEGER := least(greatest(coalesce((p->>'limit')::integer, 20), 1), 100);
  off INTEGER := least(greatest(coalesce((p->>'offset')::integer, 0), 0), 100000);
  categories TEXT[];
  ages TEXT[];
  sources TEXT[];
  cond_ids UUID[];
  allowed UUID[];
  min_price NUMERIC := CASE WHEN jsonb_typeof(p->'min_price') = 'number' THEN (p->>'min_price')::numeric END;
  max_price NUMERIC := CASE WHEN jsonb_typeof(p->'max_price') = 'number' THEN (p->>'max_price')::numeric END;
  result JSONB;

  -- A search term as the app cleans it (lib/search/words.ts): lower case,
  -- letters, digits, spaces, apostrophes, hyphens and underscores.
  clean TEXT;
BEGIN
  w := ARRAY[format('r.status = %L', CASE WHEN p->>'status' = 'pending' THEN 'pending' ELSE 'approved' END)];

  -- Text groups: each must match.
  FOR g IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'groups') = 'array' THEN p->'groups' ELSE '[]'::jsonb END)
  LOOP
    ors := '{}';
    FOR t IN SELECT value FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g) = 'array' THEN g ELSE '[]'::jsonb END)
    LOOP
      clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
      CONTINUE WHEN clean = '';
      ors := ors || format('%s LIKE %L', hay, '%' || clean || '%');
      all_terms := all_terms || clean;
    END LOOP;
    IF array_length(ors, 1) > 0 THEN
      w := w || ('(' || array_to_string(ors, ' OR ') || ')');
    END IF;
  END LOOP;

  FOR t IN SELECT value FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'soft') = 'array' THEN p->'soft' ELSE '[]'::jsonb END)
  LOOP
    clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
    CONTINUE WHEN clean = '';
    all_terms := all_terms || clean;
  END LOOP;

  -- Relevance: each term in the name 10, in the description 5, as the app scores it.
  FOR t IN SELECT DISTINCT unnest(all_terms)
  LOOP
    score := score || format(' + (CASE WHEN lower(r.name) LIKE %1$L THEN 10 ELSE 0 END) + (CASE WHEN lower(coalesce(r.description, '''')) LIKE %1$L THEN 5 ELSE 0 END)', '%' || t || '%');
  END LOOP;

  IF jsonb_typeof(p->'categories') = 'array' AND jsonb_array_length(p->'categories') > 0 THEN
    SELECT array_agg(value) INTO categories FROM jsonb_array_elements_text(p->'categories');
    w := w || 'r.category ILIKE ANY ($3)'::text;
  END IF;
  IF jsonb_typeof(p->'age_ranges') = 'array' AND jsonb_array_length(p->'age_ranges') > 0 THEN
    SELECT array_agg(value) INTO ages FROM jsonb_array_elements_text(p->'age_ranges');
    w := w || 'r.age_ranges && $4'::text;
  END IF;
  IF coalesce((p->>'first_party')::boolean, false) THEN
    w := w || 'r.is_first_party'::text;
  END IF;
  IF jsonb_typeof(p->'source_types') = 'array' AND jsonb_array_length(p->'source_types') > 0 THEN
    SELECT array_agg(value) INTO sources FROM jsonb_array_elements_text(p->'source_types');
    w := w || 'r.source_type = ANY ($5)'::text;
  END IF;

  -- Price: a place with no price is shown unless a minimum above 0 is set.
  IF min_price IS NOT NULL AND min_price > 0 THEN
    w := w || format('r.price >= %s', min_price);
    IF max_price IS NOT NULL THEN w := w || format('r.price <= %s', max_price); END IF;
  ELSIF max_price IS NOT NULL THEN
    w := w || format('(r.price IS NULL OR r.price <= %s)', max_price);
  END IF;

  -- A life area: any of its keywords.
  IF jsonb_typeof(p->'life') = 'array' AND jsonb_array_length(p->'life') > 0 THEN
    ors := '{}';
    FOR t IN SELECT value FROM jsonb_array_elements_text(p->'life')
    LOOP
      clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
      CONTINUE WHEN clean = '';
      ors := ors || format('%s LIKE %L', hay, '%' || clean || '%');
    END LOOP;
    IF array_length(ors, 1) > 0 THEN w := w || ('(' || array_to_string(ors, ' OR ') || ')'); END IF;
  END IF;

  -- A condition: in the place's text, or among the norms it was rated for.
  IF jsonb_typeof(p->'cond_keys') = 'array' AND jsonb_array_length(p->'cond_keys') > 0 THEN
    ors := '{}';
    FOR t IN SELECT value FROM jsonb_array_elements_text(p->'cond_keys')
    LOOP
      clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
      CONTINUE WHEN clean = '';
      ors := ors || format('%s LIKE %L', hay, '%' || clean || '%');
    END LOOP;
    IF jsonb_typeof(p->'cond_ids') = 'array' AND jsonb_array_length(p->'cond_ids') > 0 THEN
      SELECT array_agg(value::uuid) INTO cond_ids FROM jsonb_array_elements_text(p->'cond_ids');
      ors := ors || 'r.id = ANY ($6)'::text;
    END IF;
    IF array_length(ors, 1) > 0 THEN w := w || ('(' || array_to_string(ors, ' OR ') || ')'); END IF;
  END IF;

  -- Narrowed by ratings. An empty list means nothing matches.
  IF jsonb_typeof(p->'allowed') = 'array' THEN
    SELECT coalesce(array_agg(value::uuid), '{}') INTO allowed FROM jsonb_array_elements_text(p->'allowed');
    w := w || 'r.id = ANY ($7)'::text;
  END IF;

  -- Tags (STEP 78): every group, any of its tags. The app adds the tags
  -- under a chosen one ("Kindergarten" finds junior and senior kindergarten).
  FOR g IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'tag_groups') = 'array' THEN p->'tag_groups' ELSE '[]'::jsonb END)
  LOOP
    IF jsonb_typeof(g) = 'array' AND jsonb_array_length(g) > 0 THEN
      w := w || format('r.tags && %L::text[]', (
        SELECT array_agg(value) FROM jsonb_array_elements_text(g) WHERE value ~ '^[a-z0-9_]{1,60}$'
      ));
    END IF;
  END LOOP;

  -- Free or paid, online or in person, and how long ago it started (STEP 78).
  IF p->>'cost_type' IN ('free', 'paid') THEN
    w := w || format('r.cost_type = %L', p->>'cost_type');
  END IF;
  IF p->>'delivery' = 'online' THEN
    w := w || 'r.delivery IN (''online'', ''both'')'::text;
  ELSIF p->>'delivery' = 'in_person' THEN
    w := w || 'r.delivery IN (''in_person'', ''both'')'::text;
  END IF;
  IF coalesce(p->>'started_after', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    w := w || format('coalesce(r.started_on, r.created_at::date) >= %L::date', p->>'started_after');
  END IF;

  -- Order: near first when asked, then each sort rule, then id.
  IF near_first THEN
    ord := ord || 'near_group'::text || 'CASE WHEN near_group = 1 THEN no_province::int END'::text || 'distance ASC NULLS LAST'::text;
  END IF;
  FOR rule IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'sort') = 'array' THEN p->'sort' ELSE '[{"key": "relevance", "direction": "desc"}]'::jsonb END)
  LOOP
    dir := CASE WHEN rule->>'direction' = 'asc' THEN 'ASC' ELSE 'DESC' END;
    CASE rule->>'key'
      WHEN 'cost' THEN ord := ord || ('price ' || dir || ' NULLS LAST');
      WHEN 'rating' THEN ord := ord || ('avg_rating ' || dir) || 'n DESC'::text;
      WHEN 'reviews' THEN ord := ord || ('n ' || dir);
      WHEN 'distance' THEN ord := ord || (CASE WHEN dir = 'ASC' THEN 'distance ASC NULLS LAST' ELSE 'distance DESC NULLS FIRST' END);
      WHEN 'newest' THEN ord := ord || ('created_at ' || dir);
      ELSE ord := ord || ('score ' || dir) || 'n DESC'::text;
    END CASE;
  END LOOP;
  ord := ord || 'id'::text;

  EXECUTE format($q$
    WITH s AS (
      SELECT resource_id, avg(overall_score)::double precision AS avg_rating, count(*)::int AS n
      FROM public.ratings
      GROUP BY resource_id
    ),
    m AS (
      SELECT r.id,
             (%1$s) + coalesce(s.avg_rating, 0) AS score,
             coalesce(s.avg_rating, 0) AS avg_rating,
             coalesce(s.n, 0) AS n,
             r.price,
             r.created_at,
             d.distance,
             r.geo_province IS NULL AS no_province,
             CASE
               WHEN d.distance IS NOT NULL THEN CASE WHEN d.distance <= $8 THEN 0 ELSE 2 END
               WHEN r.geo_province IS NULL THEN 1
               WHEN $9::text IS NOT NULL AND r.geo_province = $9::text THEN 1
               ELSE 2
             END AS near_group
      FROM public.resources r
      LEFT JOIN s ON s.resource_id = r.id
      CROSS JOIN LATERAL (
        SELECT CASE
          WHEN $1::double precision IS NULL OR $2::double precision IS NULL OR r.geo_lat IS NULL OR r.geo_lng IS NULL THEN NULL
          ELSE 6371 * 2 * asin(least(1, sqrt(
            power(sin(radians((r.geo_lat - $1::double precision) / 2)), 2)
            + cos(radians($1::double precision)) * cos(radians(r.geo_lat))
              * power(sin(radians((r.geo_lng - $2::double precision) / 2)), 2)
          )))
        END AS distance
      ) d
      WHERE %2$s
    ),
    k AS (
      SELECT m.*, row_number() OVER (ORDER BY %3$s) AS ord
      FROM m
      WHERE $10::double precision IS NULL OR m.distance IS NULL OR m.distance <= $10::double precision
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM k),
      'near_count', (SELECT count(*) FROM k WHERE k.near_group = 0),
      'rows', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', k.id, 'distance', k.distance, 'avg', k.avg_rating, 'n', k.n) ORDER BY k.ord)
        FROM k WHERE k.ord > $11 AND k.ord <= $11 + $12
      ), '[]'::jsonb)
    )
  $q$, score, array_to_string(w, ' AND '), array_to_string(ord, ', '))
  INTO result
  USING lat, lng, categories, ages, sources, cond_ids, allowed, radius, prov, max_km, off, lim;

  RETURN result;
END
$fn$;

COMMENT ON FUNCTION public.search_resource_page(JSONB) IS
  'One page of ResourceHub search results: the filters, near-first order and counts of servicehub-mvp/lib/supabase/queries.ts, done in the database. Runs with the caller''s rights (STEP 77; tags, cost, delivery and age, STEP 78).';

GRANT EXECUTE ON FUNCTION public.search_resource_page(JSONB) TO anon, authenticated;

COMMIT;
