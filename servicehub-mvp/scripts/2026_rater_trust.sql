-- ============================================================================
-- Rater trust & norm verification (Odosa).
--
-- Goal: make the norm-level rating breakdown ("rated by people with Autism
-- Level 3") trustworthy, WITHOUT collecting medical records.
--
-- Deliberately NOT storing diagnosis documents. Doing so would make us a
-- custodian of health information (PHIPA / PIPEDA / HIPAA / GDPR special
-- category) and would exclude self-diagnosed and undiagnosed people — who are
-- disproportionately the users this product exists to serve.
--
-- Instead:
--   1. Every norm carries an explicit verification_method, defaulting to
--      'self' (self-identified). This is shown honestly in the UI.
--   2. Trust is earned from real behaviour — rating volume, helpfulness,
--      community karma — computed by rater_trust() below.
--
-- Forward-compatible: professional attestation (phase 2) simply sets
-- verification_method='professional' + verified_at + verifier_type. Only that
-- metadata is ever stored — never the document, never diagnosis details.
--
-- Idempotent. Run once against the shared Supabase project.
-- ============================================================================

ALTER TABLE public.user_barriers
  ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'self'
    CHECK (verification_method IN ('self', 'peer', 'professional')),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  -- e.g. 'clinician', 'support_worker', 'educator'. Never the person's name,
  -- never the diagnosis, never the document.
  ADD COLUMN IF NOT EXISTS verifier_type TEXT;

CREATE INDEX IF NOT EXISTS user_barriers_verification_idx
  ON public.user_barriers (user_id, verification_method);

-- ---- Rater trust ------------------------------------------------------------
-- A rater's trust tier, derived entirely from behaviour we already record.
--   ratings_count  — how many resources they've rated
--   helpful_total  — total "helpful" marks their ratings received
--   karma          — community reputation (0 when they never opted in)
--
-- tier: 'new' | 'contributing' | 'trusted' | 'established'
CREATE OR REPLACE FUNCTION public.rater_trust(p_user_id UUID)
RETURNS TABLE (
  ratings_count INTEGER,
  helpful_total INTEGER,
  karma         INTEGER,
  tier          TEXT
)
LANGUAGE sql
STABLE
AS $$
  WITH r AS (
    SELECT
      COUNT(*)::INT                        AS ratings_count,
      COALESCE(SUM(helpful_count), 0)::INT AS helpful_total
    FROM public.ratings
    WHERE user_id = p_user_id
  ),
  k AS (
    SELECT COALESCE(
      (SELECT cp.karma FROM public.community_profiles cp WHERE cp.user_id = p_user_id),
      0
    )::INT AS karma
  )
  SELECT
    r.ratings_count,
    r.helpful_total,
    k.karma,
    CASE
      WHEN r.ratings_count >= 15 AND r.helpful_total >= 20 THEN 'established'
      WHEN r.ratings_count >= 5  AND r.helpful_total >= 5  THEN 'trusted'
      WHEN r.ratings_count >= 1                            THEN 'contributing'
      ELSE 'new'
    END AS tier
  FROM r, k;
$$;

GRANT EXECUTE ON FUNCTION public.rater_trust(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.rater_trust(UUID) IS
  'Behaviour-derived rater trust tier. No medical data involved.';
