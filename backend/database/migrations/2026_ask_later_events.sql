-- =====================================================================
-- Questions asked later: are they answered?
--
-- Riipen Labs, Group 7 recommended asking optional setup questions later,
-- with an "assumption to test, not assume: users will actually engage ...
-- later if not asked upfront". The Path asks them one group at a time
-- (frontend/app/components/AskLaterCard.tsx). One event joins the funnel's
-- vocabulary (STEPS 45, 48 and 49):
--
--   ask_later   step 'shown.<group>'      the group was shown (once per browser)
--               step 'done.<question>'    a question was answered or opened
--               step 'closed.<group>'     the group was closed without answering
--
-- Groups and questions are listed in frontend/lib/askLater.ts. Nothing typed
-- is sent. Reported by backend/scripts/onboarding_funnel.py. Until this is
-- applied those events are dropped; nothing else is affected.
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
    'feature_use', 'ask_later'
  ));
