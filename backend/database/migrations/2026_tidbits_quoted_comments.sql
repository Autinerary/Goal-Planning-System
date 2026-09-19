-- ============================================================================
-- Tidbits: "Comment on" a specific passage (Odosa).
--
-- "Readers can highlight a specific part of the Tidbit that spoke to them,
-- and comment specifically on that."
--
-- Stores the quoted TEXT rather than character offsets. Offsets look tidier
-- but break the moment an author edits their post — every existing quote
-- silently shifts to point at the wrong words, which is worse than useless
-- on a platform where the quote IS the context. The text survives edits and
-- degrades honestly: if the passage is gone, the quote still reads as what
-- the commenter was responding to.
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.community_answers
  -- The passage this reply is responding to. NULL = an ordinary reply to the
  -- whole post, which stays the default.
  ADD COLUMN IF NOT EXISTS quoted_text TEXT
    CHECK (quoted_text IS NULL OR length(trim(quoted_text)) BETWEEN 1 AND 1000);

CREATE INDEX IF NOT EXISTS community_answers_quoted_idx
  ON public.community_answers (post_id)
  WHERE quoted_text IS NOT NULL;

COMMENT ON COLUMN public.community_answers.quoted_text IS
  'The passage a reader highlighted and replied to. Stored as text, not offsets, so an author editing the post cannot silently repoint every quote at the wrong words.';

COMMIT;
