-- ============================================================================
-- Role Model Galleria (Odosa): "Ex. Black, Neurodiv Role Model Page +
-- Categories."
--
-- Deliberately NOT pre-seeded with any named individual. Attributing a
-- disability, diagnosis or identity to a real, named person without them
-- having said so themselves is a different kind of risk than authoring
-- resource-catalogue content (which the standing "resources can be
-- hardcoded, that's fine" rule already covers) — it is a factual claim about
-- someone who cannot consent to or correct it here. So this ships as the
-- STRUCTURE only: a submission-and-review workflow, same shape as
-- path_models (2026_path_models.sql) — nothing is publicly visible until
-- approved, and source_url exists so a claim can be checked rather than
-- taken on faith.
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.role_models (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  bio            TEXT NOT NULL,
  photo_url      TEXT,
  -- Free-text categories rather than a fixed enum, matching how Tidbits tags
  -- already work — 'Black', 'Neurodivergent', 'Parent', 'Sibling',
  -- 'Young Leader', 'Visible Minority', etc. A closed list would fight the
  -- reality that a role model belongs to more than one at once.
  categories     TEXT[] NOT NULL DEFAULT '{}',
  -- Where the claim comes from — an interview, their own writing, a
  -- verified public statement. Not required (a submitter's own mentor may
  -- have no public source), but a review queue with no way to check a claim
  -- is worse than one that at least records where it came from.
  source_url     TEXT,
  submitted_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_models_status_idx ON public.role_models (status);
CREATE INDEX IF NOT EXISTS role_models_categories_idx ON public.role_models USING GIN (categories);

ALTER TABLE public.role_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_models_read_approved ON public.role_models;
CREATE POLICY role_models_read_approved ON public.role_models
  FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS role_models_read_own ON public.role_models;
CREATE POLICY role_models_read_own ON public.role_models
  FOR SELECT USING (auth.uid() = submitted_by);

DROP POLICY IF EXISTS role_models_insert_own ON public.role_models;
CREATE POLICY role_models_insert_own ON public.role_models
  FOR INSERT WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

-- Approval/rejection goes through the service-role admin path, same as
-- path_models — no UPDATE policy for anon/authenticated.

COMMENT ON TABLE public.role_models IS
  'Submitted role models for Hare World''s galleria. Nothing is visible until an admin approves it — no bio about a named person ships unreviewed.';

COMMIT;
