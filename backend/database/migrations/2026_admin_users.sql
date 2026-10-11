-- =====================================================================
-- A real admin role (STEP 55)
--
-- There was no admin role. Admin work was done by holding the service_role
-- key, which bypasses every RLS policy, and ResourceHub and Tidbits treated
-- profiles.role = 'admin' as admin. profiles.role is also the "who are you"
-- answer people set themselves, and the profiles policy lets a signed-in
-- person update their own row, so nothing in the database stopped someone
-- setting their own role to 'admin' (0 profiles have it today).
--
-- 1. public.admin_users: who is an admin. Granted only in the SQL editor (no
--    policy lets the API add or change a row):
--      INSERT INTO public.admin_users (user_id, granted_by, note)
--      SELECT id, 'aayush', 'team' FROM auth.users WHERE email = '<their email>';
-- 2. public.is_admin(): whether the signed-in caller is one. Usable in RLS
--    policies and through the API (rpc('is_admin')). It answers only for the
--    caller, so it cannot be used to find out who the admins are.
-- 3. A guard on profiles: a signed-in session can no longer set role to
--    'admin'. Every remaining check on profiles.role = 'admin' (Tidbits
--    moderation, the moderation queue policy, ResourceHub's admin pages) is
--    therefore only as reachable as this table, until each moves to
--    is_admin(). The SQL editor and the service role are unaffected.
-- 4. The worked example: path model review. Admins may read every path
--    model and change only its status, through RLS, so approving no longer
--    needs the service_role key (frontend/app/api/path-models/[id]/approve).
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note       TEXT
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- People can see whether they themselves are an admin; nothing else.
DROP POLICY IF EXISTS "See your own admin row" ON public.admin_users;
CREATE POLICY "See your own admin row" ON public.admin_users
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE public.admin_users IS
  'Who may do admin work. Rows are added in the SQL editor only; is_admin() reads it for the signed-in caller.';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. Nobody grants themselves role 'admin' on their profile.
CREATE OR REPLACE FUNCTION public.protect_profile_admin_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.role = 'admin'
     AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'admin') THEN
    RAISE EXCEPTION 'The admin role is granted by the team (public.admin_users), not from a profile.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_profile_admin_role ON public.profiles;
CREATE TRIGGER protect_profile_admin_role
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_role();

-- 4. Path model review through RLS: admins read everything and change status only.
DROP POLICY IF EXISTS "path_models_admin_read" ON public.path_models;
CREATE POLICY "path_models_admin_read" ON public.path_models
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "path_models_admin_review" ON public.path_models;
CREATE POLICY "path_models_admin_review" ON public.path_models
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- The only column a signed-in session may change is status (and only admins
-- pass the policy above). Submitting stays as before (INSERT is untouched).
REVOKE UPDATE ON public.path_models FROM authenticated, anon;
GRANT UPDATE (status) ON public.path_models TO authenticated;
