-- ============================================================================
-- Collab Groups (Hare World) — real, persisted groups.
--
-- The Create Group modal existed but was a dummy: uncontrolled inputs and a
-- button that only closed the dialog. Groups lived in local useState and
-- vanished on refresh. This gives them a home.
--
-- Model: a group has ONE leader (who sets the rules) and many members.
-- Public groups are searchable; private groups need a join code.
--
-- Idempotent. Run once against the shared Supabase project.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.collab_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  -- Matches the collabTypes list in the UI (study, project, fitness, …).
  type        TEXT NOT NULL,
  -- The leader's rules for the group, shown to members.
  rules       TEXT,
  is_public   BOOLEAN NOT NULL DEFAULT TRUE,
  -- Short human-shareable code. Only meaningful for private groups.
  join_code   TEXT UNIQUE,
  leader_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collab_groups_type_idx   ON public.collab_groups (type);
CREATE INDEX IF NOT EXISTS collab_groups_public_idx ON public.collab_groups (is_public);
CREATE INDEX IF NOT EXISTS collab_groups_leader_idx ON public.collab_groups (leader_id);

CREATE TABLE IF NOT EXISTS public.collab_group_members (
  group_id  UUID NOT NULL REFERENCES public.collab_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS collab_group_members_user_idx ON public.collab_group_members (user_id);

-- ---- RLS ---------------------------------------------------------------------
ALTER TABLE public.collab_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_group_members ENABLE ROW LEVEL SECURITY;

-- Public groups are discoverable by everyone. Private groups are visible only
-- to their members (finding one otherwise requires the code, checked serverside).
DROP POLICY IF EXISTS collab_groups_read ON public.collab_groups;
CREATE POLICY collab_groups_read ON public.collab_groups
  FOR SELECT USING (
    is_public
    OR leader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.collab_group_members m
       WHERE m.group_id = collab_groups.id AND m.user_id = auth.uid()
    )
  );

-- You can see membership rows for groups you're in.
DROP POLICY IF EXISTS collab_group_members_read ON public.collab_group_members;
CREATE POLICY collab_group_members_read ON public.collab_group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.collab_group_members m
       WHERE m.group_id = collab_group_members.group_id AND m.user_id = auth.uid()
    )
  );

-- Create / join / leave go through the service-role API where the code check
-- and leader rules are enforced, so no INSERT/UPDATE policies here.

COMMENT ON TABLE public.collab_groups IS
  'Hare World collab groups. One leader sets the rules; public groups are searchable, private ones need join_code.';
