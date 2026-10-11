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

-- 8. Resolve a report (POST /api/community/admin/reports/[id]/resolve), and
--    optionally remove what it points at or lock the post. The route made up
--    to three writes one after another and, if removing or locking failed,
--    logged it and resolved the report anyway. Here they happen together or
--    not at all, for an admin only.
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

REVOKE ALL ON FUNCTION public.community_resolve_report(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_resolve_report(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

-- 9. Accept an answer (POST /api/community/posts/[id]/accept), for the post's
--    author or an admin. The function trusted p_acting_user_id, and any
--    signed-in person may execute it, so anyone could call it directly with
--    the author's id (readable on every post) and accept any answer, adding
--    karma and writing the "Solved" lines onto someone else's post. Now the
--    caller's session says who is acting. The id passed in counts only for
--    the service role, so the route still works while it changes over. The
--    signature is unchanged; admins come from admin_users.
CREATE OR REPLACE FUNCTION public.community_accept_answer(
    p_post_id         UUID,
    p_answer_id       UUID,
    p_acting_user_id  UUID,
    p_tldr            TEXT,
    p_key_insight    TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_post_author    UUID;
    v_answer_author  UUID;
    v_answer_post_id UUID;
    v_is_admin       BOOLEAN;
    -- Who is acting: the signed-in caller. p_acting_user_id counts only when
    -- the server calls with the service-role key (the route before STEP 58).
    v_actor          UUID := CASE WHEN auth.role() = 'service_role'
                                  THEN p_acting_user_id ELSE auth.uid() END;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Sign-in required' USING ERRCODE = '28000';
    END IF;

    -- Validate solved metadata up front.
    IF p_tldr IS NULL OR length(trim(p_tldr)) = 0 THEN
        RAISE EXCEPTION 'Solved TLDR is required';
    END IF;
    IF p_key_insight IS NULL OR length(trim(p_key_insight)) = 0 THEN
        RAISE EXCEPTION 'Solved key insight is required';
    END IF;

    -- Load post + answer in a way that locks them for the duration of the txn.
    SELECT author_id INTO v_post_author
      FROM public.community_posts
     WHERE id = p_post_id AND is_deleted = FALSE
     FOR UPDATE;
    IF v_post_author IS NULL THEN
        RAISE EXCEPTION 'Post not found or deleted';
    END IF;

    SELECT author_id, post_id INTO v_answer_author, v_answer_post_id
      FROM public.community_answers
     WHERE id = p_answer_id AND is_deleted = FALSE
     FOR UPDATE;
    IF v_answer_author IS NULL OR v_answer_post_id <> p_post_id THEN
        RAISE EXCEPTION 'Answer not found, deleted, or does not belong to the post';
    END IF;

    -- Permission: post author OR admin (public.admin_users, STEP 55).
    SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_actor)
      INTO v_is_admin;
    IF v_post_author <> v_actor AND COALESCE(v_is_admin, FALSE) = FALSE THEN
        RAISE EXCEPTION 'Only the post author or an admin can accept an answer';
    END IF;

    -- Clear any previously accepted answer on this post.
    UPDATE public.community_answers
       SET is_accepted = FALSE,
           accepted_at = NULL
     WHERE post_id = p_post_id AND is_accepted = TRUE AND id <> p_answer_id;

    -- Accept the new answer.
    UPDATE public.community_answers
       SET is_accepted = TRUE,
           accepted_at = now()
     WHERE id = p_answer_id;

    -- Stamp the post.
    UPDATE public.community_posts
       SET accepted_answer_id = p_answer_id,
           solved_tldr        = p_tldr,
           solved_key_insight = p_key_insight,
           last_activity_at   = now()
     WHERE id = p_post_id;

    -- Karma bonus for an accepted answer (StackOverflow convention: +15).
    IF v_answer_author <> v_post_author THEN
        UPDATE public.community_profiles
           SET karma = karma + 15
         WHERE user_id = v_answer_author;
    END IF;

    -- Auto-grant the problem_solver badge to the answerer (idempotent).
    INSERT INTO public.community_badge_grants (user_id, badge_slug, granted_by)
    VALUES (v_answer_author, 'problem_solver', NULL)
    ON CONFLICT (user_id, badge_slug) DO NOTHING;
END;
$$;

