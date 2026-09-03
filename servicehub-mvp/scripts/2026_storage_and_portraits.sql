-- ============================================================================
-- The missing storage bucket, and the ideal-self portraits table.
--
-- Found while chasing "Generated, but couldn't save it to your profile": the
-- project has NO storage buckets at all, and `ideal_self_portraits` was never
-- created. Both were referenced in code that shipped.
--
-- The bucket is the bigger of the two. Four separate upload paths target
-- `resource-images` and every one of them has been failing silently:
--   * frontend  /api/me/ideal-self          — AI portraits
--   * servicehub /api/resources/new         — photos on a submitted resource
--   * servicehub /api/storage/upload        — the generic uploader
--   * servicehub /api/community/upload      — images on Tidbits posts
--
-- Idempotent. Safe to re-run.
-- ============================================================================

BEGIN;

-- ---- Storage bucket ---------------------------------------------------------
-- Public read: these are resource photos and community images meant to be
-- viewable without a session. Writes are still restricted by the policies
-- below, so "public" here means readable, not writable.
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-images', 'resource-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "resource_images_public_read" ON storage.objects;
CREATE POLICY "resource_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'resource-images');

DROP POLICY IF EXISTS "resource_images_auth_insert" ON storage.objects;
CREATE POLICY "resource_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resource-images');

-- Overwriting matters: the portrait route upserts to a stable path
-- (ideal-self/<user>/portrait.png) so each person keeps exactly one.
DROP POLICY IF EXISTS "resource_images_auth_update" ON storage.objects;
CREATE POLICY "resource_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resource-images')
  WITH CHECK (bucket_id = 'resource-images');

DROP POLICY IF EXISTS "resource_images_owner_delete" ON storage.objects;
CREATE POLICY "resource_images_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resource-images' AND owner = auth.uid());

-- ---- Ideal-self portraits ---------------------------------------------------
-- One portrait per person, replaced on regeneration.
CREATE TABLE IF NOT EXISTS public.ideal_self_portraits (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  -- Path inside the bucket. NULL when the upload failed and we fell back to
  -- an inline data URL, which is worth being able to tell apart.
  image_path TEXT,
  prompt     TEXT,
  style      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ideal_self_portraits ENABLE ROW LEVEL SECURITY;

-- Your portrait is yours. Nothing here is public.
DROP POLICY IF EXISTS ideal_self_portraits_owner ON public.ideal_self_portraits;
CREATE POLICY ideal_self_portraits_owner ON public.ideal_self_portraits
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public._touch_ideal_self_portrait()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ideal_self_portraits_touch ON public.ideal_self_portraits;
CREATE TRIGGER ideal_self_portraits_touch
BEFORE UPDATE ON public.ideal_self_portraits
FOR EACH ROW EXECUTE FUNCTION public._touch_ideal_self_portrait();

COMMENT ON TABLE public.ideal_self_portraits IS
  'One AI portrait per user. image_path is NULL when the Storage upload failed and image_url holds an inline data URL instead.';

COMMIT;
