-- ServiceHub: persistent recommendation memory
-- Append-only log of RecommendationAgent runs so the agent "remembers" a user
-- across logins/sessions, not just their live DB ratings. Mirrors the Goal
-- Planning System's agent_memory table.
--
-- Run this in the Supabase SQL editor (shared project: rvflowbufyhsdpugextz).

CREATE TABLE IF NOT EXISTS public.recommendation_memory (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL,
    summary JSONB NOT NULL,                  -- compact run summary (barriers, top resources, confidence)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recommendation_memory_user_idx
    ON public.recommendation_memory(user_id, created_at DESC);

-- Backend writes use the service-role key, so RLS can stay enabled with no policies.
ALTER TABLE public.recommendation_memory ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.recommendation_memory IS
    'Append-only log of RecommendationAgent runs for cross-session agent memory.';
