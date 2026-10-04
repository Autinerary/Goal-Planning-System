-- =====================================================================
-- Check-ins: why people stop, and whether active users find it useful
--
-- Riipen Labs, Group 2 ("Improving the Autinerary User Experience"):
--   * "Understand user drop-off ... send a very short survey to inactive
--     users"
--   * "Ask active users about usefulness and inactive users why they
--     disengaged"
--   * "Add email and notification opt-in so a check-in can reach users who
--     stop opening the app"
--
-- checkin_responses holds the answers, from three places:
--   inactive_email  the one-question email sent after two weeks away, only to
--                   people who opted in (profiles.preferences.checkin.optIn)
--   welcome_back    asked in the app when someone returns after two weeks
--   usefulness      asked in the app to active users, after the team's
--                   existing feedback form, never at the same time
--
-- checkin_state is what the daily email job needs, for opted-in people only:
--   last_seen_on  the last day they opened the app (written by
--                 /api/checkin/seen, so it works even when the browser blocks
--                 analytics with Do Not Track or Global Privacy Control)
--   last_sent_at  when a check-in email was last sent. One email per absence:
--                 nobody is emailed again unless they came back and then
--                 stopped again, and never twice within 60 days.
-- Written only by server routes (service role).
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.checkin_responses (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind               TEXT        NOT NULL CHECK (kind IN ('inactive_email', 'welcome_back', 'usefulness')),
  -- Why they stopped (inactive_email, welcome_back).
  reason             TEXT        CHECK (reason IN (
                       'too_much', 'not_what_i_needed', 'hard_to_find', 'no_time',
                       'not_useful_yet', 'just_exploring', 'other'
                     )),
  -- Is it useful so far (usefulness).
  usefulness         TEXT        CHECK (usefulness IN ('very', 'somewhat', 'not_yet')),
  comment            TEXT        CHECK (comment IS NULL OR length(comment) <= 1000),
  onboarding_version TEXT        CHECK (onboarding_version IS NULL OR length(onboarding_version) <= 40),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT checkin_responses_answered CHECK (reason IS NOT NULL OR usefulness IS NOT NULL OR comment IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS checkin_responses_kind_time_idx
  ON public.checkin_responses (kind, created_at);
CREATE INDEX IF NOT EXISTS checkin_responses_user_idx
  ON public.checkin_responses (user_id, created_at DESC);

ALTER TABLE public.checkin_responses ENABLE ROW LEVEL SECURITY;

-- In-app answers are written with the person's own session; email answers
-- come through the server route (service role) after the link's signature
-- has been checked. People can read back only their own.
DROP POLICY IF EXISTS checkin_responses_insert_own ON public.checkin_responses;
CREATE POLICY checkin_responses_insert_own ON public.checkin_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS checkin_responses_select_own ON public.checkin_responses;
CREATE POLICY checkin_responses_select_own ON public.checkin_responses
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.checkin_responses IS
  'Why people stop using Autinerary (email check-in, welcome-back question) and whether active users find it useful. See backend/scripts/onboarding_funnel.py.';


CREATE TABLE IF NOT EXISTS public.checkin_state (
  user_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_on DATE,
  last_sent_at TIMESTAMPTZ,
  send_count   INTEGER     NOT NULL DEFAULT 0 CHECK (send_count >= 0)
);

-- Service role only (server routes). No policies.
ALTER TABLE public.checkin_state ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.checkin_state IS
  'For people who opted in to the check-in email: the last day they opened the app and when the email was last sent (one per absence, at most one in 60 days).';
