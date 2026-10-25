-- =====================================================================
-- One-click sign-up replaces one-click Apply (STEP 90)
--
-- The ask, October 2026, put plainly: "a button that I click on and I sign
-- up for the service, bypassing filling in the form on their site". So the
-- button now creates the person's account on the service itself: the
-- service's own sign-up form is filled in for them (in their browser by the
-- Autinerary extension, in the Autinerary phone and desktop apps, or by the
-- server for services with no robot checks), or a partner service creates
-- it directly. Nobody is emailed on their behalf any more, so STEP 89's
-- tables go (both were empty: one-click Apply never switched on).
--
--   service_signups   one row per person per service: which service (the
--                     sign-up kit's key, e.g. 'focusmate'), the ResourceHub
--                     listing when there is one, what ran it, and how it
--                     ended: signed_up, check_email (the service sent a
--                     link to confirm), needs_you (a robot check, a payment
--                     or a question only the person can answer), exists
--                     (they already had an account), or failed. Never a
--                     password: those stay with the person.
--
-- Run after STEP 89. Idempotent. Safe to re-run.
-- =====================================================================

DROP TABLE IF EXISTS public.service_applications;
DROP TABLE IF EXISTS public.application_details;

CREATE TABLE IF NOT EXISTS public.service_signups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service     TEXT NOT NULL,
  resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  runner      TEXT NOT NULL,
  status      TEXT NOT NULL,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service)
);

ALTER TABLE public.service_signups DROP CONSTRAINT IF EXISTS service_signups_shape;
ALTER TABLE public.service_signups ADD CONSTRAINT service_signups_shape CHECK (
  service ~ '^[a-z0-9-]{2,40}$'
  AND runner IN ('extension', 'desktop', 'mobile', 'server', 'partner')
  AND status IN ('started', 'signed_up', 'check_email', 'needs_you', 'exists', 'failed')
  AND (detail IS NULL OR char_length(detail) <= 300)
);

CREATE INDEX IF NOT EXISTS service_signups_user_idx ON public.service_signups (user_id, updated_at DESC);

ALTER TABLE public.service_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_signups_own_read ON public.service_signups;
CREATE POLICY service_signups_own_read ON public.service_signups
  FOR SELECT USING (user_id = auth.uid());

-- Only the server writes them (app/api/me/signups), after its checks.
REVOKE ALL ON public.service_signups FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.service_signups FROM authenticated;

COMMENT ON TABLE public.service_signups IS
  'One-click sign-up (STEP 90): one row per person per service the button signed them up for, what ran it and how it ended. Never a password. Read by its owner; written by the server only.';
