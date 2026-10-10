-- =====================================================================
-- Blocking, "friends since", and deleting your own account (STEP 65)
--
-- Riipen Labs, Group 34: a person's card (slide 20) has Block and says how
-- long you have been connected; Your profile (slide 21) has Delete account.
--
-- 1. social_connections.connected_at: when a request was accepted. Rows
--    accepted before this stay empty (nobody recorded it), and the card
--    says when the request was sent instead. Set only by the database.
-- 2. user_blocks and block_user(target). Blocking someone removes every
--    connection and request between you, both ways; hides each of you from
--    the other (public_profiles, search_profiles); and refuses new requests
--    between you (a trigger). Only the person who blocked can see or undo
--    it, and the other person is not told. my_blocked_people() lists them
--    with names, since a block hides the blocked person's profile.
-- 3. delete_my_account(confirm): deletes the signed-in person's account and
--    everything linked to it, straight away. confirm must be 'DELETE';
--    anything else deletes nothing and answers 'not_confirmed', which the
--    app uses to check this is switched on. Team accounts (role admin or
--    moderator) answer 'staff' and are never deleted this way.
-- 4. Reading your own folder of the avatars bucket, which listing and
--    removing your own photos need. (Added to STEP 64 on 10 October too;
--    repeated here for a database that ran STEP 64 before then.)
--
-- Run after STEP 64. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. When you connected ---------------------------------------------------
ALTER TABLE public.social_connections ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

COMMENT ON COLUMN public.social_connections.connected_at IS
  'When the request was accepted (STEP 65). Empty for rows accepted before STEP 65, and for rows that are not connected.';

CREATE OR REPLACE FUNCTION public.stamp_connected_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'connected' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'connected' THEN
      NEW.connected_at := now();
    ELSE
      -- Nobody can rewrite when it happened.
      NEW.connected_at := OLD.connected_at;
    END IF;
  ELSE
    NEW.connected_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_connected_at ON public.social_connections;
CREATE TRIGGER trg_stamp_connected_at
  BEFORE INSERT OR UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.stamp_connected_at();

-- 2. Blocking --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

COMMENT ON TABLE public.user_blocks IS
  'Who blocked whom (STEP 65). Only the blocker can read or delete their rows; rows are added by block_user().';

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_blocks_read_own" ON public.user_blocks;
CREATE POLICY "user_blocks_read_own" ON public.user_blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own" ON public.user_blocks
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

REVOKE ALL ON public.user_blocks FROM anon;
REVOKE INSERT, UPDATE ON public.user_blocks FROM authenticated;
GRANT SELECT, DELETE ON public.user_blocks TO authenticated;

