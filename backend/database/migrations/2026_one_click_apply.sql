-- =====================================================================
-- One-click Apply: services take people on from Autinerary (STEP 89)
--
-- The ask, October 2026: "all the resources people just sign up
-- automatically, they just click on it and it signs up"; on the task view
-- an "Apply all" for that page's resources; and never sending anyone to a
-- service's own website or app to apply.
--
--   application_details   what a person sends with Apply, saved once: their
--                         name, a phone number if they want one, who the
--                         application is for (them, their child, someone
--                         they support), what they are looking for and how
--                         they like to be contacted. Their own row only.
--                         The email address is never stored here: replies
--                         always go to the account's own email.
--   service_applications  one row per person per service: sent (emailed to
--                         the listing's address, a copy to the person),
--                         waiting (the listing has no email address yet; it
--                         goes out by itself once the team adds one),
--                         cancelled, failed, or unreachable (the team found
--                         no address). `details` keeps exactly what was, or
--                         will be, sent. The person reads their own rows;
--                         only the server writes them, after its checks
--                         (consent, age, a daily limit, one per service).
--
-- Nothing is deleted. Run after STEP 87 (STEP 88 is the separate agent
-- evaluation tables). Idempotent. Safe to re-run.
-- =====================================================================

-- 1. What a person sends with Apply, saved once ---------------------------
CREATE TABLE IF NOT EXISTS public.application_details (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  phone        TEXT,
  applying_for TEXT NOT NULL DEFAULT 'me',
  their_name   TEXT,
  their_age    SMALLINT,
  needs        TEXT,
  contact_by   TEXT NOT NULL DEFAULT 'email',
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.application_details DROP CONSTRAINT IF EXISTS application_details_shape;
ALTER TABLE public.application_details ADD CONSTRAINT application_details_shape CHECK (
  char_length(btrim(full_name)) BETWEEN 1 AND 120
  AND (phone IS NULL OR char_length(phone) <= 40)
  AND applying_for IN ('me', 'child', 'someone')
  AND (their_name IS NULL OR char_length(their_name) <= 120)
  AND (their_age IS NULL OR their_age BETWEEN 0 AND 120)
  AND (needs IS NULL OR char_length(needs) <= 600)
  AND contact_by IN ('email', 'phone', 'text', 'any')
);

ALTER TABLE public.application_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_details_own ON public.application_details;
CREATE POLICY application_details_own ON public.application_details
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.application_details FROM anon;

COMMENT ON TABLE public.application_details IS
  'What a person sends to a service with Apply, saved once (STEP 89). Their own row only; replies go to the account''s own email, which is never stored here.';

-- 2. Each application -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  sent_to     TEXT,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  source      TEXT,
  email_id    TEXT,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_id)
);

ALTER TABLE public.service_applications DROP CONSTRAINT IF EXISTS service_applications_shape;
ALTER TABLE public.service_applications ADD CONSTRAINT service_applications_shape CHECK (
  status IN ('sent', 'waiting', 'cancelled', 'failed', 'unreachable')
  AND (source IS NULL OR source IN ('task', 'milestone', 'apply_page'))
  AND (sent_to IS NULL OR char_length(sent_to) <= 320)
  AND (error IS NULL OR char_length(error) <= 500)
  AND jsonb_typeof(details) = 'object'
);

-- The team's list of services waiting for an address, and each person's daily limit.
CREATE INDEX IF NOT EXISTS service_applications_waiting_idx
  ON public.service_applications (resource_id) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS service_applications_user_recent_idx
  ON public.service_applications (user_id, created_at DESC);

ALTER TABLE public.service_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_applications_own_read ON public.service_applications;
CREATE POLICY service_applications_own_read ON public.service_applications
  FOR SELECT USING (user_id = auth.uid());

-- Only the server writes applications (app/api/me/applications), after its checks.
REVOKE ALL ON public.service_applications FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.service_applications FROM authenticated;

COMMENT ON TABLE public.service_applications IS
  'One-click Apply (STEP 89): one row per person per service. sent, waiting (no email address yet; sent once the team adds one), cancelled, failed or unreachable. details is exactly what was or will be sent. Read by its owner; written by the server only.';
