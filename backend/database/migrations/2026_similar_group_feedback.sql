-- =====================================================================
-- Similar-group feedback: ground truth for Pattern Recognition (STEP 60)
--
-- There are 0 similarity labels (pattern_similarity_labels is unchanged by
-- this). When the feature is on (SIMILAR_GROUP_FEEDBACK_ENABLED), opening the
-- "Found N similar users" banner shows an anonymous summary of the group a
-- plan was matched with: its size, and the conditions at least 3 members
-- share (condition vocabulary, no placeholders, no free text). It then asks
-- "Does this sound like people in a situation similar to yours?". This
-- table keeps the answers (core/similar_group.py).
--
--   member_ids        who the summary described. The backend works this
--                     out from the stored plan; the browser never sends or
--                     sees it.
--   shown_conditions  the vocabulary keys the summary named
--   note              optional, at most 500 characters, for the team to
--                     read. Nothing sends it to an LLM.
--
-- Server-side only: RLS on and no policies, and anon and authenticated have
-- no grants. Only the service role (the backend, the experiment harness)
-- reads or writes it. One row per answer; answering again adds a row, and
-- the harness uses the latest per person and plan.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.similar_group_feedback (
  id               BIGSERIAL   PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id          TEXT        NOT NULL CHECK (length(path_id) BETWEEN 1 AND 100),
  answer           TEXT        NOT NULL CHECK (answer IN ('yes', 'somewhat', 'no')),
  note             TEXT        CHECK (note IS NULL OR length(note) <= 500),
  member_ids       UUID[]      NOT NULL,
  group_size       SMALLINT    NOT NULL CHECK (group_size >= 0),
  shown_conditions TEXT[]      NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS similar_group_feedback_user_idx
  ON public.similar_group_feedback (user_id, path_id, created_at DESC);

ALTER TABLE public.similar_group_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.similar_group_feedback FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.similar_group_feedback_id_seq FROM anon, authenticated;

COMMENT ON TABLE public.similar_group_feedback IS
  'Answers to "Does this sound like people in a situation similar to yours?" about the group behind a plan. Server-side only (core/similar_group.py, STEP 60).';
