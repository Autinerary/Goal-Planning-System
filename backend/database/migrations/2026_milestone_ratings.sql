-- =====================================================================
-- Milestone ratings: how useful a step of someone's plan was (STEP 54)
--
-- There are 0 reflections and the ratings table holds ResourceHub's place
-- ratings, almost all from seed personas, so Reflection Analysis and
-- Adaptation have no real signal about plans. This starts collecting one: on
-- a milestone's page, "How useful was this step for you?" 1 to 5.
--
-- One row per rating, never updated: rating a step again adds a row, and the
-- latest one counts. The history stays, which is what a label set needs.
-- path_id is part of the key because milestone ids repeat across one
-- person's paths ('milestone_g0_education_0' exists in each of them).
--
-- path_rating_scores rolls the latest rating of each milestone up to a path
-- score in [0, 1]: (rating - 1) / 4, averaged over the rated milestones.
-- It is a security_invoker view, so it shows each person only their own rows.
--
-- Written by the backend (POST /api/milestone-ratings), which then re-embeds
-- the person's profile vector with the path score as its success_rate, the
-- same call a reflection makes (orchestrator.index_user).
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.milestone_ratings (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id      TEXT        NOT NULL CHECK (length(path_id) BETWEEN 1 AND 100),
  milestone_id TEXT        NOT NULL CHECK (length(milestone_id) BETWEEN 1 AND 200),
  rating       SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestone_ratings_latest_idx
  ON public.milestone_ratings (user_id, path_id, milestone_id, created_at DESC);

ALTER TABLE public.milestone_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own milestone ratings" ON public.milestone_ratings;
CREATE POLICY "Read own milestone ratings" ON public.milestone_ratings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Add own milestone ratings" ON public.milestone_ratings;
CREATE POLICY "Add own milestone ratings" ON public.milestone_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.milestone_ratings IS
  'How useful a milestone was to the person (1-5). Append-only; the latest row per (user, path, milestone) counts.';

CREATE OR REPLACE VIEW public.path_rating_scores
WITH (security_invoker = true) AS
SELECT
  user_id,
  path_id,
  count(*)                                AS rated_milestones,
  round(avg((rating - 1) / 4.0), 3)       AS score,
  max(created_at)                         AS last_rated_at
FROM (
  SELECT DISTINCT ON (user_id, path_id, milestone_id)
         user_id, path_id, milestone_id, rating, created_at
  FROM public.milestone_ratings
  ORDER BY user_id, path_id, milestone_id, created_at DESC
) AS latest
GROUP BY user_id, path_id;

COMMENT ON VIEW public.path_rating_scores IS
  'Path score in [0,1] from the latest rating of each rated milestone: avg((rating-1)/4).';
