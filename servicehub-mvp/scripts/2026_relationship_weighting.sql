-- ============================================================================
-- Relationship weighting: whose experience is this? (Odosa)
--
-- The identification problem, stated honestly: we cannot reliably PROVE that
-- someone is autistic, a visible minority, queer, or low-income. Documents are
-- forgeable (and now trivially so with AI image editing), facial recognition is
-- both defeatable and wildly inappropriate for these categories, and demanding
-- proof would exclude exactly the people this product exists for — the
-- undiagnosed, the self-diagnosed, and anyone for whom assessment is
-- unaffordable or unsafe.
--
-- So we stop trying to verify IDENTITY and instead make RELATIONSHIP explicit,
-- then weight by it. A rating from someone with lived experience of a norm
-- counts for more than one from a parent, which counts for more than one from
-- a professional who works with them, which counts for more than an ally.
-- Nobody is silenced; the signal is just weighted honestly and shown openly.
--
-- Tiers (Odosa's framing: members > direct support > indirect > allies):
--   lived            1.00  I have this norm
--   direct_support   0.60  parent, sibling, partner — shares daily life
--   indirect_support 0.35  educator, therapist, employer, researcher
--   ally             0.15  supporter with no direct connection
--
-- Goal Planning onboarding ALREADY asks this (connectionTypes: self / parent /
-- sibling / educator / employer / therapist / researcher / ally) but discarded
-- the per-norm answer. This gives it somewhere to live.
--
-- Idempotent. Applies to ratings and to Tidbits.
-- ============================================================================

-- ---- Per-norm relationship ---------------------------------------------------
ALTER TABLE public.user_barriers
  ADD COLUMN IF NOT EXISTS relationship TEXT NOT NULL DEFAULT 'lived'
    CHECK (relationship IN ('lived', 'direct_support', 'indirect_support', 'ally'));

CREATE INDEX IF NOT EXISTS user_barriers_relationship_idx
  ON public.user_barriers (user_id, relationship);

COMMENT ON COLUMN public.user_barriers.relationship IS
  'How this person relates to the norm: lived experience, direct support (family), indirect support (professional), or ally. Drives rating weight.';

-- ---- Snapshot on ratings -----------------------------------------------------
-- Same denormalisation pattern as rater_diagnostics / rater_org_ids: RLS blocks
-- reading other raters' profiles, so the relationship is captured at write time.
ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS rater_relationships JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.ratings.rater_relationships IS
  'Snapshot of { barrier_type: relationship } for the rater at rating time. Powers weighted averages without cross-user reads.';

-- ---- Weight lookup -----------------------------------------------------------
-- Kept in SQL as well as TS so reports/queries can weight consistently.
CREATE OR REPLACE FUNCTION public.relationship_weight(p_relationship TEXT)
RETURNS REAL
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_relationship
    WHEN 'lived'            THEN 1.00
    WHEN 'direct_support'   THEN 0.60
    WHEN 'indirect_support' THEN 0.35
    WHEN 'ally'             THEN 0.15
    ELSE 1.00   -- unknown/legacy rows are treated as lived, matching the default
  END::REAL;
$$;

GRANT EXECUTE ON FUNCTION public.relationship_weight(TEXT) TO authenticated, service_role;
