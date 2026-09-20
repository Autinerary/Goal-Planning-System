-- =====================================================================
-- One "Helpful" vote per person per review
--
-- ratings.helpful_count was a bare integer that any POST could increment.
-- A tester found they could hold down the Helpful button and drive a
-- review's count up without limit, which also skews "Most Helpful" sort
-- and the helpful_total in the badge rollups. There was no record of who
-- had voted, so there was nothing to check a second click against.
--
-- This adds that record. helpful_count stays and keeps its current
-- values -- existing counts are real signal we are not discarding, and
-- they cannot be attributed retroactively. From here the column is
-- maintained by trigger from the votes table, so it can only move by one
-- per person per review, in either direction.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.rating_helpful_votes (
  rating_id  UUID        NOT NULL REFERENCES public.ratings(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rating_id, user_id)
);

COMMENT ON TABLE public.rating_helpful_votes IS
  'One row per person per review marked helpful. The composite primary key is what makes the Helpful button unspammable.';

CREATE INDEX IF NOT EXISTS rating_helpful_votes_user_idx
  ON public.rating_helpful_votes (user_id);

-- ---------------------------------------------------------------
-- Keep ratings.helpful_count in step with the votes table.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_rating_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ratings
       SET helpful_count = COALESCE(helpful_count, 0) + 1
     WHERE id = NEW.rating_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- GREATEST guards the floor: un-voting must never push a count
    -- negative, including against counts that predate this table.
    UPDATE public.ratings
       SET helpful_count = GREATEST(0, COALESCE(helpful_count, 0) - 1)
     WHERE id = OLD.rating_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rating_helpful_votes_sync ON public.rating_helpful_votes;
CREATE TRIGGER rating_helpful_votes_sync
  AFTER INSERT OR DELETE ON public.rating_helpful_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_rating_helpful_count();

-- ---------------------------------------------------------------
-- Row-level security: everyone can see the tallies, you only control
-- your own vote.
-- ---------------------------------------------------------------
ALTER TABLE public.rating_helpful_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "helpful_votes_select_all" ON public.rating_helpful_votes;
CREATE POLICY "helpful_votes_select_all"
  ON public.rating_helpful_votes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "helpful_votes_insert_own" ON public.rating_helpful_votes;
CREATE POLICY "helpful_votes_insert_own"
  ON public.rating_helpful_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "helpful_votes_delete_own" ON public.rating_helpful_votes;
CREATE POLICY "helpful_votes_delete_own"
  ON public.rating_helpful_votes FOR DELETE
  USING (auth.uid() = user_id);
