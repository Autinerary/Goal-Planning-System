-- =====================================================================
-- Google place ids, so a listing can show Google's rating beside ours (STEP 94)
--
-- ResourceHub has no real ratings yet (30 October 2026: 2 of 521 were from real people). A service's Google rating is
-- real, public information, and Google's Places terms allow storing exactly one thing from it: the place id. The rating
-- itself is fetched when someone looks, never kept (lib/external-ratings/google.ts), and is shown apart from our own.
--
--   resources.google_place_id          the Google place this listing was matched to, if any
--   resources.google_place_checked_at  when we last looked for one, so a listing Google doesn't know isn't searched again
--                                      for 90 days
--
-- Written only by the server (service role). Nothing else changes. Switched on by GOOGLE_RATINGS=on and a key; until then
-- these columns stay empty. Run after STEP 93. Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS google_place_checked_at TIMESTAMPTZ;

ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_google_place_id_shape;
ALTER TABLE public.resources ADD CONSTRAINT resources_google_place_id_shape
  CHECK (google_place_id IS NULL OR google_place_id ~ '^[A-Za-z0-9_-]{10,200}$');

COMMENT ON COLUMN public.resources.google_place_id IS
  'STEP 94: the Google place this listing matches (the one thing Google''s terms let us store). Google''s rating is fetched live, never kept.';
