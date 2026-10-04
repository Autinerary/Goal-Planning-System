-- =====================================================================
-- Push notifications
--
-- Riipen Labs, Group 2: "add email and notification opt-in so a check-in can
-- reach users who stop opening the app". Email was STEP 46; this is the
-- notification half.
--
-- One row per device (browser) a person turned notifications on for, from
-- Settings or the page after setup (app/components/PushOptIn.tsx). The
-- endpoint is the device's address at its browser's push service; p256dh and
-- auth are the keys notifications are encrypted with, so the push service
-- cannot read them. A device that turns notifications on again, or changes
-- hands, replaces its row.
--
-- Sent by the inactive-user check-in (app/api/cron/inactive-checkin), plus
-- one confirmation when notifications are turned on. Rows the push service
-- reports as gone are deleted when a send fails.
--
-- Written only by server routes (service role): no policies.
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint     TEXT        PRIMARY KEY CHECK (length(endpoint) <= 1000),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p256dh       TEXT        NOT NULL CHECK (length(p256dh) <= 200),
  auth         TEXT        NOT NULL CHECK (length(auth) <= 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.push_subscriptions IS
  'Devices a person turned notifications on for (Web Push). Used for the inactive-user check-in. Service role only.';
