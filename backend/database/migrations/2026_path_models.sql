-- Community-contributed Path Market models.
--
-- Layer 3 of the Path Market: named path models inside a Life Category. Seed
-- "Foundations" models live in code; these are user-submitted ones (e.g. a
-- "Model Madhu"). Run once against the shared Supabase project. Idempotent.

CREATE TABLE IF NOT EXISTS public.path_models (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key   TEXT NOT NULL,                 -- Life Category (e.g. 'med-sci')
  name           TEXT NOT NULL,                 -- unique-ish model name
  contributor    TEXT,                          -- display credit
  contributor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description    TEXT NOT NULL,                 -- short: how this path differs
  seed_goals     JSONB NOT NULL DEFAULT '[]',   -- string[]
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS path_models_category_idx ON public.path_models (category_key);
CREATE INDEX IF NOT EXISTS path_models_status_idx   ON public.path_models (status);
CREATE INDEX IF NOT EXISTS path_models_owner_idx    ON public.path_models (contributor_id);

ALTER TABLE public.path_models ENABLE ROW LEVEL SECURITY;

-- Everyone can read APPROVED models.
DROP POLICY IF EXISTS "path_models_read_approved" ON public.path_models;
CREATE POLICY "path_models_read_approved" ON public.path_models
  FOR SELECT USING (status = 'approved');

-- A contributor can read their OWN submissions (any status).
DROP POLICY IF EXISTS "path_models_read_own" ON public.path_models;
CREATE POLICY "path_models_read_own" ON public.path_models
  FOR SELECT USING (auth.uid() = contributor_id);

-- A signed-in user can submit a model as themselves, only as 'pending'.
DROP POLICY IF EXISTS "path_models_insert_own" ON public.path_models;
CREATE POLICY "path_models_insert_own" ON public.path_models
  FOR INSERT WITH CHECK (auth.uid() = contributor_id AND status = 'pending');

-- Approval/rejection is done by the service-role admin API (bypasses RLS), so
-- no UPDATE policy for anon/auth roles.
