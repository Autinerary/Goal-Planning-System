-- =====================================================================
-- ResourceHub's recommender: "people like you" works for a signed-in person, and test accounts stop steering it (STEP 93)
--
-- Found 31 October 2026 with a synthetic ResourceHub (agent_eval/hub_lab) and confirmed on production the same day:
--
--   1. find_similar_users runs with the caller's rights, and user_embeddings lets a person read only their own row,
--      so for a signed-in person it only ever saw themselves (as the QA account: 0 of 16 profile vectors visible,
--      with full rights 16). "People like you" never ran; every recommendation fell back to plain ratings.
--   2. 518 of the 521 ratings are from team and test accounts, so those ratings decided what people were shown.
--
-- What changes:
--   profiles.internal_account   true for test, QA, seed and synthetic accounts, from their email (generated, so a new
--                               test account is flagged without anyone remembering). Named team accounts are flagged
--                               by hand: UPDATE profiles SET internal_account_override = true WHERE email = '...'.
--   recommendation_ratings      ratings without those accounts. The recommender reads it; every page that shows
--                               ratings to people is unchanged.
--   find_similar_users          now runs with the function owner's rights, but only for someone signed in, never
--                               returns the caller, internal accounts, or anyone who has rated nothing (their ids
--                               are already public through ratings; a similar person with no ratings is of no use),
--                               and returns an id and a rounded similarity: never a vector, a barrier or any
--                               profile data. At most 50, and nothing below 0.5, so it can't be used to probe.
--
-- Nothing is deleted. Run after STEP 92. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Test, QA, seed and synthetic accounts ----------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS internal_account_override BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'internal_account') THEN
    ALTER TABLE public.profiles ADD COLUMN internal_account BOOLEAN GENERATED ALWAYS AS (
      internal_account_override
      OR coalesce(email ~* '^(test|child)|test\.account|@test\.com$|synthetic\+|@autinerary\.dev$', false)
    ) STORED;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.internal_account IS
  'STEP 93: a test, QA, seed or synthetic account (from its email), or one flagged by hand with internal_account_override. The recommender leaves its ratings out.';

-- 2. Ratings the recommender may learn from ---------------------------------
CREATE OR REPLACE VIEW public.recommendation_ratings AS
SELECT r.id, r.resource_id, r.user_id, r.overall_score, r.barrier_scores, r.created_at
FROM public.ratings r
JOIN public.profiles p ON p.id = r.user_id
WHERE NOT p.internal_account;

REVOKE ALL ON public.recommendation_ratings FROM PUBLIC, anon;
GRANT SELECT ON public.recommendation_ratings TO authenticated, service_role;

COMMENT ON VIEW public.recommendation_ratings IS
  'STEP 93: ratings without test, QA, seed and synthetic accounts, for the recommender (the ratings people see are unchanged).';

-- 3. "People like you" for a signed-in person -------------------------------
CREATE OR REPLACE FUNCTION public.find_similar_users(
  query_embedding VECTOR(384),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20
)
RETURNS TABLE (user_id UUID, similarity FLOAT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT ue.user_id,
         round((1 - (ue.barrier_embedding <=> query_embedding))::numeric * 20) / 20 AS similarity
  FROM public.user_embeddings ue
  JOIN public.profiles p ON p.id = ue.user_id
  WHERE auth.uid() IS NOT NULL
    AND ue.user_id <> auth.uid()
    AND ue.barrier_embedding IS NOT NULL
    AND NOT p.internal_account
    AND EXISTS (SELECT 1 FROM public.ratings r WHERE r.user_id = ue.user_id)
    AND 1 - (ue.barrier_embedding <=> query_embedding) > greatest(match_threshold, 0.5)
  ORDER BY ue.barrier_embedding <=> query_embedding
  LIMIT least(match_count, 50);
$$;

REVOKE ALL ON FUNCTION public.find_similar_users(VECTOR, FLOAT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_similar_users(VECTOR, FLOAT, INT) TO authenticated, service_role;

COMMENT ON FUNCTION public.find_similar_users(VECTOR, FLOAT, INT) IS
  'STEP 93: people with a similar barrier profile who have rated something, for someone signed in: an id and a similarity rounded to 0.05, never the caller, a test account, a vector or a profile. At most 50, nothing under 0.5.';
