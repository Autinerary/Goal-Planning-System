-- =====================================================================
-- The ResourceHub round (STEP 86)
--
-- The team's notes, October 2026:
--   1. "Add some Tidbits, with the author as Autinerary ... taken right from
--      our own Learning info ... Each individual page should be a separate
--      Tidbit". Those pages run to 1,100-1,700 words, over a Tadbit's 1,000.
--      A third length, 'guide', up to 3,000 words, is for the team's own
--      pages only (byline 'autinerary', which only the server sets).
--   2. Commentaries by source, with Facebook under Videos as well as under
--      Social Media Posts: source_type gains 'facebook_video'.
--   3. "Categories in My Resources should be 2 layered; Layer 1 as Service,
--      Post or Store Item": saved_items holds the shop items and Tidbits a
--      person keeps in My Resources (services stay in saved_resources).
--   4. "Add new category beside services, shop & tidbits: Visuals. People
--      can add their real art here. No to AI-generated art or visuals":
--      visuals, each with the artist's two statements (made by them, not by
--      AI), shown once the team approves it.
--   5. "For any service or product added, add their email to a list so that
--      we can contact them": products.contact_email, the maker's or seller's
--      published email (services keep theirs in contact_info).
--
-- Nothing is deleted. Run after STEP 85. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Guides: the team's long pages as Tidbits.
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_length_type_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_length_type_check CHECK (
  (kind = 'tidbit' AND coalesce(length_type, '') IN ('tidbit', 'tadbit', 'guide')) OR (kind = 'question' AND length_type IS NULL));

CREATE OR REPLACE FUNCTION public.community_posts_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  lim INTEGER;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.bite_count := 0; NEW.well_done_count := 0; NEW.well_done_sum := 0; NEW.item_count := 0;
      NEW.byline := NULL; NEW.auto_flag := NULL; NEW.auto_flag_reason := NULL; NEW.published_at := NULL;
    ELSE
      NEW.bite_count := OLD.bite_count; NEW.well_done_count := OLD.well_done_count; NEW.well_done_sum := OLD.well_done_sum;
      NEW.item_count := OLD.item_count; NEW.byline := OLD.byline; NEW.auto_flag := OLD.auto_flag;
      NEW.auto_flag_reason := OLD.auto_flag_reason; NEW.published_at := OLD.published_at;
    END IF;
  END IF;
  -- A guide is the team's (STEP 86): only a post with the Autinerary byline,
  -- which nobody but the server can set, may be one.
  IF NEW.length_type = 'guide' AND NEW.byline IS DISTINCT FROM 'autinerary' THEN
    RAISE EXCEPTION 'Guides are written by the Autinerary team' USING ERRCODE = 'P0001', HINT = 'guide_team_only';
  END IF;
  NEW.word_count := CASE WHEN btrim(coalesce(NEW.body_markdown, '')) = '' THEN 0
                         ELSE coalesce(array_length(regexp_split_to_array(btrim(NEW.body_markdown), '\s+'), 1), 0) END;
  -- Checked when a Tidbit is written or published, not when its counts change
  -- (a Well-Done must still count after its author leaves the group).
  IF NEW.kind = 'tidbit' AND NEW.status = 'published' AND (
    TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.body_markdown IS DISTINCT FROM NEW.body_markdown
    OR OLD.length_type IS DISTINCT FROM NEW.length_type OR OLD.group_id IS DISTINCT FROM NEW.group_id
  ) THEN
    lim := CASE NEW.length_type WHEN 'tadbit' THEN 1000 WHEN 'guide' THEN 3000 ELSE 500 END;
    IF NEW.word_count > lim THEN
      RAISE EXCEPTION 'Keep it short and sweet: at most % words', lim USING ERRCODE = 'P0001', HINT = 'too_long';
    END IF;
    IF NEW.byline IS NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.group_id IS DISTINCT FROM NEW.group_id)
       AND NOT EXISTS (SELECT 1 FROM public.community_group_members m WHERE m.group_id = NEW.group_id AND m.user_id = NEW.author_id) THEN
      RAISE EXCEPTION 'Join the group first' USING ERRCODE = 'P0001', HINT = 'not_member';
    END IF;
  END IF;
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.community_posts_before_write() FROM PUBLIC, anon, authenticated;

