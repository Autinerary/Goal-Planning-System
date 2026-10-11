-- =====================================================================
-- "Do you know what to do next?" after setup (STEP 62)
--
-- Riipen Labs' cohort report (all 36 teams, September 2026) asked for "one
-- short qualitative question such as 'Did you know what to do next?'" and,
-- against mistaking completion for satisfaction, to "ask whether users
-- understood what to do next". The moderated sessions ask it; people using
-- the app on their own were never asked.
--
-- One more optional answer in the questions after setup (yes, not sure, no),
-- in the same row as the others. The app works before this is applied: the
-- answer is simply not kept (app/api/onboarding-feedback).
--
-- Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.onboarding_feedback
  ADD COLUMN IF NOT EXISTS next_step TEXT CHECK (next_step IN ('yes', 'not_sure', 'no'));

COMMENT ON COLUMN public.onboarding_feedback.next_step IS
  '"Do you know what to do next?" on the page after setup: yes, not_sure or no (STEP 62).';

-- A response may now be this answer alone.
ALTER TABLE public.onboarding_feedback DROP CONSTRAINT IF EXISTS onboarding_feedback_answered;
ALTER TABLE public.onboarding_feedback ADD CONSTRAINT onboarding_feedback_answered CHECK (
  info_before_signup IS NOT NULL OR setup_ease IS NOT NULL OR comment IS NOT NULL OR next_step IS NOT NULL
);
