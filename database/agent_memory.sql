-- Goal Planning System: persistent agent memory
-- Append-only log of agent runs so the multi-agent system can "remember"
-- a user across sessions. Unlike user_paths (one row per user, overwritten),
-- this keeps every run as a compact summary the agents can learn from.
--
-- Run this in the Supabase SQL editor (project: rvflowbufyhsdpugextz).

CREATE TABLE IF NOT EXISTS public.agent_memory (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL,
    kind TEXT NOT NULL DEFAULT 'generation',  -- 'generation' | 'adaptation'
    summary JSONB NOT NULL,                    -- compact run summary (goals, barriers, signals)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_user
    ON public.agent_memory(user_id, created_at DESC);

-- Backend uses the service-role key, so RLS can stay enabled with no policies.
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
