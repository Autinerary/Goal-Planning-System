-- =====================================================================
-- ResourceHub search for tens of thousands of places (STEP 77)
--
-- The team's planning note (October 2026), Goal 0: up to 50,000 more
-- services in Ontario, domain-specific (diagnosis, therapists, doctors,
-- riding and animal programs, swimming, job training and hiring) and
-- general (study spots, cafés, zoos, amusement parks, restaurants, hotels,
-- banks), shown on every ResourceHub that reads this database.
--
-- Search read every matching place into the app's server and sorted there,
-- capped at 20,000 matches in id order. With about 60,000 places a broad
-- search would have ranked and counted an arbitrary third of them, and
-- nearby places could have been missing. This moves the work into the
-- database:
--
--   1. search_resource_page(p jsonb): the same filters, the same order
--      (near first, then the chosen sort) and the same counts as
--      servicehub-mvp/lib/supabase/queries.ts, one page at a time. Runs
--      with the caller's rights, so row-level security still applies.
--   2. A trigram index over each approved place's name, description and
--      category, which the text filters use.
--   3. resource_categories(): the category list, every category however
--      many places there are (it was read 1,000 rows at a time, to 20,000).
--   4. resources.import_batch: which bulk import added a row, so a batch can
--      be found, checked and, if needed, hidden again (status 'rejected');
--      nothing is deleted.
--   5. resources.geo_lat, geo_lng and geo_province: the map point and the
--      province from the location, kept as columns the database works out
--      when a row is written, so distance is plain arithmetic at search time.
--   6. The team columns on saved_resources (calls_scheduled, contract_sent,
--      added_to_team_at), from servicehub-mvp/scripts/add-build-team-fields.sql,
--      which never reached this runbook. "Add to my team" and "Sign them on"
--      use them (the planning note's three clicks). Nothing if they are there.
--
-- Until this is applied, ResourceHub searches the way it did, and nothing
-- else changes. Run after STEP 76. Idempotent. Safe to re-run.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 4. The import batch -------------------------------------------------------
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS import_batch TEXT;

CREATE INDEX IF NOT EXISTS resources_import_batch_idx
  ON public.resources (import_batch)
  WHERE import_batch IS NOT NULL;

COMMENT ON COLUMN public.resources.import_batch IS
  'Which bulk import added this row (e.g. ontario-2026-10), so the batch can be found and, if needed, hidden again (STEP 77). Empty for everything else.';

-- 2. The text index ---------------------------------------------------------
-- The same expression search_resource_page() matches against, written the
-- same way, so the planner can use it.
CREATE INDEX IF NOT EXISTS resources_search_trgm_idx
  ON public.resources
  USING gin ((lower(coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))) gin_trgm_ops)
  WHERE status = 'approved';

