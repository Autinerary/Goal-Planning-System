-- ============================================================================
-- Real dates for the calendar (Odosa: "Calendar — Mimic G Cal like Motion").
--
-- Until now every task carried only a weekday NAME ('Monday') and a time.
-- That makes a repeating weekly template, not a calendar: there is no way to
-- say "the 14th", nothing can be scheduled next month, and a 7-day weather
-- forecast could only ever be matched loosely against "the next Monday".
--
-- The fix is additive, not a replacement, because BOTH models are real here:
--
--   scheduled_date IS NULL  -> recurs weekly on `day`. This is genuinely what
--                              the path-planning agents produce — schedule[]
--                              is a weekly template with day.name, not dates.
--   scheduled_date IS SET   -> a one-time task on an actual calendar date.
--
-- So nothing is migrated away or lost: existing rows keep behaving exactly as
-- they do today, and anything created in the new views gets a real date.
--
-- duration_minutes exists because `duration` is a display string ('1 hr',
-- '30 min') that cannot position or size a block on a time grid. It is
-- BACKFILLED by parsing the existing strings — derived from real data, never
-- guessed. Rows whose duration cannot be parsed are left NULL and the UI
-- falls back to a default block height rather than inventing a length.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

BEGIN;

ALTER TABLE public.calendar_tasks
  ADD COLUMN IF NOT EXISTS scheduled_date   DATE,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER
    CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 1440));

-- "What is on screen right now" — the only query the new views make.
CREATE INDEX IF NOT EXISTS calendar_tasks_user_date_idx
  ON public.calendar_tasks (user_id, scheduled_date);

-- Recurring rows are looked up by weekday instead.
CREATE INDEX IF NOT EXISTS calendar_tasks_user_recurring_idx
  ON public.calendar_tasks (user_id, day)
  WHERE scheduled_date IS NULL;

-- Backfill duration_minutes from the human-readable string already stored.
-- Only unambiguous forms are converted; anything else stays NULL rather than
-- being assigned a made-up length.
UPDATE public.calendar_tasks
   SET duration_minutes = CASE
     WHEN duration ~* '^\s*(\d+)\s*(min|mins|minute|minutes)\s*$'
       THEN (regexp_match(duration, '(\d+)'))[1]::INT
     WHEN duration ~* '^\s*(\d+)\s*(hr|hrs|hour|hours)\s*$'
       THEN (regexp_match(duration, '(\d+)'))[1]::INT * 60
     WHEN duration ~* '^\s*(\d+)\s*\.\s*5\s*(hr|hrs|hour|hours)\s*$'
       THEN (regexp_match(duration, '(\d+)'))[1]::INT * 60 + 30
     ELSE NULL
   END
 WHERE duration_minutes IS NULL
   AND duration IS NOT NULL;

COMMENT ON COLUMN public.calendar_tasks.scheduled_date IS
  'Real calendar date for a one-time task. NULL means the row recurs weekly on `day` — which is what the path-planning agents actually generate.';
COMMENT ON COLUMN public.calendar_tasks.duration_minutes IS
  'Length in minutes, for sizing a block on the time grid. Backfilled by parsing `duration`; NULL when that string was not unambiguously parseable.';

COMMIT;
