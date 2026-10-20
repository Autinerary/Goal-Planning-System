-- =====================================================================
-- The Path Market's models and filters (STEP 85)
--
-- The team's notes, October 2026, on the Path Market:
--   * "reorganized using the same filters as is in the ResourceHub ... make
--     the first category the 'Path Categories' (Education, Career,
--     Relationships, Health & Wellness, and Norms) [and] a new dropdown layer
--     [of] specialized categories for each life category ... 'Entrepreneurship'
--     and 'Medicine & Science' should both be under Career, 'Medicine &
--     Science' should also be under Education, Veganism should be under
--     Health". path_categories.life_areas says which life categories each
--     specialised category is under (education, career, relationships,
--     health, barrier = Norms); one can be under several.
--   * "Change title of 'Entrepreneurship & ADHD/Neurodivergence' to
--     'Entrepreneurship & Neurodivergence'".
--   * "Each path in the path market [is] given ... associated life category
--     labels, associated Norm labels (ex. Model Jet should have ADHD, OCD,
--     Depression, and Self-Diagnosed), individual races within it, and
--     associated people ... contributors & a short description". On
--     path_models: category_keys, norms (ResourceHub's norm ids, as
--     lib/norms/taxonomy.ts), connection_types (ResourceHub's "Connection Type
--     to Norm", e.g. self_diagnosed), races ([{name, area, milestones[]}]),
--     people ([{role, note}]: roles, not names) and contributors. A path can
--     be one race and no people.
--   * Model Jet goes under Entrepreneurship & Neurodivergence with those
--     labels. Its status is unchanged: it stays a draft until Odosa reviews it.
--
-- "No invented curricula for Recovery/Public Health/Entrepreneurship": this
-- adds labels and structure only, no races or steps for any of them. Nothing
-- is deleted.
--
-- Run after STEP 84. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Which life categories each specialised category is under.
ALTER TABLE public.path_categories
  ADD COLUMN IF NOT EXISTS life_areas TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.path_categories DROP CONSTRAINT IF EXISTS path_categories_life_areas_known;
ALTER TABLE public.path_categories ADD CONSTRAINT path_categories_life_areas_known
  CHECK (life_areas <@ ARRAY['education', 'career', 'relationships', 'health', 'barrier']::TEXT[]);

COMMENT ON COLUMN public.path_categories.life_areas IS
  'The Path Market''s life categories this one is under (education, career, relationships, health, barrier = Norms); it can be under several (STEP 85).';

-- Set only where nobody has set them yet, so later edits in the table stay.
UPDATE public.path_categories AS c SET life_areas = v.areas
FROM (VALUES
  ('med-sci',          ARRAY['education', 'career']),
  ('living',           ARRAY['barrier', 'health']),
  ('career',           ARRAY['career']),
  ('education',        ARRAY['education']),
  ('health',           ARRAY['health']),
  ('relationships',    ARRAY['relationships']),
  ('creative',         ARRAY['career', 'relationships']),
  ('travel',           ARRAY['barrier']),
  ('adulting',         ARRAY['barrier']),
  ('recovery',         ARRAY['health']),
  ('nutrition',        ARRAY['health']),
  ('veganism',         ARRAY['health']),
  ('entrepreneurship', ARRAY['career', 'barrier']),
  ('public-health',    ARRAY['education', 'career'])
) AS v(key, areas)
WHERE c.key = v.key AND c.life_areas = '{}';

-- 2. The new name.
UPDATE public.path_categories
SET title = 'Entrepreneurship & Neurodivergence'
WHERE key = 'entrepreneurship' AND title = 'Entrepreneurship & ADHD/Neurodivergence';

-- 3. What a path model carries.
ALTER TABLE public.path_models
  ADD COLUMN IF NOT EXISTS category_keys    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS norms            TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS connection_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS races            JSONB  NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS people           JSONB  NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS contributors     TEXT[] NOT NULL DEFAULT '{}';

-- Kept small: anyone signed in can submit a model (it waits for review).
ALTER TABLE public.path_models DROP CONSTRAINT IF EXISTS path_models_labels_size;
ALTER TABLE public.path_models ADD CONSTRAINT path_models_labels_size CHECK (
  coalesce(array_length(category_keys, 1), 0) <= 6
  AND coalesce(array_length(norms, 1), 0) <= 12
  AND coalesce(array_length(connection_types, 1), 0) <= 6
  AND coalesce(array_length(contributors, 1), 0) <= 6
);
ALTER TABLE public.path_models DROP CONSTRAINT IF EXISTS path_models_races_shape;
ALTER TABLE public.path_models ADD CONSTRAINT path_models_races_shape CHECK (
  jsonb_typeof(races) = 'array' AND jsonb_array_length(races) <= 8 AND octet_length(races::TEXT) <= 20000
);
ALTER TABLE public.path_models DROP CONSTRAINT IF EXISTS path_models_people_shape;
ALTER TABLE public.path_models ADD CONSTRAINT path_models_people_shape CHECK (
  jsonb_typeof(people) = 'array' AND jsonb_array_length(people) <= 10 AND octet_length(people::TEXT) <= 4000
);

CREATE INDEX IF NOT EXISTS path_models_category_keys_idx ON public.path_models USING GIN (category_keys);
CREATE INDEX IF NOT EXISTS path_models_norms_idx ON public.path_models USING GIN (norms);

COMMENT ON COLUMN public.path_models.category_keys IS 'The specialised categories (path_categories.key) this model is under; category_key is the first (STEP 85).';
COMMENT ON COLUMN public.path_models.norms IS 'Norms this path was lived with, as ResourceHub''s norm ids (lib/norms/taxonomy.ts), e.g. adhd (STEP 85).';
COMMENT ON COLUMN public.path_models.connection_types IS 'ResourceHub''s "Connection Type to Norm" ids (lib/filters/taxonomy.ts), e.g. self_diagnosed (STEP 85).';
COMMENT ON COLUMN public.path_models.races IS 'The races in this path: [{name, area, milestones: [text]}]. Empty: its seed_goals are its races, with no steps yet (STEP 85).';
COMMENT ON COLUMN public.path_models.people IS 'People on this path, by role: [{role, note}]. Never names (STEP 85).';
COMMENT ON COLUMN public.path_models.contributors IS 'Who contributed to this model, as they want to be credited (STEP 85).';

-- Models from before: their one category, and their one contributor.
UPDATE public.path_models SET category_keys = ARRAY[category_key]
WHERE category_keys = '{}' AND category_key IS NOT NULL;
UPDATE public.path_models SET contributors = ARRAY[btrim(split_part(contributor, '(', 1))]
WHERE contributors = '{}' AND coalesce(btrim(split_part(contributor, '(', 1)), '') <> '';

-- 4. Model Jet: under Entrepreneurship & Neurodivergence, with its labels.
UPDATE public.path_models
SET category_key = 'entrepreneurship',
    category_keys = ARRAY['entrepreneurship'],
    norms = ARRAY['adhd', 'ocd', 'depression'],
    connection_types = ARRAY['self_diagnosed'],
    contributors = ARRAY['Odosa']
WHERE name = 'Model Jet' AND category_key IN ('recovery', 'entrepreneurship');
