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
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reflections (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL,
  context_type          TEXT        NOT NULL,
  context_id            TEXT,
  questions             JSONB       NOT NULL DEFAULT '[]'::jsonb,
  free_form_text        TEXT,
  -- Computed signals (so retrieval & analytics don't need to re-parse JSON)
  sentiment_label       TEXT,
  sentiment_score       REAL,
  completion_rate       REAL,
  reward_signal         REAL,        -- in [-1, 1]; this is the RL "reward"
  -- Full agent payloads (auditable training corpus for future fine-tuning)
  reflection_response   JSONB,
  adaptation_response   JSONB,
  -- Indicators detected in this entry (used to update learned_patterns)
  indicators            TEXT[]      NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
