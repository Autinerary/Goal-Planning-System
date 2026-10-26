-- =====================================================================
-- One-click sign-up for local services: a request sent for the person (STEP 91)
--
-- The account holder's choice, 25 October 2026, for services with no online
-- sign-up (most of ResourceHub: clinics, programs, centres): Sign me up sends
-- the person's request instead, by email where the listing has an address, or
-- through the contact or booking form on the listing's own website where it
-- only has a website. The service replies to the person.
--
--   service_signups gains two ways it ran: 'email' (Autinerary emailed the
--   request) and 'form' (the website's contact form was filled in), and one
--   outcome: 'requested' (the request went; the service replies to them).
--   A listing's key is 'r-' and its id without dashes.
--
--   service_email_optouts (STEP 79) is also where "Stop them", in each
--   request, puts an address: one list, which every email to a service checks
--   (surveys, "you were rated", and now requests). Only its description
--   changes here.
--
-- Nothing is deleted. Run after STEP 90. Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.service_signups DROP CONSTRAINT IF EXISTS service_signups_shape;
ALTER TABLE public.service_signups ADD CONSTRAINT service_signups_shape CHECK (
  service ~ '^[a-z0-9-]{2,40}$'
  AND runner IN ('extension', 'desktop', 'mobile', 'server', 'partner', 'email', 'form')
  AND status IN ('started', 'signed_up', 'check_email', 'needs_you', 'exists', 'failed', 'requested')
  AND (detail IS NULL OR char_length(detail) <= 300)
);

COMMENT ON TABLE public.service_signups IS
  'One-click sign-up (STEPs 90, 91): one row per person per service: an account made on an online service (extension, desktop, mobile, server, partner), or a request sent to a local service (email; form, its website''s contact form). Never a password. Read by its owner; written by the server only.';

COMMENT ON TABLE public.service_email_optouts IS
  'Services'' addresses that asked Autinerary not to email them, which every email to a service checks: the rating sweep''s and the surveys (STEP 79; added in the SQL editor when one replies "stop"), and requests sent with Sign me up (STEP 91; "Stop them", a signed link in each request, adds it).';
