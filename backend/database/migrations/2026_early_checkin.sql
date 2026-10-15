-- =====================================================================
-- The day-3 check-in (STEP 76)
--
-- Riipen Labs, Group 12 (September 2026): "Trigger quick micro-surveys on
-- Day 3 and Day 7 to gather actionable product feedback during the user's
-- initial 7-14 day experience." Day 7 is the existing usefulness question
-- (STEP 46). Day 3 is new: the Path asks, once, how it is going and what, if
-- anything, is in the way (components/CheckinPrompt.tsx), and offers a
-- change matched to the answer, as the other check-ins do (lib/checkin.ts).
--
-- Its answers are kept with the other check-ins (STEP 46) as kind 'early'.
-- Two of its answers are new: 'going_fine' ("It's going well") and
-- 'unclear_next' ("I'm not sure what to do next"). The rest are the stop
-- reasons already allowed.
--
-- Until this is applied, a day-3 answer is kept as a usefulness check-in
-- whose comment starts "Day 3 check-in:", and the funnel report counts it
-- as day 3. Nothing else changes.
--
-- Run after STEP 75. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. The kind ---------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.checkin_responses'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%inactive_email%'
  LOOP
    EXECUTE format('ALTER TABLE public.checkin_responses DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.checkin_responses ADD CONSTRAINT checkin_responses_kind_check
  CHECK (kind IN ('inactive_email', 'welcome_back', 'usefulness', 'feedback', 'early'));

-- 2. The answers ------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.checkin_responses'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%not_what_i_needed%'
  LOOP
    EXECUTE format('ALTER TABLE public.checkin_responses DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.checkin_responses ADD CONSTRAINT checkin_responses_reason_check
  CHECK (reason IN (
    'too_much', 'not_what_i_needed', 'hard_to_find', 'no_time',
    'not_useful_yet', 'just_exploring', 'other',
    'going_fine', 'unclear_next'
  ));

COMMENT ON COLUMN public.checkin_responses.kind IS
  'inactive_email, welcome_back, usefulness (asked in the app from day 7, or the day-14 email), feedback (the glossary form, STEP 69), early (asked in the app on days 3 to 6, STEP 76).';
