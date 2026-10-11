-- =====================================================================
-- Vector-store integrity: no orphaned vectors, no stale ones (STEP 56)
--
-- Orphaned vectors. pattern_user_embeddings.user_id had no foreign key, so
-- deleting an account left its vector behind. Counted before writing this
-- (8 October 2026): 0 of 72 rows point at an account that no longer exists.
-- The constraint is added checked when there are none, as now. If any appear
-- before this runs, it is added NOT VALID instead, which still applies to
-- every new or changed row and to future deletions, and the count is shown:
-- nothing is deleted here.
--
-- Stale vectors. A vector was rebuilt only at setup and after a reflection,
-- so a condition added later (in ResourceHub, for example) never reached it.
-- On 8 Oct 5 of 72 vectors lacked a condition the person has since added.
-- (The timestamp check on the deck said 11; only 2 of those differ in
-- content, because re-embedding never refreshed updated_at. Fixed below.)
--
--   * reindex_requested_at: set by a trigger whenever someone's conditions
--     change (user_barriers insert, delete, or a changed barrier_type), from
--     any app. The backend rebuilds those vectors with the same anonymiser
--     (core/pattern_reindex.py) and clears the mark. Goals change only when
--     a path is generated, which already rebuilds the vector.
--   * updated_at is now refreshed on every update, so it says when the
--     vector was last written.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

DO $$
DECLARE
  orphans integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pattern_user_embeddings'::regclass
      AND conname = 'pattern_user_embeddings_user_id_fkey'
  ) THEN
    SELECT count(*) INTO orphans
    FROM public.pattern_user_embeddings e
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.user_id);

    IF orphans = 0 THEN
      ALTER TABLE public.pattern_user_embeddings
        ADD CONSTRAINT pattern_user_embeddings_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    ELSE
      ALTER TABLE public.pattern_user_embeddings
        ADD CONSTRAINT pattern_user_embeddings_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
      RAISE NOTICE 'pattern_user_embeddings: % orphaned row(s) kept; the foreign key is NOT VALID until they are reviewed', orphans;
    END IF;
  END IF;
END $$;

ALTER TABLE public.pattern_user_embeddings
  ADD COLUMN IF NOT EXISTS reindex_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.pattern_user_embeddings.reindex_requested_at IS
  'Set when the person''s conditions change after the vector was built; the backend rebuilds it and clears this (core/pattern_reindex.py).';

CREATE INDEX IF NOT EXISTS pattern_user_embeddings_reindex_idx
  ON public.pattern_user_embeddings (reindex_requested_at)
  WHERE reindex_requested_at IS NOT NULL;

-- Mark a person's vector when their conditions change. SECURITY DEFINER:
-- ResourceHub writes user_barriers as the person, who cannot write here.
CREATE OR REPLACE FUNCTION public.request_pattern_reindex()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pattern_user_embeddings
     SET reindex_requested_at = now()
   WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN NULL;
END
$$;

-- Catch up: mark every vector whose stored conditions differ from the
-- person's current ones (ignoring case and surrounding spaces), so the first
-- sweep rebuilds the ones already stale: 5 of 72 on 8 Oct.
UPDATE public.pattern_user_embeddings AS e
   SET reindex_requested_at = now()
 WHERE e.reindex_requested_at IS NULL
   AND (SELECT coalesce(array_agg(DISTINCT lower(btrim(b.barrier_type)) ORDER BY lower(btrim(b.barrier_type))), '{}')
          FROM public.user_barriers AS b
         WHERE b.user_id = e.user_id AND btrim(b.barrier_type) <> '')
       IS DISTINCT FROM
       (SELECT coalesce(array_agg(DISTINCT lower(btrim(x)) ORDER BY lower(btrim(x))), '{}')
          FROM unnest(e.barriers) AS x
         WHERE btrim(x) <> '');

DROP TRIGGER IF EXISTS request_pattern_reindex ON public.user_barriers;
CREATE TRIGGER request_pattern_reindex
  AFTER INSERT OR DELETE OR UPDATE OF barrier_type, user_id ON public.user_barriers
  FOR EACH ROW EXECUTE FUNCTION public.request_pattern_reindex();

-- updated_at says when the vector was last written.
CREATE OR REPLACE FUNCTION public.touch_pattern_user_embeddings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.embedding IS DISTINCT FROM OLD.embedding THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS touch_pattern_user_embeddings ON public.pattern_user_embeddings;
CREATE TRIGGER touch_pattern_user_embeddings
  BEFORE UPDATE ON public.pattern_user_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.touch_pattern_user_embeddings();
