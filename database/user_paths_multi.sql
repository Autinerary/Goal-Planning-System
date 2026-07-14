-- Goal Planning System: multi-path migration
-- Lets a user keep MORE THAN ONE AI-generated path (Odosa: "generate another
-- path just to compare the two"). Previously user_paths had user_id as the
-- primary key, so each new path overwrote the last.
--
-- This migration:
--   1. Adds `is_active` (which path the user is currently viewing) and
--      `label` (a friendly name) columns.
--   2. Switches the primary key from (user_id) to (user_id, path_id) so a user
--      can have many paths.
--
-- Safe to run more than once. Run in the Supabase SQL editor.

-- 1. New columns
ALTER TABLE public.user_paths
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.user_paths
  ADD COLUMN IF NOT EXISTS label TEXT;

-- 2. Repoint the primary key to (user_id, path_id).
--    The original PK name is usually "user_paths_pkey".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_paths_pkey' AND conrelid = 'public.user_paths'::regclass
  ) THEN
    ALTER TABLE public.user_paths DROP CONSTRAINT user_paths_pkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_paths_user_path_pkey' AND conrelid = 'public.user_paths'::regclass
  ) THEN
    ALTER TABLE public.user_paths
      ADD CONSTRAINT user_paths_user_path_pkey PRIMARY KEY (user_id, path_id);
  END IF;
END $$;

-- Helpful indexes for listing a user's paths and finding the active one.
CREATE INDEX IF NOT EXISTS idx_user_paths_user_id ON public.user_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_user_paths_active ON public.user_paths(user_id, is_active);
