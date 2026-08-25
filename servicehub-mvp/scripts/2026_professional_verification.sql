-- ============================================================================
-- Professional attestation — phase 2 of norm verification (Odosa).
--
-- A clinician / support worker confirms a person's norm via a ONE-TIME LINK.
--
-- WHAT WE STORE:  verification_method='professional', verified_at, verifier_type
-- WHAT WE NEVER STORE: the diagnosis, any document, any file upload, the
--   verifier's name or credentials, or free-text clinical notes.
-- There is deliberately no upload path anywhere in this feature, so we never
-- become a custodian of health records (PHIPA / PIPEDA / HIPAA / GDPR).
--
-- Security model:
--   * The link contains a 32-byte random token. Only its SHA-256 hash is
--     stored, so a database leak cannot be used to forge a verification.
--   * Single use — completing a request marks it 'completed'.
--   * Expires (default 14 days).
--   * The verifier needs no account; the page is public but useless without
--     the token, and tokens are not enumerable.
--
-- Idempotent. Run once. Requires 2026_rater_trust.sql (verification_method).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.norm_verification_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Which norm is being attested (matches user_barriers.barrier_type).
  barrier_type  TEXT NOT NULL,
  -- SHA-256 of the one-time token. The raw token is shown to the user once
  -- and never persisted.
  token_hash    TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'expired', 'revoked')),
  -- Set on completion. A ROLE only — never a name, licence number, or notes.
  verifier_type TEXT CHECK (
    verifier_type IS NULL
    OR verifier_type IN ('clinician', 'support_worker', 'educator')
  ),
  completed_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS norm_verification_user_idx
  ON public.norm_verification_requests (user_id, status);

ALTER TABLE public.norm_verification_requests ENABLE ROW LEVEL SECURITY;

-- The requester can see and revoke their own requests. Token lookup and
-- completion go through the service-role API (which bypasses RLS), so the
-- public verifier page never needs a policy here.
DROP POLICY IF EXISTS norm_verification_own_select ON public.norm_verification_requests;
CREATE POLICY norm_verification_own_select ON public.norm_verification_requests
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS norm_verification_own_update ON public.norm_verification_requests;
CREATE POLICY norm_verification_own_update ON public.norm_verification_requests
  FOR UPDATE USING (user_id = auth.uid());

COMMENT ON TABLE public.norm_verification_requests IS
  'One-time professional attestation links. Stores only a hashed token and a verifier ROLE — never documents, diagnoses, or verifier identities.';
