-- =====================================================================
-- Paced setup: the energy check-in and Start here's optional questions
-- (STEP 71)
--
-- Riipen Labs, Groups 20 to 24 (September 2026):
--
-- 1. Group 23: "Introduce an initial question asking users to select their
--    current energy level ... so the setup length dynamically adapts to what
--    they can handle in that moment", and compare "completion, time-to-finish,
--    points of confusion, and early engagement" for the shorter and fuller
--    paths. Setup's first step now asks, optionally, how much energy someone
--    has for setting up today, and sends 'setup_energy' with the answer
--    (low, some or plenty).
--
-- 2. Group 21: "a short survey guide ... that asks users 5 targeted simple
--    multiple choice questions and directs them to the most relevant
--    section". Start here asks two; after the starter resources it now offers
--    three more, optional (where you are, how soon, how you like to start), and
--    sends 'start_refine' with the answer (for example "soon.today").
--
-- Nothing typed is sent. This replaces STEP 70's list of events and keeps
-- every event in it. Until this is applied, both new events are dropped and
-- nothing else changes (app/api/events always answers 204). Reported by
-- backend/scripts/onboarding_funnel.py.
--
-- Run after STEP 70. Idempotent. Safe to re-run.
-- =====================================================================

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
    'tour',
    'setup_energy', 'start_refine'
  ));
