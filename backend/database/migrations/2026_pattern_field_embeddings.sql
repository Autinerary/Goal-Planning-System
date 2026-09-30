-- =====================================================================
-- Per-field profile embeddings (Pattern Recognition experiment, arm 4)
--
-- pattern_user_embeddings holds ONE vector per user, built from goals and
-- conditions joined into a single string. This table holds one vector per
-- user PER FIELD -- goals and conditions embedded separately -- so the two
-- approaches can be compared side by side. It adds to the existing table;
-- nothing reads or writes pattern_user_embeddings differently because of it.
--
-- Experiment-only. Production retrieval does not use this table, and
-- onboarding does not write to it: scripts/embed_pattern_fields.py fills
-- it, and is re-run before each experiment.
--
-- Two things the existing table lacks, added here on purpose:
--
--   * A foreign key with ON DELETE CASCADE. pattern_user_embeddings.user_id
--     has none, so nothing removes a vector when its account is deleted --
--     the orphaned-vector risk on the data-quality slide. This table does
--     not repeat that.
--
--   * text_sha256, a hash of the exact text that was embedded. Re-running
--     the generator skips unchanged rows and rebuilds changed ones, so a
--     profile edit cannot leave a stale vector here unnoticed -- the other
--     index-health problem on that slide.
--
-- No ANN index: at two rows per user an exact scan is instant, and an
-- ivfflat index on a table this small would return approximate results
-- for no benefit.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.pattern_user_field_embeddings (
  user_id                UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field                  TEXT         NOT NULL CHECK (field IN ('goals', 'barriers')),
  embedding              VECTOR(1536) NOT NULL,
  embedding_text_version TEXT         NOT NULL,
  text_sha256            TEXT         NOT NULL,
  model                  TEXT         NOT NULL DEFAULT 'text-embedding-ada-002',
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, field)
);

-- Written only by the service-role script; no client ever reads it.
ALTER TABLE public.pattern_user_field_embeddings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pattern_user_field_embeddings IS
  'Experiment arm 4: goals and conditions embedded separately, from the anonymised per-field text in core/embedding_privacy.py. Not used by production retrieval.';
COMMENT ON COLUMN public.pattern_user_field_embeddings.text_sha256 IS
  'SHA-256 of the exact text embedded. Lets the generator skip unchanged rows and rebuild stale ones.';
