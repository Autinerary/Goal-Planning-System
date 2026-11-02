-- =====================================================================
-- Shared agents (STEP 97)
--
-- My agents (the app's /agents): a person can share one of the agents they built, with everyone, with people they
-- pick from their connections, or by private link, so others can run it on their own plan: their plan looked at the
-- way the agent's owner looks at things. An agent is words: a name, what it's for, instructions, the norms it looks
-- through and what it may see. Whoever uses one runs it on their own device or the app's cloud model, with the app's
-- rules first, and it only ever sees the user's own information, never its owner's.
--
--   shared_agents              one per shared agent
--     owner_id                 who shared it; readable by nobody but the server
--     name, purpose            what it's called and what it's for
--     instructions             how it works, in its owner's words: shared, because they are the agent
--     lens                     the norms it looks through, from the fixed list (core/community_tags.py)
--     sees                     what it may see of the person using it: norms, goals, plan, step
--     moderation_status        approved once every check passes; removed by a moderator; pending, rejected unused
--     moderation_checks        what each check found (its words name no one, it doesn't set the rules aside,
--                              OpenAI's moderation service found nothing harmful, the crowd its norms point to, who
--                              it's shared with, what it was built on). Never any text
--     visibility               everyone (listed in Community agents), people (only those the owner picked from their
--                              connections) or link (anyone with its private link)
--     link_token               the private link's key, for visibility 'link' only; readable by nobody but the server
--     built_on                 the shared agent it was made from, so Community agents shows which came from which: a
--                              graph of agents, never of people
--   shared_agent_access        the people an owner shared an agent with (visibility 'people')
--   shared_agent_ratings       1 to 5 stars, one per person per agent
--
-- Only the server writes them (service role), after every check (api/routes/shared_agents.py); an owner can take
-- theirs down. Reports go to ResourceHub's moderation queue (community_reports, target 'agent'), where Remove takes it
-- down. Switched on by SHARED_AGENTS=on.
-- Run after STEP 96. Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.shared_agents (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 60),
  purpose            TEXT        NOT NULL DEFAULT '' CHECK (length(purpose) <= 200),
  instructions       TEXT        NOT NULL DEFAULT '' CHECK (length(instructions) <= 2000),
  lens               TEXT[]      NOT NULL DEFAULT '{}' CHECK (
                       cardinality(lens) <= 6
                       AND lens <@ ARRAY['autism', 'adhd', 'dyspraxia', 'tourette', 'dyslexia',
                                         'learning-disability', 'anxiety', 'depression', 'ocd',
                                         'mental-health', 'sensory-processing', 'vision', 'hearing',
                                         'communication', 'intellectual-disability', 'chronic-illness',
                                         'physical-disability', 'low-income', 'newcomer', 'rural',
                                         'lgbtq', 'racialized', 'caregivers', 'students', 'work']::TEXT[]),
  sees               TEXT[]      NOT NULL DEFAULT '{}' CHECK (sees <@ ARRAY['norms', 'goals', 'plan', 'step']::TEXT[]),
  moderation_status  TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'removed')),
  moderation_checks  JSONB       NOT NULL DEFAULT '{}'::JSONB,
  visibility         TEXT        NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'people', 'link')),
  link_token         TEXT        UNIQUE CHECK (link_token IS NULL OR link_token ~ '^[A-Za-z0-9_-]{24,64}$'),
  built_on           UUID        REFERENCES public.shared_agents(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shared_agents_link_only_for_links CHECK ((visibility = 'link') = (link_token IS NOT NULL)),
  CONSTRAINT shared_agents_not_built_on_itself CHECK (built_on IS DISTINCT FROM id)
);

-- The people an owner shared an agent with (visibility 'people'), from their connections; set by the server.
CREATE TABLE IF NOT EXISTS public.shared_agent_access (
  agent_id    UUID        NOT NULL REFERENCES public.shared_agents(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, user_id)
);
CREATE INDEX IF NOT EXISTS shared_agent_access_user_idx ON public.shared_agent_access (user_id);

CREATE INDEX IF NOT EXISTS shared_agents_public_idx
  ON public.shared_agents (created_at DESC) WHERE moderation_status = 'approved' AND visibility = 'everyone';
