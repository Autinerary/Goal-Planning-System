-- =====================================================================
-- Record which text each profile embedding was built from
--
-- Pattern Recognition used to embed the stringified onboarding dict,
-- email and user id included. It now embeds an anonymised summary built
-- by backend/core/embedding_privacy.py. Vectors built from the two texts
-- live in different parts of the embedding space and are not comparable:
-- cosine similarity between an old-text vector and a new-text vector
-- measures the difference in the text, not the difference in the people.
--
-- This column says which text a row came from, so the backfill script
-- can re-embed only the stale rows and the retrieval experiments can
-- refuse to mix versions.
--
--   NULL       built from the original raw text (every row before this)
--   'anon-v1'  built from build_embedding_text, first version
--
-- Nullable on purpose: existing rows genuinely do not have a version, and
-- inventing one for them would hide exactly the thing this column exists
-- to expose.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.pattern_user_embeddings
  ADD COLUMN IF NOT EXISTS embedding_text_version TEXT;

COMMENT ON COLUMN public.pattern_user_embeddings.embedding_text_version IS
  'Which outbound text the embedding was built from. NULL = legacy raw text (included email and id); anon-v1 = anonymised summary from core/embedding_privacy.py. Vectors from different versions are not comparable.';

CREATE INDEX IF NOT EXISTS pattern_user_embeddings_text_version_idx
  ON public.pattern_user_embeddings (embedding_text_version);