-- Provinces, as servicehub-mvp/lib/places/province.ts compares them:
-- "Ontario", "ON" and "on." are the same place. Defined before the columns
-- that use it.
CREATE OR REPLACE FUNCTION public.province_key(v TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN x IS NULL OR x = '' THEN NULL
    WHEN x IN ('ab', 'alberta') THEN 'AB'
    WHEN x IN ('bc', 'british columbia', 'colombie-britannique') THEN 'BC'
    WHEN x IN ('mb', 'manitoba') THEN 'MB'
    WHEN x IN ('nb', 'new brunswick', 'nouveau-brunswick') THEN 'NB'
    WHEN x IN ('nl', 'newfoundland and labrador', 'newfoundland', 'labrador', 'terre-neuve-et-labrador') THEN 'NL'
    WHEN x IN ('ns', 'nova scotia', 'nouvelle-écosse') THEN 'NS'
    WHEN x IN ('nt', 'northwest territories', 'territoires du nord-ouest') THEN 'NT'
    WHEN x IN ('nu', 'nunavut') THEN 'NU'
    WHEN x IN ('on', 'ontario') THEN 'ON'
    WHEN x IN ('pe', 'prince edward island', 'pei', 'île-du-prince-édouard') THEN 'PE'
    WHEN x IN ('qc', 'quebec', 'québec') THEN 'QC'
    WHEN x IN ('sk', 'saskatchewan') THEN 'SK'
    WHEN x IN ('yt', 'yukon', 'yukon territory') THEN 'YT'
    ELSE x
  END
  FROM (SELECT regexp_replace(lower(btrim(v)), '\.$', '') AS x) n
$$;

-- 5. The map point and province, worked out when a row is written ----------
-- A coordinate that is missing, not a number, or 0 counts as no point, as in
-- the app (calculateDistance is only used when lat and lng are set).
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS geo_lat DOUBLE PRECISION GENERATED ALWAYS AS (
    CASE WHEN (location->>'lat') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN nullif((location->>'lat')::double precision, 0) END
  ) STORED,
  ADD COLUMN IF NOT EXISTS geo_lng DOUBLE PRECISION GENERATED ALWAYS AS (
    CASE WHEN (location->>'lng') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN nullif((location->>'lng')::double precision, 0) END
  ) STORED,
  ADD COLUMN IF NOT EXISTS geo_province TEXT GENERATED ALWAYS AS (public.province_key(location->>'province')) STORED;

COMMENT ON COLUMN public.resources.geo_lat IS 'location.lat as a number, or empty when there is no usable point (STEP 77).';
COMMENT ON COLUMN public.resources.geo_lng IS 'location.lng as a number, or empty when there is no usable point (STEP 77).';
COMMENT ON COLUMN public.resources.geo_province IS 'location.province as a comparable key, ON for Ontario (STEP 77).';

-- 1. One page of search results ---------------------------------------------
-- p (all optional):
--   groups        [[term, ...], ...]  every group must match: any of its terms
--                                      in the name, description or category
--   soft          [term, ...]          count towards relevance only
--   categories    [text]               category, ignoring case
--   age_ranges    [text]               serves any of these
--   first_party   boolean              Autinerary's own
--   source_types  [text]
--   min_price, max_price
--   life          [keyword]            any of a life area's keywords
--   cond_keys     [text], cond_ids [uuid]   a condition: in the text, or rated for it
--   allowed       [uuid]               narrowed by ratings (minimum, norms, raters)
--   lat, lng, province, radius_km, max_km, near_first
--   sort          [{key, direction}]   relevance, rating, reviews, distance, newest, cost
--   offset, limit
-- Returns {total, near_count, rows: [{id, distance, avg, n}]}.
CREATE OR REPLACE FUNCTION public.search_resource_page(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  hay CONSTANT TEXT := 'lower(coalesce(r.name, '''') || '' '' || coalesce(r.description, '''') || '' '' || coalesce(r.category, ''''))';
  w TEXT[];
  g JSONB;
  t TEXT;
  ors TEXT[];
  all_terms TEXT[] := '{}';
  score TEXT := '0';
  ord TEXT[] := '{}';
  rule JSONB;
  dir TEXT;
  lat DOUBLE PRECISION := CASE WHEN jsonb_typeof(p->'lat') = 'number' THEN (p->>'lat')::double precision END;
  lng DOUBLE PRECISION := CASE WHEN jsonb_typeof(p->'lng') = 'number' THEN (p->>'lng')::double precision END;
  radius DOUBLE PRECISION := coalesce(CASE WHEN jsonb_typeof(p->'radius_km') = 'number' THEN (p->>'radius_km')::double precision END, 50);
  max_km DOUBLE PRECISION := CASE WHEN jsonb_typeof(p->'max_km') = 'number' THEN (p->>'max_km')::double precision END;
  prov TEXT := public.province_key(p->>'province');
  near_first BOOLEAN := coalesce((p->>'near_first')::boolean, false) AND lat IS NOT NULL AND lng IS NOT NULL;
  lim INTEGER := least(greatest(coalesce((p->>'limit')::integer, 20), 1), 100);
  off INTEGER := least(greatest(coalesce((p->>'offset')::integer, 0), 0), 100000);
  categories TEXT[];
  ages TEXT[];
  sources TEXT[];
  cond_ids UUID[];
  allowed UUID[];
  min_price NUMERIC := CASE WHEN jsonb_typeof(p->'min_price') = 'number' THEN (p->>'min_price')::numeric END;
  max_price NUMERIC := CASE WHEN jsonb_typeof(p->'max_price') = 'number' THEN (p->>'max_price')::numeric END;
  result JSONB;

  -- A search term as the app cleans it (lib/search/words.ts): lower case,
  -- letters, digits, spaces, apostrophes, hyphens and underscores.
  clean TEXT;
BEGIN
  w := ARRAY[format('r.status = %L', CASE WHEN p->>'status' = 'pending' THEN 'pending' ELSE 'approved' END)];

  -- Text groups: each must match.
  FOR g IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'groups') = 'array' THEN p->'groups' ELSE '[]'::jsonb END)
  LOOP
    ors := '{}';
    FOR t IN SELECT value FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g) = 'array' THEN g ELSE '[]'::jsonb END)
    LOOP
      clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
      CONTINUE WHEN clean = '';
      ors := ors || format('%s LIKE %L', hay, '%' || clean || '%');
      all_terms := all_terms || clean;
    END LOOP;
    IF array_length(ors, 1) > 0 THEN
      w := w || ('(' || array_to_string(ors, ' OR ') || ')');
    END IF;
  END LOOP;

  FOR t IN SELECT value FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'soft') = 'array' THEN p->'soft' ELSE '[]'::jsonb END)
  LOOP
    clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
    CONTINUE WHEN clean = '';
    all_terms := all_terms || clean;
  END LOOP;

  -- Relevance: each term in the name 10, in the description 5, as the app scores it.
  FOR t IN SELECT DISTINCT unnest(all_terms)
  LOOP
    score := score || format(' + (CASE WHEN lower(r.name) LIKE %1$L THEN 10 ELSE 0 END) + (CASE WHEN lower(coalesce(r.description, '''')) LIKE %1$L THEN 5 ELSE 0 END)', '%' || t || '%');
  END LOOP;

  IF jsonb_typeof(p->'categories') = 'array' AND jsonb_array_length(p->'categories') > 0 THEN
    SELECT array_agg(value) INTO categories FROM jsonb_array_elements_text(p->'categories');
    w := w || 'r.category ILIKE ANY ($3)'::text;
  END IF;
  IF jsonb_typeof(p->'age_ranges') = 'array' AND jsonb_array_length(p->'age_ranges') > 0 THEN
    SELECT array_agg(value) INTO ages FROM jsonb_array_elements_text(p->'age_ranges');
    w := w || 'r.age_ranges && $4'::text;
  END IF;
  IF coalesce((p->>'first_party')::boolean, false) THEN
    w := w || 'r.is_first_party'::text;
  END IF;
  IF jsonb_typeof(p->'source_types') = 'array' AND jsonb_array_length(p->'source_types') > 0 THEN
    SELECT array_agg(value) INTO sources FROM jsonb_array_elements_text(p->'source_types');
    w := w || 'r.source_type = ANY ($5)'::text;
  END IF;

  -- Price: a place with no price is shown unless a minimum above 0 is set.
  IF min_price IS NOT NULL AND min_price > 0 THEN
    w := w || format('r.price >= %s', min_price);
    IF max_price IS NOT NULL THEN w := w || format('r.price <= %s', max_price); END IF;
  ELSIF max_price IS NOT NULL THEN
    w := w || format('(r.price IS NULL OR r.price <= %s)', max_price);
  END IF;

  -- A life area: any of its keywords.
  IF jsonb_typeof(p->'life') = 'array' AND jsonb_array_length(p->'life') > 0 THEN
    ors := '{}';
    FOR t IN SELECT value FROM jsonb_array_elements_text(p->'life')
    LOOP
      clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
      CONTINUE WHEN clean = '';
      ors := ors || format('%s LIKE %L', hay, '%' || clean || '%');
    END LOOP;
    IF array_length(ors, 1) > 0 THEN w := w || ('(' || array_to_string(ors, ' OR ') || ')'); END IF;
  END IF;

  -- A condition: in the place's text, or among the norms it was rated for.
  IF jsonb_typeof(p->'cond_keys') = 'array' AND jsonb_array_length(p->'cond_keys') > 0 THEN
    ors := '{}';
    FOR t IN SELECT value FROM jsonb_array_elements_text(p->'cond_keys')
    LOOP
      clean := btrim(regexp_replace(regexp_replace(lower(t), '[^[:alnum:][:space:]''_-]+', ' ', 'g'), '\s+', ' ', 'g'));
      CONTINUE WHEN clean = '';
      ors := ors || format('%s LIKE %L', hay, '%' || clean || '%');
    END LOOP;
    IF jsonb_typeof(p->'cond_ids') = 'array' AND jsonb_array_length(p->'cond_ids') > 0 THEN
      SELECT array_agg(value::uuid) INTO cond_ids FROM jsonb_array_elements_text(p->'cond_ids');
      ors := ors || 'r.id = ANY ($6)'::text;
    END IF;
    IF array_length(ors, 1) > 0 THEN w := w || ('(' || array_to_string(ors, ' OR ') || ')'); END IF;
  END IF;

  -- Narrowed by ratings. An empty list means nothing matches.
  IF jsonb_typeof(p->'allowed') = 'array' THEN
    SELECT coalesce(array_agg(value::uuid), '{}') INTO allowed FROM jsonb_array_elements_text(p->'allowed');
    w := w || 'r.id = ANY ($7)'::text;
  END IF;

  -- Order: near first when asked, then each sort rule, then id.
  IF near_first THEN
    ord := ord || 'near_group'::text || 'CASE WHEN near_group = 1 THEN no_province::int END'::text || 'distance ASC NULLS LAST'::text;
  END IF;
  FOR rule IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'sort') = 'array' THEN p->'sort' ELSE '[{"key": "relevance", "direction": "desc"}]'::jsonb END)
  LOOP
    dir := CASE WHEN rule->>'direction' = 'asc' THEN 'ASC' ELSE 'DESC' END;
    CASE rule->>'key'
      WHEN 'cost' THEN ord := ord || ('price ' || dir || ' NULLS LAST');
      WHEN 'rating' THEN ord := ord || ('avg_rating ' || dir) || 'n DESC'::text;
      WHEN 'reviews' THEN ord := ord || ('n ' || dir);
      WHEN 'distance' THEN ord := ord || (CASE WHEN dir = 'ASC' THEN 'distance ASC NULLS LAST' ELSE 'distance DESC NULLS FIRST' END);
      WHEN 'newest' THEN ord := ord || ('created_at ' || dir);
      ELSE ord := ord || ('score ' || dir) || 'n DESC'::text;
    END CASE;
  END LOOP;
  ord := ord || 'id'::text;

  EXECUTE format($q$
    WITH s AS (
      SELECT resource_id, avg(overall_score)::double precision AS avg_rating, count(*)::int AS n
      FROM public.ratings
      GROUP BY resource_id
    ),
    m AS (
      SELECT r.id,
             (%1$s) + coalesce(s.avg_rating, 0) AS score,
             coalesce(s.avg_rating, 0) AS avg_rating,
             coalesce(s.n, 0) AS n,
             r.price,
             r.created_at,
             d.distance,
             r.geo_province IS NULL AS no_province,
             CASE
               WHEN d.distance IS NOT NULL THEN CASE WHEN d.distance <= $8 THEN 0 ELSE 2 END
               WHEN r.geo_province IS NULL THEN 1
               WHEN $9::text IS NOT NULL AND r.geo_province = $9::text THEN 1
               ELSE 2
             END AS near_group
      FROM public.resources r
      LEFT JOIN s ON s.resource_id = r.id
      CROSS JOIN LATERAL (
        SELECT CASE
          WHEN $1::double precision IS NULL OR $2::double precision IS NULL OR r.geo_lat IS NULL OR r.geo_lng IS NULL THEN NULL
          ELSE 6371 * 2 * asin(least(1, sqrt(
            power(sin(radians((r.geo_lat - $1::double precision) / 2)), 2)
            + cos(radians($1::double precision)) * cos(radians(r.geo_lat))
              * power(sin(radians((r.geo_lng - $2::double precision) / 2)), 2)
          )))
        END AS distance
      ) d
      WHERE %2$s
    ),
    k AS (
      SELECT m.*, row_number() OVER (ORDER BY %3$s) AS ord
      FROM m
      WHERE $10::double precision IS NULL OR m.distance IS NULL OR m.distance <= $10::double precision
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM k),
      'near_count', (SELECT count(*) FROM k WHERE k.near_group = 0),
      'rows', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', k.id, 'distance', k.distance, 'avg', k.avg_rating, 'n', k.n) ORDER BY k.ord)
        FROM k WHERE k.ord > $11 AND k.ord <= $11 + $12
      ), '[]'::jsonb)
    )
  $q$, score, array_to_string(w, ' AND '), array_to_string(ord, ', '))
  INTO result
  USING lat, lng, categories, ages, sources, cond_ids, allowed, radius, prov, max_km, off, lim;

  RETURN result;
