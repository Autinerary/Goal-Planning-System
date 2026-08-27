-- ============================================================================
-- Repoint memes / messages / video_calls at public.profiles.
--
-- These three tables carry foreign keys to public.users — a legacy table from
-- the original Postgres schema that has ZERO rows in production, while
-- public.profiles (which mirrors auth.users) has every real account.
--
-- So the social features had two independent faults, and fixing either alone
-- would have left them broken:
--   1. the routes connected to localhost instead of Supabase (fixed in code)
--   2. every insert violated a foreign key into an empty table (this file)
--
-- The old code papered over (2) with a get_or_create_user() function that
-- inserted a row into public.users for whatever identifier arrived — including
-- the frontend's literal 'demo_user' fallback. That is why the constraint was
-- never noticed: the app minted a phantom account rather than failing.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- Drop whatever FK currently points each column at public.users, without
-- assuming a constraint name.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname, rel.relname AS tbl
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_class ref ON ref.oid = con.confrelid
     WHERE con.contype = 'f'
       AND ref.relname = 'users'
       AND rel.relname IN ('memes', 'meme_likes', 'messages', 'video_calls', 'connections')
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', c.tbl, c.conname);
    RAISE NOTICE 'dropped % on %', c.conname, c.tbl;
  END LOOP;
END $$;

-- Re-add them against profiles. ON DELETE CASCADE so removing an account takes
-- its social content with it rather than leaving orphans.
DO $$
BEGIN
  IF to_regclass('public.memes') IS NOT NULL THEN
    ALTER TABLE public.memes
      ADD CONSTRAINT memes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.meme_likes') IS NOT NULL THEN
    ALTER TABLE public.meme_likes
      ADD CONSTRAINT meme_likes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.video_calls') IS NOT NULL THEN
    ALTER TABLE public.video_calls
      ADD CONSTRAINT video_calls_caller_id_fkey
      FOREIGN KEY (caller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.video_calls
      ADD CONSTRAINT video_calls_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.connections') IS NOT NULL THEN
    ALTER TABLE public.connections
      ADD CONSTRAINT connections_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.connections
      ADD CONSTRAINT connections_connected_user_id_fkey
      FOREIGN KEY (connected_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'constraints already point at profiles — nothing to do';
END $$;

COMMENT ON TABLE public.memes IS
  'Meme sharing between connected users. FKs point at public.profiles, not the empty legacy public.users.';
