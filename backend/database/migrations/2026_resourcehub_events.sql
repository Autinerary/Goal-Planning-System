-- =====================================================================
-- ResourceHub's first session: setup, first place opened, nearby results
--
-- Riipen Labs, Group 8 recommended a three-step ResourceHub setup (role,
-- one topic, a first place to start), results sorted by distance, and
-- prompts that ask for more later, measured by "onboarding completion
-- rate, time from landing to first resource viewed, and ... the
-- percentage of search results returned within the user's stated radius",
-- with each prompt validated "before adding more". ResourceHub sends these
-- to the funnel table (STEP 45) through its own /api/events
-- (servicehub-mvp/app/api/events/route.ts):
--
--   rh_visit            no step                     first visit from this browser
--   rh_setup_step       'role' | 'topic' | 'first'  a setup step was shown
--   rh_setup_complete   'topic' | 'no_topic'        setup was saved
--   rh_first_resource   'setup' | 'browse'          first place opened, and from where
--   rh_search           '<near>/<shown>'            a search with a location, page 1
--   rh_prompt           '<shown|yes|no|later>.<sharpen|more_like_these|add_topic>'
--
-- This replaces STEP 50's list and keeps every event in it, so if STEP 50
-- was not applied, this alone is enough. Nothing typed is sent. Reported by
-- backend/scripts/onboarding_funnel.py. Until this is applied ResourceHub's
-- events are dropped; nothing else is affected.
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
    'feature_use', 'ask_later',
    'rh_visit', 'rh_setup_step', 'rh_setup_complete', 'rh_first_resource',
    'rh_search', 'rh_prompt'
  ));
