-- Author-highlighted "what didn't work" on community posts (Odosa).
--
-- The complement to unlocking_moment: things the author tried that did NOT
-- work, so readers can skip the dead ends. Optional, author-set, <=280 chars.
-- Run once against the shared Supabase project. Idempotent.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS what_didnt_work TEXT
    CHECK (what_didnt_work IS NULL OR length(what_didnt_work) <= 280);
