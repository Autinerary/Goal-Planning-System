-- =====================================================================
-- "Start here" funnel events
--
-- Riipen Labs, Group 4 recommended a guided "Start Here" (who you are here
-- for, what you need today, then a first pathway of resources) and measuring
-- it: completion ("select a role and goal, then reach a resource list"),
-- relevance ("users mark results as useful or save the path") and
-- confidence ("choose a next action"). These five events join the funnel's
-- vocabulary (STEP 45). The step column carries the answers chosen, never
-- anything typed:
--
--   start_role     chose who they are here for   step 'child'
--   start_pathway  saw a pathway                 step 'child.services'
--   start_open     opened one of its resources   step 'child.services.therapists'
--   start_useful   answered "Was this useful?"   step 'child.services.yes' or '.no'
--   start_save     pressed "Save this path"      step 'child.services'
--
-- Reported by backend/scripts/onboarding_funnel.py. Until this is applied
-- those events are dropped (the old check refuses them and /api/events
-- ignores the error); nothing else is affected.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- STEP 45's check on event has a generated name: drop whichever check lists
-- the events, then add the wider one under a fixed name.
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
    'start_role', 'start_pathway', 'start_open', 'start_useful', 'start_save'
  ));
