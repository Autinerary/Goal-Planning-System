-- ============================================================================
-- Trending / Rare / Highly-Requested badges (Odosa).
--
-- All three are computed from behaviour that already happens — saves,
-- ratings, and how many resources exist in a category — never invented.
-- A resource with no real signal gets no badge; there is no default score
-- that fakes popularity.
--
--   trending           saved 3+ times in the last 14 days
--   highly_requested    saved 10+ times total (all-time demand, not a spike)
--   rare               fewer than 3 APPROVED resources share its category —
--                      genuinely hard to find, not lightly used
--
-- Thresholds are deliberately real numbers a human can sanity-check, not
-- percentiles that would silently badge SOMETHING even with two resources
-- and one save.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_resource_badges(p_resource_ids UUID[])
RETURNS TABLE (
  resource_id       UUID,
  trending          BOOLEAN,
  highly_requested  BOOLEAN,
  rare              BOOLEAN,
  saves_recent      INTEGER,
  saves_total       INTEGER,
  category_count    INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  WITH target AS (
    SELECT r.id, r.category
    FROM public.resources r
    WHERE r.id = ANY(p_resource_ids)
  ),
  recent AS (
    SELECT sr.resource_id, COUNT(*)::INT AS n
    FROM public.saved_resources sr
    WHERE sr.resource_id = ANY(p_resource_ids)
      AND sr.created_at > NOW() - INTERVAL '14 days'
    GROUP BY sr.resource_id
  ),
  total AS (
    SELECT sr.resource_id, COUNT(*)::INT AS n
    FROM public.saved_resources sr
    WHERE sr.resource_id = ANY(p_resource_ids)
    GROUP BY sr.resource_id
  ),
  cat_counts AS (
    SELECT category, COUNT(*)::INT AS n
    FROM public.resources
    WHERE status = 'approved'
    GROUP BY category
  )
  SELECT
    t.id,
    COALESCE(rc.n, 0) >= 3                    AS trending,
    COALESCE(tt.n, 0) >= 10                   AS highly_requested,
    COALESCE(cc.n, 999) < 3                   AS rare,
    COALESCE(rc.n, 0),
    COALESCE(tt.n, 0),
    COALESCE(cc.n, 0)
  FROM target t
  LEFT JOIN recent rc ON rc.resource_id = t.id
  LEFT JOIN total tt ON tt.resource_id = t.id
  LEFT JOIN cat_counts cc ON cc.category = t.category;
$$;

GRANT EXECUTE ON FUNCTION public.get_resource_badges(UUID[]) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.get_resource_badges(UUID[]) IS
  'Trending/rare/highly-requested badges from real saves and category scarcity. No resource is badged without meeting a real, fixed threshold.';

COMMIT;
