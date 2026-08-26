-- ============================================================================
-- Tidbits relationship weighting (Odosa).
--
-- The same question as ratings: whose experience is this? A "solved" answer
-- from someone who lives with the norm should outrank one from an ally who
-- read about it — while still letting allies contribute.
--
-- Two columns, because posts/answers need both display AND ordering:
--   author_relationships  full { barrier_type: relationship } map, for the badge
--   author_weight         the author's STRONGEST tie (0.15-1.00), for ranking
--
-- Snapshotted at write time, like ratings.rater_relationships — RLS blocks
-- reading other users' profiles at render time. It also means an answer keeps
-- the standing its author had when they wrote it.
--
-- Idempotent. Requires 2026_community_tidbits.sql + 2026_relationship_weighting.sql.
-- ============================================================================

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS author_relationships JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS author_weight REAL NOT NULL DEFAULT 1.0;

ALTER TABLE public.community_answers
  ADD COLUMN IF NOT EXISTS author_relationships JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS author_weight REAL NOT NULL DEFAULT 1.0;

-- Ranking index: accepted answers first, then lived experience, then score.
CREATE INDEX IF NOT EXISTS community_answers_weighted_rank_idx
  ON public.community_answers (post_id, is_accepted DESC, author_weight DESC, score DESC)
  WHERE is_deleted = FALSE;

COMMENT ON COLUMN public.community_answers.author_weight IS
  'Author''s strongest relationship tie at write time (lived 1.0 → ally 0.15). Ranks answers; never hides them.';
