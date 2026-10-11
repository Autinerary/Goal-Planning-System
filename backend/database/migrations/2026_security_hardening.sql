-- =====================================================================
-- Security hardening (STEP 68)
--
-- Items from the October 2026 review that were left open, now closed.
--
-- 1. Connections need consent. The app always sent a request to a real
--    person as 'pending', but the database let a signed-in person insert a
--    row already 'connected' (or 'matched'), or set their own pending request
--    to 'connected', straight through the API. A connection opens the other
--    person's plan, calendar and progress (is_connected_to) and, since STEP
--    66, messages and calls. Now a request to a real person starts pending,
--    and only the person asked can accept it. Cards saved by name (no
--    account behind them) are unchanged. The server (service role) and the
--    SQL editor are trusted, as before.
-- 2. Roles are given by the team. profiles.role is also the "who are you"
--    answer people set in ResourceHub (self advocate, parent, caregiver, and
--    so on), and STEP 55 only stopped people giving themselves 'admin'. Now
--    nobody can give themselves 'admin', 'moderator' or 'banned', or change
--    their role once the team has set one of those: a ban sticks.
-- 3. One admin check. is_admin() was public.admin_users only, while
--    ResourceHub's admin area checked profiles.role = 'admin'. Now either
--    counts. With 2, role 'admin' can only be set by the team.
-- 4. Reported messages are read by admins (is_admin()), not by anyone with
--    role 'moderator', which people could give themselves until 2.
-- 5. Saved plans no longer hold other people. Each plan kept the people
--    Pattern Recognition matched it with (account ids, conditions, goals
--    summary, success rate), and plans are readable by their owner and by
--    connected people through the API. They move to public.plan_matches,
--    which only the server reads (the "people like you" feature, STEP 60);
--    the plan keeps how many there were (similar_users_count). The planning
--    service saves new plans the same way. Someone who deletes their account
--    is taken out of every match list.
--
-- Run after STEP 67. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Connections need consent --------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_connection_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  -- The server and the SQL editor are trusted.
  IF me IS NULL THEN
    RETURN NEW;
  END IF;
  -- A card saved by name has nobody to ask.
  IF NEW.target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'A request to someone starts as pending' USING ERRCODE = 'P0001', HINT = 'pending_only';
    END IF;
    RETURN NEW;
  END IF;

  -- Pointing a row at someone else starts it over.
  IF (NEW.target_user_id IS DISTINCT FROM OLD.target_user_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id)
     AND NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'A request to someone starts as pending' USING ERRCODE = 'P0001', HINT = 'pending_only';
  END IF;

  -- Only the person asked accepts, and only a pending request.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('connected', 'matched') THEN
    IF OLD.status IS DISTINCT FROM 'pending' OR me IS DISTINCT FROM NEW.target_user_id THEN
      RAISE EXCEPTION 'Only the person asked can accept' USING ERRCODE = 'P0001', HINT = 'not_yours';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_connection_consent ON public.social_connections;
CREATE TRIGGER trg_guard_connection_consent
  BEFORE INSERT OR UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_consent();

-- 2. Roles are given by the team ------------------------------------------
-- Same function and trigger as STEP 55, now covering every role the team
-- gives, and keeping it once given.
CREATE OR REPLACE FUNCTION public.protect_profile_admin_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.role IN ('admin', 'moderator', 'banned')
       AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM NEW.role) THEN
      RAISE EXCEPTION 'This role is given by the team, not from a profile.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD.role IN ('admin', 'moderator', 'banned')
       AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'This role was set by the team and can only be changed by the team.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_profile_admin_role ON public.profiles;
CREATE TRIGGER protect_profile_admin_role
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_role();

-- 3. One admin check -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Whether the signed-in caller is an admin: in public.admin_users, or profiles.role = ''admin'' (which only the team can set, STEP 68).';

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 4. Reported messages: admins only ---------------------------------------
DROP POLICY IF EXISTS "message_reports_read" ON public.message_reports;
CREATE POLICY "message_reports_read" ON public.message_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_admin());

