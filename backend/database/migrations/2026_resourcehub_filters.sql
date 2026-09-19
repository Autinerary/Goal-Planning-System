-- ============================================================================
-- ResourceHub filter expansion (Odosa): Connection Type to Norm, Age Range,
-- Special Tags, and commentary provenance.
--
-- Every filter here had to be given real data to stand on first. A filter
-- that renders but cannot narrow anything is worse than no filter — it
-- silently returns the same list and teaches people the feature is broken.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ---- Connection Type to Norm ------------------------------------------------
-- Odosa asked for 12 granular connection types. The existing 4-tier
-- relationship weighting (lived 1.0 / direct 0.6 / indirect 0.35 / ally 0.15)
-- is NOT replaced — the granular type sits alongside it and maps onto a tier,
-- so all existing weighted averages keep working untouched.
--
-- Note "undiagnosed_identifying" and "undiagnosed_unsure" both map to `lived`.
-- That is deliberate and matches the standing rule: assessment is expensive
-- and often inaccessible, so self-identification is valid here and is never
-- weighted below a diagnosis.
ALTER TABLE public.user_barriers
  ADD COLUMN IF NOT EXISTS connection_type TEXT
    CHECK (connection_type IS NULL OR connection_type IN (
      'diagnosed', 'undiagnosed_identifying', 'undiagnosed_unsure',
      'parent_guardian', 'sibling', 'caretaker',
      'educator', 'employer', 'coworker', 'therapist', 'researcher',
      'ally'
    ));

CREATE INDEX IF NOT EXISTS user_barriers_connection_type_idx
  ON public.user_barriers (user_id, connection_type);

-- Backfill the granular type from the coarse tier already on the row, so
-- existing users are not blanked. Only the unambiguous mappings are set;
-- 'lived' stays NULL because we cannot tell diagnosed from self-identifying
-- retroactively, and guessing would put words in someone's mouth about their
-- own diagnosis.
UPDATE public.user_barriers
   SET connection_type = CASE relationship
     WHEN 'ally' THEN 'ally'
     ELSE NULL
   END
 WHERE connection_type IS NULL
   AND relationship = 'ally';