CREATE INDEX IF NOT EXISTS shared_agents_built_on_idx ON public.shared_agents (built_on) WHERE built_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS shared_agents_owner_idx ON public.shared_agents (owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.shared_agents_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS shared_agents_touch ON public.shared_agents;
CREATE TRIGGER shared_agents_touch
  BEFORE UPDATE ON public.shared_agents
  FOR EACH ROW EXECUTE FUNCTION public.shared_agents_touch();

ALTER TABLE public.shared_agents ENABLE ROW LEVEL SECURITY;

-- Anyone: approved agents shared with everyone. Someone signed in: those, the ones shared with them, and their own in
-- any state (and every one, for an admin, for the moderation queue). One shared by link only through the server, with
-- its key. is_admin() is for signed-in people only, so it isn't in anon's policy.
DROP POLICY IF EXISTS shared_agents_read_approved ON public.shared_agents;
CREATE POLICY shared_agents_read_approved ON public.shared_agents
  FOR SELECT TO anon
  USING (moderation_status = 'approved' AND visibility = 'everyone');

DROP POLICY IF EXISTS shared_agents_read ON public.shared_agents;
CREATE POLICY shared_agents_read ON public.shared_agents
  FOR SELECT TO authenticated
  USING ((moderation_status = 'approved'
          AND (visibility = 'everyone'
               OR (visibility = 'people' AND EXISTS (SELECT 1 FROM public.shared_agent_access s
                                                     WHERE s.agent_id = shared_agents.id AND s.user_id = auth.uid()))))
         OR owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS shared_agents_owner_delete ON public.shared_agents;
CREATE POLICY shared_agents_owner_delete ON public.shared_agents
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Supabase grants new tables to anon and authenticated directly. The public columns only: never the owner, the checks
-- or the link's key. Nobody but the server adds or changes one, so every change is checked again; an owner can take
-- theirs down.
REVOKE ALL ON public.shared_agents FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, name, purpose, instructions, lens, sees, moderation_status, visibility, built_on, created_at, updated_at)
  ON public.shared_agents TO anon, authenticated;
GRANT DELETE ON public.shared_agents TO authenticated;
GRANT ALL ON public.shared_agents TO service_role;

COMMENT ON TABLE public.shared_agents IS
  'STEP 97: agents people shared for others to run on their own plan, with everyone, with people they picked, or by private link. Never who shared one.';

-- A person sees which agents were shared with them; who else an agent was shared with, only the server knows.
ALTER TABLE public.shared_agent_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shared_agent_access_own_read ON public.shared_agent_access;
CREATE POLICY shared_agent_access_own_read ON public.shared_agent_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
REVOKE ALL ON public.shared_agent_access FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shared_agent_access TO authenticated;
GRANT ALL ON public.shared_agent_access TO service_role;

-- ---- Ratings ----------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shared_agent_ratings (
  agent_id    UUID        NOT NULL REFERENCES public.shared_agents(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, user_id)
);

ALTER TABLE public.shared_agent_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_agent_ratings_own_read ON public.shared_agent_ratings;
CREATE POLICY shared_agent_ratings_own_read ON public.shared_agent_ratings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.shared_agent_ratings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shared_agent_ratings TO authenticated;
GRANT ALL ON public.shared_agent_ratings TO service_role;

-- ---- Reports go to ResourceHub's moderation queue ------------------------------------------------------------------

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.community_reports'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.community_reports DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.community_reports ADD CONSTRAINT community_reports_target_type_check
  CHECK (target_type IN ('post', 'answer', 'user', 'adapter', 'agent'));

-- The same as STEP 96's, with Remove taking a reported agent down too.
CREATE OR REPLACE FUNCTION public.community_resolve_report(
  p_report_id     UUID,
  p_status        TEXT,
  p_note          TEXT DEFAULT NULL,
  p_remove_target BOOLEAN DEFAULT FALSE,
  p_lock_post     BOOLEAN DEFAULT FALSE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_report public.community_reports%ROWTYPE;
BEGIN
  IF v_caller IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('resolved_kept', 'resolved_removed', 'resolved_warned') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_report FROM public.community_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_report.status <> 'open' THEN
    RAISE EXCEPTION 'Report already resolved' USING ERRCODE = '55000';
  END IF;

  IF p_remove_target AND v_report.target_type = 'post' THEN
    UPDATE public.community_posts
       SET is_deleted = TRUE, deleted_by = v_caller, deleted_at = now()
     WHERE id = v_report.target_id AND is_deleted = FALSE;
  ELSIF p_remove_target AND v_report.target_type = 'answer' THEN
    UPDATE public.community_answers
       SET is_deleted = TRUE, deleted_by = v_caller, deleted_at = now()
     WHERE id = v_report.target_id AND is_deleted = FALSE;
  ELSIF p_remove_target AND v_report.target_type = 'adapter' THEN
    UPDATE public.shared_adapters
       SET moderation_status = 'removed'
     WHERE id = v_report.target_id AND moderation_status <> 'removed';
  ELSIF p_remove_target AND v_report.target_type = 'agent' THEN
    UPDATE public.shared_agents
       SET moderation_status = 'removed'
     WHERE id = v_report.target_id AND moderation_status <> 'removed';
  END IF;
  IF p_lock_post AND v_report.target_type = 'post' THEN
    UPDATE public.community_posts
       SET is_locked = TRUE, locked_reason = left(p_note, 500), locked_by = v_caller, locked_at = now()
     WHERE id = v_report.target_id;
  END IF;

  UPDATE public.community_reports
     SET status = p_status, resolved_by = v_caller, resolved_at = now(),
         resolution_note = left(p_note, 1000)
   WHERE id = p_report_id;
END
$$;

REVOKE ALL ON FUNCTION public.community_resolve_report(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_resolve_report(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
