-- =====================================================================
-- Which parts of the app people use
--
-- Riipen Labs, Group 5 suggested tracking, after the beta, "drop-off points
-- and which features different user groups actually use". One event joins
-- the funnel's vocabulary (STEPS 45 and 48):
--
--   feature_use   opened a part of the app   step: 'calendar', 'tidbits', ...
--
-- At most once a day per part per browser, for signed-in people who have
-- finished setup; the parts are listed in frontend/lib/funnel.ts. Nothing
-- typed, no addresses. Reported by backend/scripts/onboarding_funnel.py,
-- split by who people are here for. Until this is applied those events are
-- dropped; nothing else is affected.
--
-- Idempotent. Safe to re-run.
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
    'feature_use'
  ));
