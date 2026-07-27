-- Family accounts: 18+ gate + parent/guardian → child supervision (the paid tier)
--
-- Run once against the shared Supabase project. Idempotent (IF NOT EXISTS).
--
-- Model:
--   * profiles.date_of_birth  — set at signup; drives the 18+ self-signup gate.
--   * profiles.plan           — billing stub: 'free' | 'family'.
--   * profiles.managed_by_guardian — true for child accounts a parent created.
--   * guardianships           — parent (guardian_id) supervises child (child_id).
--
-- Access model: the supervision API verifies the guardianship server-side and
-- reads the child's rows with the service-role client, so we don't need
-- cross-table RLS on user_paths / race_progress. RLS below only protects the
-- guardianships table itself.

-- 1. Profile columns -------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'family')),
  ADD COLUMN IF NOT EXISTS managed_by_guardian BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Guardianships ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guardianships (
  guardian_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'parent',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guardian_id, child_id),
  CHECK (guardian_id <> child_id)
);

CREATE INDEX IF NOT EXISTS guardianships_child_idx  ON public.guardianships (child_id);
CREATE INDEX IF NOT EXISTS guardianships_guardian_idx ON public.guardianships (guardian_id);

-- 3. RLS on guardianships (a user sees rows where they are guardian OR child).
ALTER TABLE public.guardianships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardianships_select_own" ON public.guardianships;
CREATE POLICY "guardianships_select_own" ON public.guardianships
  FOR SELECT USING (auth.uid() = guardian_id OR auth.uid() = child_id);

-- Writes go through the service-role API (age/consent checks live there), so no
-- INSERT/UPDATE/DELETE policies for anon/auth roles — service_role bypasses RLS.
