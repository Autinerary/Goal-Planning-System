-- =====================================================================
-- Human judgements of "are these two people genuinely similar?"
--
-- Pattern Recognition decides who counts as similar by cosine similarity
-- between embeddings. Nothing has ever checked that against a person's
-- judgement -- the open question on the deck. This table holds that
-- judgement: team members look at two de-identified profile summaries and
-- say similar or not similar. The experiment then asks which
-- representation (text, engineered features, concatenated, split) agrees
-- with them.
--
-- Negatives are stored as well as positives on purpose. With only
-- "similar" labels you can measure whether an arm finds those pairs, but
-- not whether it also rates dissimilar pairs highly; an arm that calls
-- everyone similar would score perfectly.
--
-- Pairs are stored in a canonical order (user_a < user_b) so (x, y) and
-- (y, x) are the same pair. Several team members may label the same pair,
-- which makes inter-rater agreement measurable; the same person labelling
-- it twice is prevented.
--
-- labeled_by is a team member's name or initials, not an account: the
-- labelling script runs with the service role. Nothing about the labelled
-- users beyond their ids is stored here.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.pattern_similarity_labels (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL CHECK (label IN ('similar', 'not_similar')),
  labeled_by  TEXT        NOT NULL CHECK (length(trim(labeled_by)) BETWEEN 1 AND 60),
  note        TEXT        CHECK (note IS NULL OR length(note) <= 500),
  -- How the pair was proposed (e.g. 'spread:high', 'disagree:text>features'),
  -- so a skew in what got labelled can be seen afterwards.
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pattern_similarity_labels_ordered CHECK (user_a < user_b),
  CONSTRAINT pattern_similarity_labels_once UNIQUE (user_a, user_b, labeled_by)
);

-- Service role only. No policies: no client should read or write this.
ALTER TABLE public.pattern_similarity_labels ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pattern_similarity_labels IS
  'Ground truth for Pattern Recognition: team judgements of whether two real users are genuinely similar. Used to test which representation tracks human judgement.';
