-- ============================================================================
-- Organizations & org-backed vouching (Odosa).
--
-- The insight: peer vouching scales through ORGANISATIONS, not individuals.
-- A leader at a community org (e.g. an autism coalition) vouches for their
-- members' norms. That is a far stronger signal than an anonymous peer, needs
-- no medical records, and gives community groups a concrete reason to partner:
-- they bring their members and become the trust anchor for them.
--
-- Still no health data: vouching records WHO vouched (an org) and WHEN —
-- never a diagnosis, never a document.
--
-- Idempotent. Requires 2026_rater_trust.sql (verification_method).
-- ============================================================================

-- ---- Organisations -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  website     TEXT,
  logo_url    TEXT,
  -- Set by app admins once a partnership is real. Only verified orgs confer
  -- an "Organisation-verified" badge, so a self-made org can't mint trust.
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  -- Rotatable join code. NULL disables self-join (invite-only).
  join_code   TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizations_verified_idx ON public.organizations (is_verified);

-- ---- Membership --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  org_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'leader' can vouch for members and manage membership. 'member' cannot.
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_members_user_idx ON public.organization_members (user_id);
CREATE INDEX IF NOT EXISTS organization_members_leader_idx
  ON public.organization_members (org_id, role);

-- ---- Extend verification with 'organization' ---------------------------------
-- The CHECK from 2026_rater_trust.sql only allowed self/peer/professional.
-- Replace it rather than assuming a constraint name.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.user_barriers'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%verification_method%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_barriers DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.user_barriers
    ADD CONSTRAINT user_barriers_verification_method_check
    CHECK (verification_method IN ('self', 'peer', 'organization', 'professional'));
END $$;

-- Which org vouched (only meaningful when verification_method='organization').
ALTER TABLE public.user_barriers
  ADD COLUMN IF NOT EXISTS verified_by_org_id UUID
    REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_barriers_org_idx
  ON public.user_barriers (verified_by_org_id);

-- ---- RLS ---------------------------------------------------------------------
ALTER TABLE public.organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Orgs are a public directory, but the join_code must never be readable by
-- anyone except leaders — so the API selects explicit columns and this policy
-- is paired with column selection in code, never `select *` for anon.
DROP POLICY IF EXISTS organizations_read ON public.organizations;
CREATE POLICY organizations_read ON public.organizations
  FOR SELECT USING (true);

-- A user sees membership rows for orgs they belong to.
DROP POLICY IF EXISTS organization_members_read ON public.organization_members;
CREATE POLICY organization_members_read ON public.organization_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
       WHERE m.org_id = organization_members.org_id
         AND m.user_id = auth.uid()
    )
  );

-- Joining / vouching / role changes all go through the service-role API where
-- the rules are enforced, so no INSERT/UPDATE policies here.

COMMENT ON TABLE public.organizations IS
  'Community organisations that can vouch for their members. is_verified is set by app admins when a partnership is real.';
COMMENT ON TABLE public.organization_members IS
  'Org membership. Leaders can vouch for members norms — recording the org and date only, never a diagnosis or document.';