CREATE OR REPLACE FUNCTION public.block_user(target UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;
  IF target IS NULL OR target = me THEN
    RAISE EXCEPTION 'Choose someone else to block' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (me, target)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.social_connections
   WHERE (owner_id = me AND target_user_id = target)
      OR (owner_id = target AND target_user_id = me);
END;
$$;

COMMENT ON FUNCTION public.block_user(UUID) IS
  'Block someone: removes every connection and request between you, both ways, and hides you from each other (STEP 65).';

REVOKE ALL ON FUNCTION public.block_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_blocked_people()
RETURNS TABLE (id UUID, display_name TEXT, avatar_emoji TEXT, blocked_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.blocked_id, p.display_name, p.avatar_emoji, b.created_at
    FROM public.user_blocks b
    LEFT JOIN public.profiles p ON p.id = b.blocked_id
   WHERE b.blocker_id = auth.uid()
   ORDER BY b.created_at DESC
$$;

COMMENT ON FUNCTION public.my_blocked_people() IS
  'The people you blocked, with their display name and picture, so you can unblock them (STEP 65).';

REVOKE ALL ON FUNCTION public.my_blocked_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_blocked_people() TO authenticated;

-- No new connection or request between two people when either blocked the
-- other. The hint says which, for the message the app shows.
CREATE OR REPLACE FUNCTION public.refuse_blocked_connection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.target_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_blocks
              WHERE blocker_id = NEW.owner_id AND blocked_id = NEW.target_user_id) THEN
    RAISE EXCEPTION 'You blocked this person' USING ERRCODE = 'P0001', HINT = 'blocked_by_you';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_blocks
              WHERE blocker_id = NEW.target_user_id AND blocked_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'This person can''t be added' USING ERRCODE = 'P0001', HINT = 'unavailable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refuse_blocked_connection ON public.social_connections;
CREATE TRIGGER trg_refuse_blocked_connection
  BEFORE INSERT OR UPDATE OF target_user_id, owner_id ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_connection();

-- What other people may see (STEP 64), now leaving out anyone either of you
-- blocked.
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
    OR (
         NOT EXISTS (
           SELECT 1 FROM public.user_blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
               OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
         )
     AND (
           p.discoverable = TRUE
        OR EXISTS (
             SELECT 1 FROM public.social_connections sc
              WHERE sc.status IN ('connected', 'pending')
                AND (
                      (sc.owner_id = auth.uid() AND sc.target_user_id = p.id)
                   OR (sc.target_user_id = auth.uid() AND sc.owner_id = p.id)
                    )
           )
         )
       );

COMMENT ON VIEW public.public_profiles IS
  'The public part of a profile, for the rows profiles_read used to allow: your own, discoverable ones, and anyone a connected or pending connection links you to; never someone either of you blocked. Runs with its owner''s rights and returns only these columns (STEP 64, blocks STEP 65).';

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

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
     AND NOT EXISTS (
           SELECT 1 FROM public.user_blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
               OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
         )
     AND (
           p.display_name ILIKE '%' || pattern.esc || '%'
        OR p.username ILIKE pattern.esc || '%'
        OR lower(p.email) = lower(pattern.t)
         )
   ORDER BY p.display_name NULLS LAST
   LIMIT 20
$$;

COMMENT ON FUNCTION public.search_profiles(TEXT) IS
  'Hare World people search: discoverable profiles by display name, username prefix, or a whole email address, leaving out anyone either of you blocked. Returns public fields only (STEP 64, blocks STEP 65).';

REVOKE ALL ON FUNCTION public.search_profiles(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(TEXT) TO authenticated;

-- 3. Deleting your own account -------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_my_account(confirm TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  r RECORD;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = me AND role IN ('admin', 'moderator')) THEN
    RETURN 'staff';
  END IF;
  IF confirm IS DISTINCT FROM 'DELETE' THEN
    RETURN 'not_confirmed';
  END IF;

  -- Tables that hold a person's id without a foreign key, so nothing below
  -- would reach them. Each only if it exists here.
  FOR r IN
    SELECT t.tbl, t.col
      FROM (VALUES
              ('reflections', 'user_id'),
              ('adaptation_outcomes', 'user_id'),
              ('calendar_outcomes', 'user_id'),
              ('pattern_user_embeddings', 'user_id'),
              ('pattern_user_feedback', 'query_user_id'),
              ('pattern_user_feedback', 'retrieved_user_id'),
              ('user_latest_context', 'user_id'),
              ('servicehub_agent_decisions', 'user_id'),
              ('generation_jobs', 'user_id'),
              ('agent_memory', 'user_id'),
              ('user_paths', 'user_id')
           ) AS t(tbl, col)
     WHERE EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema = 'public' AND c.table_name = t.tbl AND c.column_name = t.col)
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col) USING me;
  END LOOP;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'user_latest_context' AND column_name = 'retrieved_user_ids') THEN
    EXECUTE 'UPDATE public.user_latest_context SET retrieved_user_ids = array_remove(retrieved_user_ids, $1) WHERE $1 = ANY (retrieved_user_ids)' USING me;
  END IF;

  -- References with no ON DELETE rule would stop the delete. Clear the
  -- optional ones (who locked, resolved or reviewed something), so other
  -- people's records stay; remove rows that can't exist without the person.
  FOR r IN
    SELECT con.conrelid::regclass AS tbl, att.attname AS col, att.attnotnull AS required
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
       AND con.confdeltype IN ('a', 'r')
       AND array_length(con.conkey, 1) = 1
       AND con.connamespace = 'public'::regnamespace
       AND con.conrelid <> 'public.profiles'::regclass
  LOOP
    IF r.required THEN
      EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING me;
    ELSE
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1', r.tbl, r.col, r.col) USING me;
    END IF;
  END LOOP;

  -- The profile, and with it everything that cascades from it.
  DELETE FROM public.profiles WHERE id = me;

  -- The sign-in itself, and everything that cascades from it. Where this
  -- database role may not touch auth.users, the app finishes with the
  -- admin API.
  BEGIN
    DELETE FROM auth.users WHERE id = me;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 'profile_deleted';
  END;
  RETURN 'deleted';
END;
$$;

COMMENT ON FUNCTION public.delete_my_account(TEXT) IS
  'Deletes the signed-in person''s account and everything linked to it when confirm = ''DELETE''; otherwise deletes nothing and answers not_confirmed. Team accounts answer staff (STEP 65).';

REVOKE ALL ON FUNCTION public.delete_my_account(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(TEXT) TO authenticated;

-- 4. Your own photos -----------------------------------------------------
DROP POLICY IF EXISTS "avatars_read_own" ON storage.objects;
CREATE POLICY "avatars_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
