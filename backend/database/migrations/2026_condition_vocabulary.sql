-- =====================================================================
-- Normalised condition vocabulary (STEP 57)
--
-- user_barriers.barrier_type keeps what people chose or typed, as they wrote
-- it. On 8 Oct 2026 that was 92 distinct values (68 among real users) for 65
-- distinct meanings (55): "ADHD" and "adhd", "Autism" and "Autism spectrum
-- disorder" are the same condition. The Pattern Recognition filter already
-- normalises at query time with core/condition_taxonomy.py. This stores that
-- map's answer for every stored value, so SQL and reports can use it too.
--
--   condition_vocabulary       one row per distinct stored value: its kind
--                              (condition, placeholder or unmapped), canonical
--                              key, label and category. Written only by
--                              scripts/sync_condition_vocabulary.py from the
--                              same map, so it is that map's output, not a
--                              second map.
--   user_barriers_normalized   user_barriers with those columns joined on.
--
-- The raw values are not changed. Placeholders ("Prefer not to share", "No
-- current barriers") are their own kind, never a condition. A value the map
-- doesn't know is 'unmapped', for a person to decide on. A value written
-- after the last sync has no row yet (condition_kind is NULL in the view)
-- until the script runs again.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.condition_vocabulary (
  raw_value        TEXT        PRIMARY KEY,
  kind             TEXT        NOT NULL CHECK (kind IN ('condition', 'placeholder', 'unmapped')),
  canonical        TEXT,
  label            TEXT,
  category         TEXT,
  taxonomy_version TEXT        NOT NULL,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT condition_vocabulary_canonical_check CHECK ((kind = 'unmapped') = (canonical IS NULL))
);

COMMENT ON TABLE public.condition_vocabulary IS
  'The condition map''s answer (core/condition_taxonomy.py) for each distinct stored condition value. Written by scripts/sync_condition_vocabulary.py.';

ALTER TABLE public.condition_vocabulary ENABLE ROW LEVEL SECURITY;

-- Mapped values are the app's own option labels, so anyone signed in may
-- read them. Unmapped ones are text someone typed; only the service role
-- sees those. Nobody but the service role writes.
DROP POLICY IF EXISTS "Read mapped condition vocabulary" ON public.condition_vocabulary;
CREATE POLICY "Read mapped condition vocabulary" ON public.condition_vocabulary
  FOR SELECT TO authenticated
  USING (kind <> 'unmapped');

REVOKE ALL ON public.condition_vocabulary FROM anon, authenticated;
GRANT SELECT ON public.condition_vocabulary TO authenticated;

-- security_invoker: whoever reads it sees only the user_barriers rows they
-- could read anyway (their own, under user_barriers' policies).
CREATE OR REPLACE VIEW public.user_barriers_normalized
WITH (security_invoker = true) AS
SELECT b.id,
       b.user_id,
       b.barrier_category,
       b.barrier_type,
       b.created_at,
       v.kind     AS condition_kind,
       v.canonical AS condition_key,
       v.label    AS condition_label,
       v.category AS condition_category
FROM public.user_barriers AS b
LEFT JOIN public.condition_vocabulary AS v ON v.raw_value = b.barrier_type;

COMMENT ON VIEW public.user_barriers_normalized IS
  'user_barriers with the normalised condition joined on (STEP 57). barrier_type is the raw value, unchanged.';

REVOKE ALL ON public.user_barriers_normalized FROM anon, authenticated;
GRANT SELECT ON public.user_barriers_normalized TO authenticated;
