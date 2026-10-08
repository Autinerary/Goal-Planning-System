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
