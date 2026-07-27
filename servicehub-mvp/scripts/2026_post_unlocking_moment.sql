-- Author-highlighted "unlocking moment" on community posts (Odosa).
--
-- The key sentence / turning point of the story — what unlocked it for the
-- author. Distinct from the solved-answer fields (solved_tldr /
-- solved_key_insight), which only apply when an answer is accepted. Optional,
-- author-set. Run once against the shared Supabase project. Idempotent.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS unlocking_moment TEXT
    CHECK (unlocking_moment IS NULL OR length(unlocking_moment) <= 280);
