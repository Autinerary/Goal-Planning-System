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
