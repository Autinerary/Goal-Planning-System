-- =====================================================================
-- Tidbits: a content note on a post (STEP 75)
--
-- Riipen Labs, Group 15 (September 2026): "Visible safety signals in
-- community spaces: clear moderation policy, content warnings, and an easy
-- report path, especially for first-time posters".
--
-- A post about something hard can carry one note, from a fixed list
-- (servicehub-mvp/lib/community/contentNotes.ts). Readers see the note
-- first; the post and its answers open only when they choose, and the feed
-- shows the note instead of the post's first lines.
--
-- Posts are written by ResourceHub's server (service role), as before; RLS
-- is unchanged. Until this is applied, a post asked with a note is saved
-- without it, and nothing else changes.
--
-- STEPs 72 to 74 (schedule feedback, adaptation offers) came with the
-- agent work, merged on 15 October; this one does not depend on them.
-- Run after STEP 71. Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS content_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_content_note_check') THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_content_note_check
      CHECK (content_note IS NULL OR content_note IN ('self_harm', 'abuse', 'crisis', 'medical', 'food', 'loss', 'other'));
  END IF;
END $$;

COMMENT ON COLUMN public.community_posts.content_note IS
  'A content note the author chose (STEP 75): readers see it first and open the post when they choose.';
