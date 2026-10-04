-- =====================================================================
-- Onboarding funnel events and post-setup feedback
--
-- From Riipen Labs' onboarding review (Team 1, Sept 2026), "Implementation
-- considerations":
--   * analytics to track where users enter and leave the onboarding process
--   * success measures: the share of visitors who complete account creation,
--     users who return within 7 days, users who leave during onboarding
--   * surveys asking whether users got the right amount of information about
--     Autinerary before creating an account
--
-- onboarding_events answers the first two. One row per event; the funnel is
-- computed by backend/scripts/onboarding_funnel.py.
--
--   visitor_id  random UUID generated in the browser on first visit. It is
--               not linked to a person until that browser signs up, which
--               is what lets "visited the landing page" be joined to "made
--               an account" and to "came back within 7 days".
--   channel     utm_source of the first visit (e.g. 'tiktok', 'facebook'),
--               so acquisition channels can be compared.
--   step        the onboarding step id for onboarding_step_view.
--
-- Deliberately NOT stored: IP address, user agent, full URLs, anything a
-- person typed. Browsers sending Do Not Track or Global Privacy Control are
-- not counted at all (enforced in frontend/lib/funnel.ts).
--
-- onboarding_feedback holds the two-question survey shown after setup.
-- onboarding_version marks which version of onboarding someone went through,
-- so the revised flow can be compared with later revisions.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id                 BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id         UUID        NOT NULL,
  user_id            UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  event              TEXT        NOT NULL CHECK (event IN (
                       'landing_view', 'signup_view', 'signup_complete',
                       'onboarding_step_view', 'onboarding_complete', 'app_open'
                     )),
  step               TEXT        CHECK (step IS NULL OR length(step) <= 40),
  channel            TEXT        CHECK (channel IS NULL OR length(channel) <= 40),
  campaign           TEXT        CHECK (campaign IS NULL OR length(campaign) <= 80),
  referrer_host      TEXT        CHECK (referrer_host IS NULL OR length(referrer_host) <= 120),
  onboarding_version TEXT        NOT NULL CHECK (length(onboarding_version) <= 40),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_events_event_time_idx
  ON public.onboarding_events (event, created_at);
CREATE INDEX IF NOT EXISTS onboarding_events_visitor_idx
  ON public.onboarding_events (visitor_id);
CREATE INDEX IF NOT EXISTS onboarding_events_user_time_idx
  ON public.onboarding_events (user_id, created_at) WHERE user_id IS NOT NULL;

-- Written only by the server route (service role) after validating the
-- event; no client reads or writes it directly, so no policies.
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.onboarding_events IS
  'Onboarding funnel: landing visit -> sign-up -> each setup step -> setup complete -> return visits. No IP, user agent, URLs or typed content. See backend/scripts/onboarding_funnel.py.';


CREATE TABLE IF NOT EXISTS public.onboarding_feedback (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- "Before you made an account, how much did you know about what
  -- Autinerary would do for you?"
  info_before_signup TEXT        CHECK (info_before_signup IN ('too_little', 'about_right', 'too_much')),
  -- "How easy was setup?" 1 = very hard ... 5 = very easy
  setup_ease         SMALLINT    CHECK (setup_ease BETWEEN 1 AND 5),
  comment            TEXT        CHECK (comment IS NULL OR length(comment) <= 1000),
  onboarding_version TEXT        NOT NULL CHECK (length(onboarding_version) <= 40),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_feedback_once UNIQUE (user_id, onboarding_version),
  CONSTRAINT onboarding_feedback_answered CHECK (
    info_before_signup IS NOT NULL OR setup_ease IS NOT NULL OR comment IS NOT NULL
  )
);

ALTER TABLE public.onboarding_feedback ENABLE ROW LEVEL SECURITY;

-- People can submit and read back their own answers, nobody else's.
DROP POLICY IF EXISTS onboarding_feedback_insert_own ON public.onboarding_feedback;
CREATE POLICY onboarding_feedback_insert_own ON public.onboarding_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS onboarding_feedback_select_own ON public.onboarding_feedback;
CREATE POLICY onboarding_feedback_select_own ON public.onboarding_feedback
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.onboarding_feedback IS
  'Two-question survey after setup: was there enough information before sign-up, and how easy was setup. One response per user per onboarding version.';
