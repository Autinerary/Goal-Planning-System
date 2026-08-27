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
