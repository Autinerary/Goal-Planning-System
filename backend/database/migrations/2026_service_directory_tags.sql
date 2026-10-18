-- =====================================================================
-- The service directory's tags and fields (STEP 78)
--
-- The team's planning note (October 2026), "Goal 1: Service Directory":
-- education levels from daycare to a PhD, free or paid on every service with
-- its cost in its own currency, "requires a diagnosis", "provides medical
-- diagnosis", funding resources, new to the country or city, the age of a
-- service, community groups (local, in person, online), charities, advocacy,
-- respite care, recreation, career levels, adulting, parenting; "already
-- read" for articles; "self-diagnosed" as a connection to a norm; and Spot
-- Guides, who review what the service-adding loop finds.
--
--   1. resources.tags: the tags, from one vocabulary
--      (servicehub-mvp/lib/filters/tags.ts), with an index.
--   2. resources.cost_type ('free' or 'paid'), cost_source ('listed': the
--      place or its operator says so; 'usual': what that kind of place
--      usually is), and currency (the price's currency, CAD in Canada).
--      price stays the amount.
--   3. resources.delivery ('in_person', 'online' or 'both') and started_on
--      (when the service began, when known).
--   4. Every existing place gets free or paid and its currency from its
--      category (and from its price when it has one), places on the map are
--      in person, and tags that their kind and name make plain (a daycare,
--      a secondary school, an employment service, a support group, a park).
--      Nothing else is changed, and a place that already has them is left.
--   5. resource_reads: which articles each person has opened, for "Already
--      read". Each person sees and writes only their own.
--   6. 'self_diagnosed' as a connection to a norm, weighed as lived
--      experience, like the others who are not formally diagnosed.
--   7. spot_guides and is_spot_guide(): who may review the places the
--      service-adding loop finds (admins may too).
--   8. search_resource_page() understands tags, free or paid, online, and the
--      age of a service.
--
-- Run after STEP 77. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Tags --------------------------------------------------------------------
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS resources_tags_idx ON public.resources USING gin (tags);

COMMENT ON COLUMN public.resources.tags IS
  'What the service is or offers, from servicehub-mvp/lib/filters/tags.ts (edu_daycare, funding, requires_diagnosis, ...). Never what it is like for someone with a norm: that comes from ratings (STEP 78).';

-- 2 and 3. Cost, currency, delivery, start -----------------------------------
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS cost_type TEXT,
  ADD COLUMN IF NOT EXISTS cost_source TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS delivery TEXT,
  ADD COLUMN IF NOT EXISTS started_on DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_cost_type_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_cost_type_check CHECK (cost_type IS NULL OR cost_type IN ('free', 'paid'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_cost_source_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_cost_source_check CHECK (cost_source IS NULL OR cost_source IN ('listed', 'usual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_delivery_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_delivery_check CHECK (delivery IS NULL OR delivery IN ('in_person', 'online', 'both'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_currency_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_currency_check CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS resources_cost_type_idx ON public.resources (cost_type) WHERE status = 'approved';

COMMENT ON COLUMN public.resources.cost_type IS 'free or paid (STEP 78). With cost_source: listed (the place says so) or usual (what that kind of place usually is).';
COMMENT ON COLUMN public.resources.currency IS 'The currency of price, ISO 4217 (CAD in Canada) (STEP 78).';
COMMENT ON COLUMN public.resources.delivery IS 'in_person, online or both (STEP 78).';
COMMENT ON COLUMN public.resources.started_on IS 'When the service began, when known; the age of a service falls back to when it was added (STEP 78).';

-- 4. What every existing place already makes plain ---------------------------
-- A price says it outright.
UPDATE public.resources SET cost_type = 'paid', cost_source = 'listed'
 WHERE cost_type IS NULL AND price > 0;
UPDATE public.resources SET cost_type = 'free', cost_source = 'listed'
 WHERE cost_type IS NULL AND price = 0;

-- Otherwise, what the kind of place usually is.
UPDATE public.resources
   SET cost_type = CASE
         WHEN category = 'School' AND name ~* '(universit|\mcollege\M|polytechnic|montessori|academy|private|preparatory|\mprep\M)' THEN 'paid'
         WHEN category IN ('Park', 'Community Center', 'Support Group', 'Employment', 'Food Support', 'Shelter',
                           'Social Services', 'School', 'Doctor', 'Funding & Benefits', 'Newcomer Services',
                           'Education Support', 'Legal & Future Planning', 'organization', 'Organization') THEN 'free'
         ELSE 'paid'
       END,
       cost_source = 'usual'
 WHERE cost_type IS NULL;

-- Canadian places are priced in Canadian dollars.
UPDATE public.resources SET currency = 'CAD'
 WHERE currency IS NULL
   AND (geo_province IN ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT')
        OR coalesce(location->>'country', 'Canada') IN ('Canada', 'CA'));

-- A place on the map is visited in person.
UPDATE public.resources SET delivery = 'in_person'
 WHERE delivery IS NULL AND geo_lat IS NOT NULL AND source_type = 'openstreetmap';

-- Tags the kind and name make plain. Each only adds a tag the place lacks.
UPDATE public.resources SET tags = array_append(tags, 'edu_daycare')
 WHERE NOT ('edu_daycare' = ANY (tags))
   AND (category = 'Child Care' OR name ~* '(day ?care|child ?care|early learning|nursery school)');
UPDATE public.resources SET tags = array_append(tags, 'edu_kindergarten')
 WHERE NOT ('edu_kindergarten' = ANY (tags)) AND name ~* '(kindergarten|preschool|pre-school)';
UPDATE public.resources SET tags = array_append(tags, 'edu_elementary')
 WHERE NOT ('edu_elementary' = ANY (tags)) AND category = 'School'
   AND name ~* '(public school|elementary|junior school|primary school|\mp\.s\.)' AND name !~* 'senior public school';
UPDATE public.resources SET tags = array_append(tags, 'edu_middle')
 WHERE NOT ('edu_middle' = ANY (tags)) AND category = 'School' AND name ~* '(middle school|senior public school|intermediate school)';
UPDATE public.resources SET tags = array_append(tags, 'edu_secondary')
 WHERE NOT ('edu_secondary' = ANY (tags)) AND category = 'School'
   AND name ~* '(secondary school|high school|collegiate|composite school|\ms\.s\.)';
UPDATE public.resources SET tags = array_append(tags, 'edu_university')
 WHERE NOT ('edu_university' = ANY (tags)) AND category = 'School' AND name ~* '(university|université)';
UPDATE public.resources SET tags = array_append(tags, 'edu_college')
 WHERE NOT ('edu_college' = ANY (tags)) AND category = 'School'
   AND name ~* '(algonquin|cambrian|canadore|centennial|boréal|boreal|conestoga|confederation college|durham college|fanshawe|fleming college|george brown|georgian college|humber|la cité|lambton college|loyalist college|mohawk college|niagara college|northern college|st\.? clair college|st\.? lawrence college|sault college|seneca|sheridan)';
UPDATE public.resources SET tags = array_append(tags, 'job_opportunities')
 WHERE NOT ('job_opportunities' = ANY (tags)) AND category = 'Employment';
UPDATE public.resources SET tags = array_append(tags, 'community_group')
 WHERE NOT ('community_group' = ANY (tags)) AND category = 'Support Group';
UPDATE public.resources SET tags = array_append(tags, 'recreation')
 WHERE NOT ('recreation' = ANY (tags))
   AND category IN ('Park', 'Recreation', 'Swimming', 'Horseback Riding', 'Zoo & Aquarium', 'Amusement Park', 'Museum');

-- 5. Articles read -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resource_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);

ALTER TABLE public.resource_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_reads_own_read ON public.resource_reads;
CREATE POLICY resource_reads_own_read ON public.resource_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS resource_reads_own_write ON public.resource_reads;
CREATE POLICY resource_reads_own_write ON public.resource_reads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS resource_reads_own_delete ON public.resource_reads;
CREATE POLICY resource_reads_own_delete ON public.resource_reads
  FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.resource_reads TO authenticated;

COMMENT ON TABLE public.resource_reads IS
  'Articles each person has opened, for "Already read" (STEP 78). Only the person sees and writes their own.';

-- 6. Self-diagnosed ----------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.user_barriers'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%undiagnosed_identifying%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_barriers DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.user_barriers ADD CONSTRAINT user_barriers_connection_type_check
  CHECK (connection_type IS NULL OR connection_type IN (
    'diagnosed', 'self_diagnosed', 'undiagnosed_identifying', 'undiagnosed_unsure',
    'parent_guardian', 'sibling', 'caretaker',
    'educator', 'employer', 'coworker', 'therapist', 'researcher',
    'ally'
  ));

CREATE OR REPLACE FUNCTION public.connection_type_tier(p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'diagnosed'               THEN 'lived'
    WHEN 'self_diagnosed'          THEN 'lived'
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

-- 7. Spot Guides -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spot_guides (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.spot_guides ENABLE ROW LEVEL SECURITY;

-- No policies: rows are added in the SQL editor, like admin_users (STEP 55).
COMMENT ON TABLE public.spot_guides IS
  'People who review the places the service-adding loop finds (STEP 78). Rows are added only in the SQL editor.';

CREATE OR REPLACE FUNCTION public.is_spot_guide()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.spot_guides WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.is_spot_guide() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_spot_guide() TO authenticated;

COMMENT ON FUNCTION public.is_spot_guide() IS
  'Whether the signed-in caller is a Spot Guide or an admin (STEP 78). Answers only for the caller.';

-- The batches waiting for a Spot Guide, with how many places are pending,
-- approved and hidden in each. Only Spot Guides and admins get rows.
CREATE OR REPLACE FUNCTION public.spot_guide_batches()
RETURNS TABLE (batch TEXT, pending BIGINT, approved BIGINT, hidden BIGINT, first_added TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT import_batch,
         count(*) FILTER (WHERE status = 'pending'),
         count(*) FILTER (WHERE status = 'approved'),
         count(*) FILTER (WHERE status = 'rejected'),
         min(created_at)
  FROM public.resources
  WHERE import_batch IS NOT NULL AND public.is_spot_guide()
  GROUP BY import_batch
  ORDER BY min(created_at) DESC
$$;

REVOKE ALL ON FUNCTION public.spot_guide_batches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spot_guide_batches() TO authenticated;

COMMENT ON FUNCTION public.spot_guide_batches() IS
  'The import and loop batches with their pending, approved and hidden counts, for Spot Guides and admins only (STEP 78).';

-- 8. Search with tags, cost, delivery and age (replaces STEP 77's) -----------
-- p as in STEP 77, and:
--   tag_groups    [[tag, ...], ...]   every group, any of its tags
--   cost_type     'free' | 'paid'
--   delivery      'online' | 'in_person'   (each includes 'both')
--   started_after 'YYYY-MM-DD'        started, or was added, on or after
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

  -- Tags (STEP 78): every group, any of its tags. The app adds the tags
  -- under a chosen one ("Kindergarten" finds junior and senior kindergarten).
  FOR g IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'tag_groups') = 'array' THEN p->'tag_groups' ELSE '[]'::jsonb END)
  LOOP
    IF jsonb_typeof(g) = 'array' AND jsonb_array_length(g) > 0 THEN
      w := w || format('r.tags && %L::text[]', (
        SELECT array_agg(value) FROM jsonb_array_elements_text(g) WHERE value ~ '^[a-z0-9_]{1,60}$'
      ));
    END IF;
  END LOOP;

  -- Free or paid, online or in person, and how long ago it started (STEP 78).
  IF p->>'cost_type' IN ('free', 'paid') THEN
    w := w || format('r.cost_type = %L', p->>'cost_type');
  END IF;
  IF p->>'delivery' = 'online' THEN
    w := w || 'r.delivery IN (''online'', ''both'')'::text;
  ELSIF p->>'delivery' = 'in_person' THEN
    w := w || 'r.delivery IN (''in_person'', ''both'')'::text;
  END IF;
  IF coalesce(p->>'started_after', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    w := w || format('coalesce(r.started_on, r.created_at::date) >= %L::date', p->>'started_after');
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
  'One page of ResourceHub search results: the filters, near-first order and counts of servicehub-mvp/lib/supabase/queries.ts, done in the database. Runs with the caller''s rights (STEP 77; tags, cost, delivery and age, STEP 78).';

GRANT EXECUTE ON FUNCTION public.search_resource_page(JSONB) TO anon, authenticated;
