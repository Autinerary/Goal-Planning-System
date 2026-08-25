-- ============================================================================
-- Rating groups: "how <organisation>'s members rate this resource" (Odosa).
--
-- The payoff of organisations — an org's members often trust their own
-- community's ratings most. Same shape as the norm x level breakdown.
--
-- Why denormalise: RLS on organization_members only lets you see rows for orgs
-- YOU belong to, so we can't read other raters' memberships at read time.
-- Instead we snapshot the rater's org ids onto their rating when it's written
-- — exactly the pattern already used by ratings.rater_diagnostics.
--
-- Snapshot semantics are a feature, not a bug: the rating reflects who the
-- person was affiliated with WHEN they rated. Leaving an org later doesn't
-- rewrite history.
--
-- Idempotent. Requires 2026_organizations.sql.
-- ============================================================================

ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS rater_org_ids UUID[] NOT NULL DEFAULT '{}';

-- GIN so "ratings from members of org X" stays fast as volume grows.
CREATE INDEX IF NOT EXISTS ratings_rater_org_ids_idx
  ON public.ratings USING GIN (rater_org_ids);

COMMENT ON COLUMN public.ratings.rater_org_ids IS
  'Snapshot of the rater''s organisation ids at rating time. Powers the per-organisation rating breakdown without cross-user reads.';
