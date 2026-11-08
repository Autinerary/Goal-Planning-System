-- STEP 99: only real people's ratings are shown (removing fake reviews, November 2026).
--
-- Until November 2026, ratings from test, QA, seed and made-up (synthetic) accounts (profiles.internal_account,
-- STEP 93, and profiles.is_synthetic) were most of ResourceHub's ratings, and every page showed them as community ratings:
-- averages, counts, the Rating Breakdown, search order. STEP 93 kept them out of the recommender only
-- (recommendation_ratings, "the ratings people see are unchanged"). Now they are kept out of everything people see,
-- and everything worked out from ratings: search, a service's standing (rating_sweep), Users' Choice, wait times.
--
-- How, in one place rather than in each of the forty places that read ratings:
--   1. The table is renamed public.ratings_all and keeps every rating. Nothing is deleted.
--   2. public.ratings becomes a view of it without the ratings of test and made-up accounts, except that a person
--      still sees their own. Code and functions that read "public.ratings" by name (the apps, the service role,
--      SECURITY DEFINER functions, crons) get the view, so none of them needs changing. Writes go through it to the
--      table (it is a simple view), with the table's row-level security, so the rules on who may rate are unchanged.
--   3. Row-level security on ratings_all reads the same way, for anyone who asks for ratings_all directly.
--   4. The wait-time trigger, which runs as the person who rated, now leaves their own rating out when they are a
--      test account (the view would let a test account's own rating into a shared figure).
--
-- After this, a migration that changes the ratings table changes public.ratings_all; the view selects the columns
-- the table has today, so a new column needs the view re-made too.
-- Safe to run twice.

BEGIN;

-- Does this person's rating count in public? Not a test, QA, seed or made-up account. SECURITY DEFINER because
-- profiles' own security hides other people's rows, which would make every rating look public. is_synthetic is read
-- through to_jsonb because only some databases have it (ResourceHub's add-profile-preferences.sql added it).
CREATE OR REPLACE FUNCTION public.rating_counts_publicly(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user
      AND (coalesce(p.internal_account, false) OR coalesce((to_jsonb(p) ->> 'is_synthetic')::boolean, false))
  )
$$;

REVOKE ALL ON FUNCTION public.rating_counts_publicly(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rating_counts_publicly(UUID) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.rating_counts_publicly(UUID) IS
  'STEP 99: true unless the account is a test, QA, seed or made-up one (profiles.internal_account or is_synthetic). Their ratings are kept, and shown only to themselves.';

-- 1 and 2. The table becomes ratings_all, and ratings the view of it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'ratings' AND c.relkind = 'r') THEN
    ALTER TABLE public.ratings RENAME TO ratings_all;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.ratings WITH (security_invoker = true) AS
SELECT r.*
FROM public.ratings_all r
WHERE public.rating_counts_publicly(r.user_id) OR r.user_id = auth.uid();

REVOKE ALL ON public.ratings FROM PUBLIC;
GRANT SELECT ON public.ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;

COMMENT ON VIEW public.ratings IS
  'STEP 99: the ratings people see: every rating in ratings_all except those of test, QA, seed and made-up accounts, which only their own author sees. Writes go to ratings_all.';
COMMENT ON TABLE public.ratings_all IS
  'STEP 99: every rating, including test and made-up accounts''. Read public.ratings (the view) for anything people see.';

-- 3. The same rule for anyone reading ratings_all directly (every reading policy, whatever its name, is replaced).
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT polname FROM pg_policy WHERE polrelid = 'public.ratings_all'::regclass AND polcmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.ratings_all', p.polname);
  END LOOP;
END $$;

CREATE POLICY ratings_read_real_people ON public.ratings_all
  FOR SELECT USING (public.rating_counts_publicly(user_id) OR user_id = auth.uid());

-- 4. Wait times, from real people's ratings only (it runs as whoever rated).
CREATE OR REPLACE FUNCTION public.resource_wait_from_ratings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r UUID := coalesce(NEW.resource_id, OLD.resource_id);
  order_of TEXT[] := ARRAY['no_wait', 'under_1_month', '1_3_months', '3_6_months', '6_12_months', 'over_1_year'];
  answers INTEGER[];
  n INTEGER;
BEGIN
  SELECT array_agg(array_position(order_of, rt.wait_bucket) ORDER BY array_position(order_of, rt.wait_bucket))
    INTO answers
    FROM public.ratings_all rt
   WHERE rt.resource_id = r AND rt.wait_bucket IS NOT NULL AND rt.created_at > now() - interval '2 years'
     AND public.rating_counts_publicly(rt.user_id);
  n := coalesce(array_length(answers, 1), 0);
  UPDATE public.resources
     SET wait_reported = CASE WHEN n = 0 THEN NULL ELSE order_of[answers[(n + 1) / 2]] END,
         wait_reports = n
   WHERE id = r;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.resource_wait_from_ratings() FROM PUBLIC, anon, authenticated;

-- The figures already worked out from ratings, worked out again without test accounts' (on 8 November there were
-- none to change: no Users' Choice winners, no reported waits, one service in good standing).
UPDATE public.resources res
   SET wait_reports = 0, wait_reported = NULL
 WHERE coalesce(res.wait_reports, 0) > 0
   AND NOT EXISTS (SELECT 1 FROM public.ratings_all rt
                   WHERE rt.resource_id = res.id AND rt.wait_bucket IS NOT NULL AND public.rating_counts_publicly(rt.user_id));
DELETE FROM public.users_choice WHERE period = to_char(now() AT TIME ZONE 'America/Toronto', 'YYYY-MM');

COMMIT;

NOTIFY pgrst, 'reload schema';
