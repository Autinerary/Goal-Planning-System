-- LLM usage ledger for the model harness.
--
-- Limits were enforced against per-process in-memory counters. On Render's
-- free tier the service sleeps after ~15 minutes idle, so every wake reset
-- them: the usage panel showed 0 tokens no matter how much a user had
-- generated, and the daily cap reset with it. Multiple workers each kept
-- their own count as well, so the "limit" was really limit × worker count.
--
-- One row per LLM call. Rows are the raw record; the daily total is a SUM
-- over the last 24h rather than a running counter, so a lost write costs one
-- call's worth of accounting instead of corrupting a total that can never be
-- recomputed.
--
-- Tokens are always recorded because they are measured. cost_usd is NULL
-- unless the operator configured MODEL_PRICING — a dollar figure derived from
-- guessed prices would be worse than no figure.

BEGIN;

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

-- The only hot query: "what has this account used in the last 24h?"
CREATE INDEX IF NOT EXISTS llm_usage_user_time_idx
  ON public.llm_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS llm_usage_time_idx
  ON public.llm_usage (created_at DESC);

ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;

-- A user may read their own usage. Writes go through the service role only:
-- a client that could insert here could also inflate someone else's spend.
DROP POLICY IF EXISTS llm_usage_read_own ON public.llm_usage;
CREATE POLICY llm_usage_read_own ON public.llm_usage
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.llm_usage IS
  'One row per LLM call, for spend limits that survive a restart. Daily totals are summed from rows rather than kept as a counter, so a lost write cannot corrupt an unrecoverable total.';
COMMENT ON COLUMN public.llm_usage.cost_usd IS
  'NULL when the model had no configured price in MODEL_PRICING. Never a guessed figure.';

COMMIT;
