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
