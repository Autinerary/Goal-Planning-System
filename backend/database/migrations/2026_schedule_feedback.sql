-- =====================================================================
-- Schedule feedback: "Did this schedule work for you?" (STEP 72)
--
-- Calendar Optimization has nothing to judge a week by: calendar_outcomes
-- and reflections have 0 rows, and the confidence it reported was 0.75 for
-- everyone (docs/reports/calendar-optimization-2026-10-13.md). This asks
-- the person, once per generated schedule, yes or no.
--
-- Same pattern as milestone_ratings (STEP 54): written by the backend
-- (POST /api/schedule-feedback), which checks the schedule is in the
-- person's own path; read back by GET /api/schedule-feedback/{pathId}.
--   * schedule_id: the calendar result's scheduleId, or 'path:<path_id>' for
--     a schedule generated before schedules had ids. path_id is kept too, so
--     an answer can be joined to its path.
--   * Once per schedule: one row per (user_id, schedule_id), never updated.
--     An answer given stands; there is no update policy.
--
-- Behind a flag, off by default: SCHEDULE_FEEDBACK_ENABLED=true on the
-- backend and NEXT_PUBLIC_SCHEDULE_FEEDBACK_ENABLED=true in the app. Until
-- this is applied the route answers that feedback isn't available, and the
-- app shows nothing.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.schedule_feedback (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id      TEXT        NOT NULL CHECK (length(path_id) BETWEEN 1 AND 100),
  schedule_id  TEXT        NOT NULL CHECK (length(schedule_id) BETWEEN 1 AND 120),
  answer       TEXT        NOT NULL CHECK (answer IN ('yes', 'no')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, schedule_id)
);

ALTER TABLE public.schedule_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own schedule feedback" ON public.schedule_feedback;
CREATE POLICY "Read own schedule feedback" ON public.schedule_feedback
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Add own schedule feedback" ON public.schedule_feedback;
CREATE POLICY "Add own schedule feedback" ON public.schedule_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.schedule_feedback IS
  '"Did this schedule work for you?" yes or no, once per generated schedule (STEP 72).';