-- 5. Saved plans no longer hold other people ------------------------------
CREATE TABLE IF NOT EXISTS public.plan_matches (
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id            TEXT        NOT NULL,
  similar_users      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  retrieved_user_ids JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, path_id)
);

COMMENT ON TABLE public.plan_matches IS
  'The people Pattern Recognition matched each plan with. Server only (no policies); the plan keeps only how many (STEP 68).';

ALTER TABLE public.plan_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_matches FROM anon, authenticated;

-- Move what the saved plans hold. Each step leaves alone anything that isn't
-- the shape it expects.
INSERT INTO public.plan_matches (user_id, path_id, similar_users, retrieved_user_ids)
SELECT up.user_id,
       up.path_id,
       CASE WHEN jsonb_typeof(r->'result'->'similar_users') = 'array' THEN r->'result'->'similar_users' ELSE '[]'::jsonb END,
       CASE WHEN jsonb_typeof(r->'result'->'retrieved_user_ids') = 'array' THEN r->'result'->'retrieved_user_ids' ELSE '[]'::jsonb END
  FROM public.user_paths up
 CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(up.payload->'agentResponses') = 'array' THEN up.payload->'agentResponses' ELSE '[]'::jsonb END
       ) AS r
 WHERE up.path_id IS NOT NULL
   AND r->>'agentId' = 'pattern_recognition'
   AND jsonb_typeof(r->'result') = 'object'
   AND (r->'result' ? 'similar_users' OR r->'result' ? 'retrieved_user_ids')
ON CONFLICT (user_id, path_id) DO UPDATE
  SET similar_users = EXCLUDED.similar_users,
      retrieved_user_ids = EXCLUDED.retrieved_user_ids,
      updated_at = now();

UPDATE public.user_paths up
   SET payload = jsonb_set(
         up.payload,
         '{agentResponses}',
         (SELECT jsonb_agg(
                   CASE
                     WHEN r->>'agentId' = 'pattern_recognition' AND jsonb_typeof(r->'result') = 'object' THEN
                       jsonb_set(r, '{result}',
                         ((r->'result') - 'similar_users' - 'retrieved_user_ids')
                         || jsonb_build_object('similar_users_count',
                              CASE WHEN jsonb_typeof(r->'result'->'similar_users') = 'array'
                                   THEN jsonb_array_length(r->'result'->'similar_users')
                                   ELSE 0 END))
                     ELSE r
                   END
                   ORDER BY ord)
            FROM jsonb_array_elements(up.payload->'agentResponses') WITH ORDINALITY AS e(r, ord)))
 WHERE jsonb_typeof(up.payload->'agentResponses') = 'array'
   AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(up.payload->'agentResponses') AS r
          WHERE r->>'agentId' = 'pattern_recognition'
            AND jsonb_typeof(r->'result') = 'object'
            AND (r->'result' ? 'similar_users' OR r->'result' ? 'retrieved_user_ids'));

-- Someone who deletes their account leaves every match list too. Before
-- this, a deleted person's entry (conditions, goals summary) stayed inside
-- other people's saved plans.
CREATE OR REPLACE FUNCTION public.forget_in_plan_matches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.plan_matches pm
     SET similar_users = coalesce((
           SELECT jsonb_agg(e) FROM jsonb_array_elements(pm.similar_users) AS e
            WHERE coalesce(e->>'user_id', e->>'userId', '') <> OLD.id::text), '[]'::jsonb),
         retrieved_user_ids = coalesce((
           SELECT jsonb_agg(x) FROM jsonb_array_elements(pm.retrieved_user_ids) AS x
            WHERE (x #>> '{}') <> OLD.id::text), '[]'::jsonb),
         updated_at = now()
   WHERE jsonb_typeof(pm.similar_users) = 'array'
     AND jsonb_typeof(pm.retrieved_user_ids) = 'array'
     AND (pm.similar_users::text LIKE '%' || OLD.id::text || '%'
       OR pm.retrieved_user_ids::text LIKE '%' || OLD.id::text || '%');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_forget_in_plan_matches ON public.profiles;
CREATE TRIGGER trg_forget_in_plan_matches
  AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.forget_in_plan_matches();
