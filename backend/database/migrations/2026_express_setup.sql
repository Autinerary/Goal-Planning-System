-- =====================================================================
-- Express setup: the tour's tasks, and "was making your account clear and
-- quick?" (STEP 70)
--
-- Riipen Labs, Groups 25 to 30 (September 2026):
--
-- 1. Group 27: the tour should have "prompts that have users complete a
--    task before moving to the next feature", and the employer should
--    "track onboarding completion, drop-off by step, and return usage".
--    The tour now asks for one small thing on each part (open your next
--    step, open the Calendar, pick today's energy, open Display) and sends
--    'tour' events: "start", "task.<id>" when done, "skip.<id>", "finish"
--    and "close". Nothing typed is sent.
--
-- 2. Group 25: "Autinerary could also directly ask beta testers if signup
--    felt clear and quick." One more optional answer in the questions after
--    setup (yes, mostly, no), in the same row as the others.
--
-- The "Complete your profile" card (Groups 29 and 30) needs nothing here:
-- it sends the ask_later events STEP 50 already allows.
--
-- This replaces STEP 51's list of events and keeps every event in it. Until
-- this is applied, tour events are dropped and the new answer is not kept;
-- nothing else changes (app/api/events, app/api/onboarding-feedback).
-- Reported by backend/scripts/onboarding_funnel.py.
--
-- Run after STEP 69. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. The tour's events -------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.onboarding_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%landing_view%'
  LOOP
    EXECUTE format('ALTER TABLE public.onboarding_events DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.onboarding_events
  ADD CONSTRAINT onboarding_events_event_check CHECK (event IN (
    'landing_view', 'signup_view', 'signup_complete',
    'onboarding_step_view', 'onboarding_complete', 'app_open',
    'start_role', 'start_pathway', 'start_open', 'start_useful', 'start_save',
    'feature_use', 'ask_later',
    'rh_visit', 'rh_setup_step', 'rh_setup_complete', 'rh_first_resource',
    'rh_search', 'rh_prompt',
    'tour'
  ));

-- 2. "Was making your account clear and quick?" -----------------------------
ALTER TABLE public.onboarding_feedback
  ADD COLUMN IF NOT EXISTS signup_clear TEXT CHECK (signup_clear IN ('yes', 'mostly', 'no'));

COMMENT ON COLUMN public.onboarding_feedback.signup_clear IS
  '"Was making your account clear and quick?" on the page after setup: yes, mostly or no (STEP 70).';

-- A response may now be this answer alone.
ALTER TABLE public.onboarding_feedback DROP CONSTRAINT IF EXISTS onboarding_feedback_answered;
ALTER TABLE public.onboarding_feedback ADD CONSTRAINT onboarding_feedback_answered CHECK (
  info_before_signup IS NOT NULL OR setup_ease IS NOT NULL OR comment IS NOT NULL
  OR next_step IS NOT NULL OR signup_clear IS NOT NULL
);
