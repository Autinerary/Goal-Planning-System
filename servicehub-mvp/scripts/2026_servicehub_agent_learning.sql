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
