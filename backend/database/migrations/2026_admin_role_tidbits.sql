-- =====================================================================
-- Tidbits admin actions without the service-role key (STEP 58)
--
-- Needs STEP 55 (public.admin_users and public.is_admin()).
--
-- ResourceHub's Tidbits admin routes checked profiles.role = 'admin' and then
-- wrote with the service-role key, which skips every policy. Each section
-- below lets one of them run as the signed-in admin instead, so the database
-- decides what an admin may change (docs/admin-role.md).
--
-- Every policy here is TO authenticated. is_admin() is granted only to
-- authenticated, and a signed-out reader must never evaluate it: a policy
-- that applied to anon would turn their reads into permission errors.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Lock or unlock a post (POST /api/community/posts/[id]/lock).
DROP POLICY IF EXISTS community_posts_admin_update ON public.community_posts;
CREATE POLICY community_posts_admin_update ON public.community_posts
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2. Edit a post (PATCH /api/community/posts/[id]). Nothing new: the author
--    edits under community_posts_update, an admin under the policy in 1.

-- 3. Edit an answer (PATCH /api/community/answers/[id]).
DROP POLICY IF EXISTS community_answers_admin_update ON public.community_answers;
CREATE POLICY community_answers_admin_update ON public.community_answers
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Edit someone's community profile (PATCH /api/community/profiles/[id]).
--    An admin must see a private profile to update it. There is no admin
--    INSERT policy: an admin edits a profile, never creates one for someone
--    who has not opted in. Admins also see private profiles' pseudonyms
--    elsewhere now, as the moderation queue needs.
DROP POLICY IF EXISTS community_profiles_admin_read ON public.community_profiles;
CREATE POLICY community_profiles_admin_read ON public.community_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS community_profiles_admin_update ON public.community_profiles;
CREATE POLICY community_profiles_admin_update ON public.community_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Soft-delete a post (DELETE /api/community/posts/[id]), for its author or
--    an admin. A policy is not enough: an UPDATE that filters on a column
--    must leave a row the caller can still read, and a deleted post fails
--    community_posts_select (is_deleted = FALSE). So a function does it,
--    checking who is asking itself.
CREATE OR REPLACE FUNCTION public.community_delete_post(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_author UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign-in required' USING ERRCODE = '28000';
  END IF;
  SELECT author_id INTO v_author
    FROM public.community_posts
   WHERE id = p_post_id AND is_deleted = FALSE
   FOR UPDATE;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_author <> v_caller AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not your post' USING ERRCODE = '42501';
  END IF;
  UPDATE public.community_posts
     SET is_deleted = TRUE, deleted_by = v_caller, deleted_at = now()
   WHERE id = p_post_id;
END
$$;

REVOKE ALL ON FUNCTION public.community_delete_post(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_delete_post(UUID) TO authenticated;

-- 6. Soft-delete an answer (DELETE /api/community/answers/[id]), for its
--    author or an admin. A function, as in 5. Run as the caller, the answer
--    count trigger could not update a post that isn't theirs: RLS would
--    skip that row and the count would drift. In here it runs as the
--    function's owner.
CREATE OR REPLACE FUNCTION public.community_delete_answer(p_answer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_author UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign-in required' USING ERRCODE = '28000';
  END IF;
  SELECT author_id INTO v_author
    FROM public.community_answers
   WHERE id = p_answer_id AND is_deleted = FALSE
   FOR UPDATE;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'Answer not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_author <> v_caller AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not your answer' USING ERRCODE = '42501';
  END IF;
  UPDATE public.community_answers
     SET is_deleted = TRUE, deleted_by = v_caller, deleted_at = now()
   WHERE id = p_answer_id;
END
$$;

REVOKE ALL ON FUNCTION public.community_delete_answer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_delete_answer(UUID) TO authenticated;

-- 7. The moderation queue (GET /api/community/admin/reports): every report,
--    and what each one points at, even when that post or answer is already
--    deleted. Private profiles' pseudonyms come from the policy in 4. Every
--    other read of posts with a person's session already filters out
--    deleted rows, so admins' ordinary browsing doesn't change.
DROP POLICY IF EXISTS community_reports_admin_read ON public.community_reports;
CREATE POLICY community_reports_admin_read ON public.community_reports
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS community_posts_admin_read ON public.community_posts;
CREATE POLICY community_posts_admin_read ON public.community_posts
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS community_answers_admin_read ON public.community_answers;
CREATE POLICY community_answers_admin_read ON public.community_answers
  FOR SELECT TO authenticated
  USING (public.is_admin());