-- 2. Facebook videos, apart from Facebook posts.
ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_source_type_check;
ALTER TABLE public.resources ADD CONSTRAINT resources_source_type_check
  CHECK (source_type IS NULL OR source_type IN (
    'news',
    'reddit', 'twitter', 'facebook',
    'youtube', 'tiktok', 'instagram', 'facebook_video',
    'tidbits',
    'openstreetmap', 'open_data', 'operator',
    'other'
  ));

-- 3. Shop items and Tidbits kept in My Resources.
CREATE TABLE IF NOT EXISTS public.saved_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_kind  TEXT NOT NULL CHECK (item_kind IN ('product', 'post')),
  item_id    UUID NOT NULL,
  status     TEXT NOT NULL DEFAULT 'wishlist' CHECK (status IN ('wishlist', 'current', 'past')),
  notes      TEXT CHECK (notes IS NULL OR length(notes) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_kind, item_id)
);

CREATE INDEX IF NOT EXISTS saved_items_user_idx ON public.saved_items (user_id, item_kind, status);

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_items_own ON public.saved_items;
CREATE POLICY saved_items_own ON public.saved_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.saved_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_items TO authenticated;

COMMENT ON TABLE public.saved_items IS
  'Shop items (products) and Tidbits (community_posts) a person keeps in My Resources: wishlist, using, used. Services stay in saved_resources (STEP 86).';

-- 4. Visuals: real art, by the people who made it.
CREATE TABLE IF NOT EXISTS public.visuals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  alt_text    TEXT NOT NULL CHECK (length(btrim(alt_text)) BETWEEN 5 AND 400),
  image_url   TEXT NOT NULL CHECK (image_url ~ '^https://'),
  medium      TEXT CHECK (medium IS NULL OR length(medium) <= 80),
  credit      TEXT CHECK (credit IS NULL OR length(credit) <= 80),
  norms       TEXT[] NOT NULL DEFAULT '{}' CHECK (coalesce(array_length(norms, 1), 0) <= 12),
  -- The artist's two statements. A row without both can't exist.
  made_by_me  BOOLEAN NOT NULL CHECK (made_by_me),
  not_ai      BOOLEAN NOT NULL CHECK (not_ai),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS visuals_status_idx ON public.visuals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS visuals_artist_idx ON public.visuals (artist_id);

ALTER TABLE public.visuals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visuals_read_approved ON public.visuals;
CREATE POLICY visuals_read_approved ON public.visuals
  FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS visuals_read_own ON public.visuals;
CREATE POLICY visuals_read_own ON public.visuals
  FOR SELECT TO authenticated USING (artist_id = auth.uid());

DROP POLICY IF EXISTS visuals_read_admin ON public.visuals;
CREATE POLICY visuals_read_admin ON public.visuals
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS visuals_insert_own ON public.visuals;
CREATE POLICY visuals_insert_own ON public.visuals
  FOR INSERT TO authenticated
  WITH CHECK (artist_id = auth.uid() AND status = 'pending' AND reviewed_at IS NULL);

DROP POLICY IF EXISTS visuals_review_admin ON public.visuals;
CREATE POLICY visuals_review_admin ON public.visuals
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.visuals FROM anon, authenticated;
GRANT SELECT ON public.visuals TO anon, authenticated;
GRANT INSERT ON public.visuals TO authenticated;
-- Admins change the decision only, through the policy above.
GRANT UPDATE (status, reviewed_at) ON public.visuals TO authenticated;

COMMENT ON TABLE public.visuals IS
  'Real art shared on ResourceHub''s Visuals page: never AI-generated (the artist says so, and a check reads the file). Shown once the team approves it (STEP 86).';

-- 5. A maker's or seller's published email, for the team's contact list.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_contact_email_shape;
ALTER TABLE public.products ADD CONSTRAINT products_contact_email_shape
  CHECK (contact_email IS NULL OR contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

COMMENT ON COLUMN public.products.contact_email IS
  'The maker''s or seller''s published contact email, for the team''s outreach list (STEP 86).';
