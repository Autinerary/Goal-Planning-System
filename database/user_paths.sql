-- Goal Planning System: persistent path storage
-- One row per user. Path payload stored as JSONB so the schema can evolve
-- without migrations as the multi-agent output changes.
--
-- Run this in the Supabase SQL editor (project: rvflowbufyhsdpugextz).

CREATE TABLE IF NOT EXISTS public.user_paths (
    user_id UUID PRIMARY KEY,
    path_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_paths_path_id ON public.user_paths(path_id);

-- Backend uses the service-role key, so RLS can stay enabled with no policies.
ALTER TABLE public.user_paths ENABLE ROW LEVEL SECURITY;