END
$fn$;

COMMENT ON FUNCTION public.search_resource_page(JSONB) IS
  'One page of ResourceHub search results: the filters, near-first order and counts of servicehub-mvp/lib/supabase/queries.ts, done in the database for tens of thousands of places. Runs with the caller''s rights (STEP 77).';

GRANT EXECUTE ON FUNCTION public.search_resource_page(JSONB) TO anon, authenticated;

-- 3. The category list ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resource_categories()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT category FROM public.resources
  WHERE status = 'approved' AND category IS NOT NULL AND category <> ''
  ORDER BY 1
$$;

COMMENT ON FUNCTION public.resource_categories() IS
  'Every category among approved places, for ResourceHub''s filter list (STEP 77).';

GRANT EXECUTE ON FUNCTION public.resource_categories() TO anon, authenticated;

-- 6. The team columns -------------------------------------------------------
ALTER TABLE public.saved_resources
  ADD COLUMN IF NOT EXISTS calls_scheduled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS added_to_team_at TIMESTAMPTZ;

COMMENT ON COLUMN public.saved_resources.calls_scheduled IS
  'A first meeting is booked, or to be booked: set by "Add to my team" or by hand in Build a Team (STEP 77).';
COMMENT ON COLUMN public.saved_resources.added_to_team_at IS
  'When they were signed on (status current) (STEP 77).';
