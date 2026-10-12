-- =====================================================================
-- Feedback at any time, and phone or computer (STEP 69)
--
-- Riipen Labs, Groups 31 to 33 (September 2026):
--
-- 1. Group 31: "allow first-time users to continue to submit more feedback
--    based off of their own experiences with the app", "what they liked/
--    found overwhelming"; Group 32: "their feedback directly shapes the
--    app". Until now that was an email address, or answering a check-in
--    when the app asked. The glossary (/help#tell-us) now has a short form
--    anyone signed in can use at any time. Its answers are kept with the
--    check-ins (STEP 46) as kind 'feedback', apart from the check-ins the
--    app asks for, so the share who find it useful is not skewed by people
--    who came to tell us something.
--
-- 2. Group 33: "mobile metrics", and setup that works the same on a phone.
--    The funnel's events (STEP 45) record whether the visit was on a phone,
--    a tablet or a computer (from the screen, nothing else), so the funnel
--    report can compare setup and returns by device.
--
-- Until this is applied, feedback is kept as a usefulness check-in and
-- events are kept without the device. Nothing else changes.
--
-- Run after STEP 68. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Feedback at any time ---------------------------------------------------
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
  CHECK (kind IN ('inactive_email', 'welcome_back', 'usefulness', 'feedback'));

COMMENT ON COLUMN public.checkin_responses.kind IS
  'inactive_email and welcome_back: why they stopped; usefulness: the in-app question; feedback: sent from the glossary''s form at any time (STEP 69).';

-- 2. Phone, tablet or computer ---------------------------------------------
ALTER TABLE public.onboarding_events ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE public.onboarding_events DROP CONSTRAINT IF EXISTS onboarding_events_device_check;
ALTER TABLE public.onboarding_events ADD CONSTRAINT onboarding_events_device_check
  CHECK (device IS NULL OR device IN ('phone', 'tablet', 'computer'));

COMMENT ON COLUMN public.onboarding_events.device IS
  'phone, tablet or computer, from the screen width and a touch screen, for the funnel report (STEP 69).';