-- Which tier a granular type carries, so weighting stays single-sourced.
CREATE OR REPLACE FUNCTION public.connection_type_tier(p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'diagnosed'               THEN 'lived'
    WHEN 'undiagnosed_identifying' THEN 'lived'
    WHEN 'undiagnosed_unsure'      THEN 'lived'
    WHEN 'parent_guardian'         THEN 'direct_support'
    WHEN 'sibling'                 THEN 'direct_support'
    WHEN 'caretaker'               THEN 'direct_support'
    WHEN 'educator'                THEN 'indirect_support'
    WHEN 'employer'                THEN 'indirect_support'
    WHEN 'coworker'                THEN 'indirect_support'
    WHEN 'therapist'               THEN 'indirect_support'
    WHEN 'researcher'              THEN 'indirect_support'
    WHEN 'ally'                    THEN 'ally'
    ELSE 'lived'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.connection_type_tier(TEXT) TO authenticated, anon, service_role;

-- Snapshot on ratings, same denormalisation reason as rater_relationships:
-- RLS blocks reading another rater's profile at render time.
ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS rater_connection_types JSONB NOT NULL DEFAULT '{}';

-- ---- Age Range --------------------------------------------------------------
-- Which age bands a resource actually serves. An array because most serve
-- several, and an empty array means "not stated" — which the UI must show as
-- unknown rather than quietly treating as "serves everyone".
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS age_ranges TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS resources_age_ranges_idx
  ON public.resources USING GIN (age_ranges);

COMMENT ON COLUMN public.resources.age_ranges IS
  'Age bands served: babies_0_4, children_5_8, preteens_9_12, teens_13_17, young_adults_18_30, adults_30_45, adults_45_65, seniors_65_plus. Empty = not stated, which is NOT the same as serves-everyone.';

-- ---- Autinerary's Own -------------------------------------------------------
-- First-party resources. Admin-set only: there is no user-facing write path,
-- because a self-applied "official" badge is worth nothing.
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS is_first_party BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS resources_first_party_idx
  ON public.resources (is_first_party) WHERE is_first_party = TRUE;

-- ---- Commentary provenance --------------------------------------------------
-- Odosa: commentaries need a source and a direct URL to the original post.
-- Without these a commentary is an unattributed quote, which is both less
-- useful and a credit problem.
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS source_type TEXT
    CHECK (source_type IS NULL OR source_type IN (
      'news',
      'reddit', 'twitter', 'facebook',
      'youtube', 'tiktok', 'instagram',
      'tidbits', 'other'
    )),
  ADD COLUMN IF NOT EXISTS source_url TEXT;

CREATE INDEX IF NOT EXISTS resources_source_type_idx
  ON public.resources (source_type) WHERE source_type IS NOT NULL;

-- ---- Special Tags: time-tiered trending -------------------------------------
-- Odosa asked for Trending split into Today (bronze), This week (silver),
-- This month (gold), This year (platinum). Longer sustained interest is the
-- rarer achievement, hence platinum at the top.
--
-- Replaces get_resource_badges from STEP 29, keeping its existing columns so
-- current callers do not break, and adding the tier. A resource returns ONE
-- trending tier — the highest it genuinely meets — rather than four badges.
--
-- Thresholds are fixed and real. Nothing is badged for merely existing.
CREATE OR REPLACE FUNCTION public.get_resource_badges(p_resource_ids UUID[])
RETURNS TABLE (
  resource_id       UUID,
  trending          BOOLEAN,
  trending_tier     TEXT,
  highly_requested  BOOLEAN,
  rare              BOOLEAN,
  first_party       BOOLEAN,
  saves_recent      INTEGER,
  saves_total       INTEGER,
  category_count    INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  WITH target AS (
    SELECT r.id, r.category, r.is_first_party
    FROM public.resources r
    WHERE r.id = ANY(p_resource_ids)
  ),
  windows AS (
    SELECT
      sr.resource_id,
      COUNT(*) FILTER (WHERE sr.created_at > NOW() - INTERVAL '1 day')::INT   AS d1,
      COUNT(*) FILTER (WHERE sr.created_at > NOW() - INTERVAL '7 days')::INT  AS d7,
      COUNT(*) FILTER (WHERE sr.created_at > NOW() - INTERVAL '30 days')::INT AS d30,
      COUNT(*) FILTER (WHERE sr.created_at > NOW() - INTERVAL '365 days')::INT AS d365,
      COUNT(*)::INT AS total
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
    -- Trending at all = meets the lowest tier.
    COALESCE(w.d1, 0) >= 3 OR COALESCE(w.d7, 0) >= 10
      OR COALESCE(w.d30, 0) >= 25 OR COALESCE(w.d365, 0) >= 100    AS trending,
    -- Highest tier genuinely met, hardest first.
    CASE
      WHEN COALESCE(w.d365, 0) >= 100 THEN 'platinum'
      WHEN COALESCE(w.d30, 0)  >= 25  THEN 'gold'
      WHEN COALESCE(w.d7, 0)   >= 10  THEN 'silver'
      WHEN COALESCE(w.d1, 0)   >= 3   THEN 'bronze'
      ELSE NULL
    END                                                            AS trending_tier,
    COALESCE(w.total, 0) >= 10                                     AS highly_requested,
    COALESCE(cc.n, 999) < 3                                        AS rare,
    COALESCE(t.is_first_party, FALSE)                              AS first_party,
    COALESCE(w.d7, 0),
    COALESCE(w.total, 0),
    COALESCE(cc.n, 0)
  FROM target t
  LEFT JOIN windows w ON w.resource_id = t.id
  LEFT JOIN cat_counts cc ON cc.category = t.category;
$$;

GRANT EXECUTE ON FUNCTION public.get_resource_badges(UUID[]) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.get_resource_badges(UUID[]) IS
  'Trending (tiered bronze/silver/gold/platinum by sustained saves), rare, highly-requested and first-party badges. Every tier has a fixed real threshold; nothing is badged for existing.';

COMMIT;
