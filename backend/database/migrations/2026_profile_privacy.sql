-- =====================================================================
-- Profiles: private by default, public fields through a view (STEP 64)
--
-- Found on 10 October 2026 while building Riipen Labs Group 34's profile
-- and friend card. The read rule on public.profiles ("profiles_read") let
-- anyone see the WHOLE row of a profile that was discoverable, or linked to
-- them by a connection or a pending request: email, date of birth,
-- preferences (which can hold a phone number for text reminders), location,
-- the app journey log and plan. A discoverable row was readable even
-- signed out, with the public key the website ships. The app's screens
-- never showed those fields, but the database API did.
--
-- 1. profiles: a person reads only their own row.
-- 2. public_profiles: what other people may see (name, picture, dream and
--    the new public fields below), for the same rows as before: your own,
--    discoverable ones, and anyone a connection or pending request links you
--    to. It runs with its owner's rights so it can read those rows, and
--    returns only these columns.
-- 3. search_profiles(q): Hare World's people search. Matches a display name
--    or username, or a WHOLE email address; it used to match any part of an
--    email, so searching "gmail" listed everyone discoverable with Gmail.
-- 4. New public profile fields for Group 34's profile page (slide 21) and
--    setup (slide 25): username, pronouns, bio, avatar_url (a photo).
-- 5. An "avatars" storage bucket for profile photos: 2 MB, PNG, JPEG or
--    WebP; each person can only write in their own folder.
--
-- The app works before and after this is applied: it reads public_profiles
-- and search_profiles when they exist and falls back otherwise.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- 4. New public fields --------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pronouns   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_.]{3,20}$');
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pronouns_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pronouns_length
  CHECK (pronouns IS NULL OR char_length(pronouns) <= 60);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bio_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_length
  CHECK (bio IS NULL OR char_length(bio) <= 500);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_length
  CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 500);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (username) WHERE username IS NOT NULL;

COMMENT ON COLUMN public.profiles.username IS 'Optional @name other members see: 3-20 of a-z, 0-9, _ and . (STEP 64).';
COMMENT ON COLUMN public.profiles.pronouns IS 'Optional pronouns other members see (STEP 64).';
COMMENT ON COLUMN public.profiles.bio IS 'Optional short bio other members see, up to 500 characters (STEP 64).';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Optional profile photo, in the avatars storage bucket (STEP 64).';

-- 1. Own row only -------------------------------------------------------
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

COMMENT ON POLICY "profiles_read" ON public.profiles IS
  'Your own row only. Other people''s public fields come from public.public_profiles (STEP 64).';

-- 2. What other people may see -------------------------------------------
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT p.id,
       p.display_name,
       p.avatar_emoji,
       p.dream,
       p.full_name,
       p.role,
       p.discoverable,
       p.created_at,
       p.username,
       p.pronouns,
       p.bio,
       p.avatar_url
  FROM public.profiles p
 WHERE p.id = auth.uid()
    OR p.discoverable = TRUE
    OR EXISTS (
         SELECT 1 FROM public.social_connections sc
          WHERE sc.status IN ('connected', 'pending')
            AND (
                  (sc.owner_id = auth.uid() AND sc.target_user_id = p.id)
               OR (sc.target_user_id = auth.uid() AND sc.owner_id = p.id)
                )
       );

COMMENT ON VIEW public.public_profiles IS
  'The public part of a profile, for the rows profiles_read used to allow: your own, discoverable ones, and anyone a connected or pending connection links you to. Runs with its owner''s rights and returns only these columns (STEP 64).';

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 3. People search -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_profiles(q TEXT)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  avatar_emoji TEXT,
  dream TEXT,
  username TEXT,
  pronouns TEXT,
  avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH term AS (
    SELECT ltrim(trim(coalesce(q, '')), '@') AS t
  ), pattern AS (
    SELECT t,
           replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') AS esc
      FROM term
  )
  SELECT p.id, p.display_name, p.avatar_emoji, p.dream, p.username, p.pronouns, p.avatar_url
    FROM public.profiles p, pattern
   WHERE auth.uid() IS NOT NULL
     AND char_length(pattern.t) >= 2
     AND p.discoverable = TRUE
     AND p.id <> auth.uid()
     AND (
           p.display_name ILIKE '%' || pattern.esc || '%'
        OR p.username ILIKE pattern.esc || '%'
        OR lower(p.email) = lower(pattern.t)
         )
   ORDER BY p.display_name NULLS LAST
   LIMIT 20
$$;

COMMENT ON FUNCTION public.search_profiles(TEXT) IS
  'Hare World people search: discoverable profiles by display name, username prefix, or a whole email address. Returns public fields only (STEP 64).';

REVOKE ALL ON FUNCTION public.search_profiles(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(TEXT) TO authenticated;

-- 5. Profile photos ------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
