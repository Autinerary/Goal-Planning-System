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
    ('helpful',         'Helpful',         'Received 5 upvotes on an answer',     '🙌', 'bronze', 'karma',    25),
    ('problem_solver',  'Problem Solver',  'Had an answer accepted as solved',    '🧩', 'silver', 'accepted', 1),
    ('mentor',          'Mentor',          '10 of your answers were accepted',    '🎓', 'gold',   'accepted', 10),
    ('community_pillar','Community Pillar','Reached 1000 karma',                  '🏛️', 'gold',   'karma',    1000),
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
-- STEP 14 — servicehub-mvp/scripts/2026_organizations.sql
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
-- STEP 15 — servicehub-mvp/scripts/2026_rating_groups.sql
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
-- STEP 16 — servicehub-mvp/scripts/2026_professional_verification.sql
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
-- STEP 17 — servicehub-mvp/scripts/2026_shop_products.sql
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


COMMIT;
