-- =====================================================================
-- Hare World Social, and Hare World's people features finished (STEP 87)
--
-- The team's notes, October 2026:
--   1. "Hare World Social": at the end of each task and milestone, a photo
--      or video and a caption (or one of them) to remember it by, the
--      mess-ups and the beginning that led to the end; a "Memories" profile
--      with all of them; and a "Reels"/posts feed of the most-cheered ones.
--      moments, moment_cheers and moment_reports, and a private bucket,
--      "moments", for the photos and videos. A moment is private unless its
--      author shares it: with their people at once, or with everyone in Hare
--      World after the team looks at it. People under 18 (a guardian's
--      Family account) keep theirs private.
--   2. "Stop a task and write a message to your future self", and the
--      Journal's "Quick Note to Self": future_notes, each person's own.
--   3. Hare World's "Share / Restrict / Private" and "Rival Notifs / Watch
--      Tasks", per person: on each connection, what each side shares with
--      the other (everything: path, calendar and progress; progress only;
--      or nothing) and whether each side watches the other's progress.
--      journey_visible() reads it, and the rules that let your people read
--      your path, calendar and progress now ask it.
--   4. Relationships (matching), which never worked: only people who opt in,
--      and only what they choose to show (what they're looking for, the
--      areas of life they're working on, a short note), are suggested to
--      each other. A match is a friend request, which the other accepts or
--      not. match_profiles, match_passes and match_candidates().
--   5. Collab Groups: the rule that let you see who is in your groups asked
--      the same table again (Postgres stops that as infinite recursion);
--      is_collab_member() answers it instead.
--
-- Nothing is deleted. Run after STEP 86. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. What each person shares with each of their people -------------------
ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS owner_shares   TEXT    NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_shares  TEXT    NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS owner_watches  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS target_watches BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.social_connections DROP CONSTRAINT IF EXISTS social_connections_shares_check;
ALTER TABLE public.social_connections ADD CONSTRAINT social_connections_shares_check
  CHECK (owner_shares IN ('all', 'progress', 'none') AND target_shares IN ('all', 'progress', 'none'));

COMMENT ON COLUMN public.social_connections.owner_shares IS
  'What the owner lets the other person see: all (path, calendar, progress), progress (progress and moments only) or none (STEP 87).';
COMMENT ON COLUMN public.social_connections.target_shares IS
  'What the other person (target) lets the owner see: all, progress or none (STEP 87).';
COMMENT ON COLUMN public.social_connections.owner_watches IS
  'The owner gets a notification when the other person finishes a milestone (STEP 87).';
COMMENT ON COLUMN public.social_connections.target_watches IS
  'The other person (target) gets a notification when the owner finishes a milestone (STEP 87).';

-- Each side sets only its own side.
CREATE OR REPLACE FUNCTION public.guard_connection_sharing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- Asking someone never decides what they share or watch.
    NEW.target_shares := 'all';
    NEW.target_watches := FALSE;
    RETURN NEW;
  END IF;
  IF me = OLD.owner_id AND (NEW.target_shares IS DISTINCT FROM OLD.target_shares OR NEW.target_watches IS DISTINCT FROM OLD.target_watches) THEN
    RAISE EXCEPTION 'That is the other person''s choice' USING ERRCODE = 'P0001', HINT = 'not_yours';
  END IF;
  IF me = OLD.target_user_id AND (NEW.owner_shares IS DISTINCT FROM OLD.owner_shares OR NEW.owner_watches IS DISTINCT FROM OLD.owner_watches) THEN
    RAISE EXCEPTION 'That is the other person''s choice' USING ERRCODE = 'P0001', HINT = 'not_yours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_connection_sharing ON public.social_connections;
CREATE TRIGGER trg_guard_connection_sharing
  BEFORE INSERT OR UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_sharing();

REVOKE ALL ON FUNCTION public.guard_connection_sharing() FROM PUBLIC, anon, authenticated;

-- Whether the signed-in person may see p_owner's journey: 'all' for their
-- path and calendar, 'progress' for their progress and moments. Connected,
-- and every connection between them allows it.
CREATE OR REPLACE FUNCTION public.journey_visible(p_owner UUID, p_need TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.social_connections sc
            WHERE sc.status IN ('connected', 'matched')
              AND ((sc.owner_id = p_owner AND sc.target_user_id = auth.uid())
                OR (sc.target_user_id = p_owner AND sc.owner_id = auth.uid()))
         )
     AND NOT EXISTS (
           SELECT 1 FROM public.social_connections sc
            WHERE sc.status IN ('connected', 'matched')
              AND (
                    (sc.owner_id = p_owner AND sc.target_user_id = auth.uid()
                      AND NOT (sc.owner_shares = 'all' OR (p_need = 'progress' AND sc.owner_shares = 'progress')))
                 OR (sc.target_user_id = p_owner AND sc.owner_id = auth.uid()
                      AND NOT (sc.target_shares = 'all' OR (p_need = 'progress' AND sc.target_shares = 'progress')))
                  )
         )
$$;

REVOKE ALL ON FUNCTION public.journey_visible(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journey_visible(UUID, TEXT) TO authenticated;

-- Your people read your path and calendar when you share everything with
-- them, and your progress unless you share nothing.
DROP POLICY IF EXISTS "Friends can read connected path" ON public.user_paths;
CREATE POLICY "Friends can read connected path" ON public.user_paths
  FOR SELECT USING (public.journey_visible(user_id, 'all'));

DROP POLICY IF EXISTS "Friends can read connected calendar" ON public.calendar_tasks;
CREATE POLICY "Friends can read connected calendar" ON public.calendar_tasks
  FOR SELECT USING (public.journey_visible(user_id, 'all'));

DROP POLICY IF EXISTS "Friends can read connected progress" ON public.race_progress;
CREATE POLICY "Friends can read connected progress" ON public.race_progress
  FOR SELECT USING (public.journey_visible(user_id, 'progress'));

-- Set your own side of a connection.
CREATE OR REPLACE FUNCTION public.set_connection_sharing(p_connection UUID, p_shares TEXT DEFAULT NULL, p_watch BOOLEAN DEFAULT NULL)
RETURNS TABLE (shares TEXT, watching BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  r public.social_connections;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = 'P0001', HINT = 'sign_in';
  END IF;
  IF p_shares IS NOT NULL AND p_shares NOT IN ('all', 'progress', 'none') THEN
    RAISE EXCEPTION 'Everything, progress only or nothing' USING ERRCODE = 'P0001', HINT = 'bad_share';
  END IF;
  SELECT * INTO r FROM public.social_connections WHERE id = p_connection;
  IF NOT FOUND OR (r.owner_id IS DISTINCT FROM me AND r.target_user_id IS DISTINCT FROM me) THEN
    RAISE EXCEPTION 'That connection couldn''t be found' USING ERRCODE = 'P0001', HINT = 'not_found';
  END IF;
  IF r.owner_id = me THEN
    UPDATE public.social_connections
       SET owner_shares = coalesce(p_shares, owner_shares), owner_watches = coalesce(p_watch, owner_watches)
     WHERE id = p_connection
    RETURNING owner_shares, owner_watches INTO shares, watching;
  ELSE
    UPDATE public.social_connections
       SET target_shares = coalesce(p_shares, target_shares), target_watches = coalesce(p_watch, target_watches)
     WHERE id = p_connection
    RETURNING target_shares, target_watches INTO shares, watching;
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.set_connection_sharing(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_connection_sharing(UUID, TEXT, BOOLEAN) TO authenticated;

-- 2. Moments: Hare World Social ------------------------------------------
CREATE TABLE IF NOT EXISTS public.moments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- What it marks: the end of a task or of a milestone.
  kind          TEXT NOT NULL CHECK (kind IN ('task', 'milestone')),
  -- The task's or milestone's id in the plan, and its name as it was then.
  ref           TEXT CHECK (ref IS NULL OR length(ref) <= 200),
  title         TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  caption       TEXT CHECK (caption IS NULL OR length(caption) <= 1000),
  -- A photo or video in the "moments" bucket, always in the author's folder.
  media_path    TEXT CHECK (media_path IS NULL OR (length(media_path) <= 300 AND split_part(media_path, '/', 1) = user_id::text)),
  media_type    TEXT CHECK (media_type IS NULL OR media_type IN ('image', 'video')),
  visibility    TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'friends', 'everyone')),
  -- Shared with everyone in Hare World: shown once the team has looked.
  review_status TEXT NOT NULL DEFAULT 'none' CHECK (review_status IN ('none', 'pending', 'approved', 'rejected')),
  cheer_count   INTEGER NOT NULL DEFAULT 0,
  report_count  INTEGER NOT NULL DEFAULT 0,
  hidden        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT moments_has_something CHECK (media_path IS NOT NULL OR length(btrim(coalesce(caption, ''))) > 0),
  CONSTRAINT moments_media_pair CHECK ((media_path IS NULL) = (media_type IS NULL))
);

CREATE INDEX IF NOT EXISTS moments_user_idx ON public.moments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moments_feed_idx ON public.moments (visibility, review_status, created_at DESC) WHERE NOT hidden;

-- Whether an account is a guardian's Family account (someone under 18).
CREATE OR REPLACE FUNCTION public.is_managed_account(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
     WHERE u.id = p_user
       AND coalesce(nullif(u.raw_app_meta_data->>'managed_by_guardian', ''), nullif(u.raw_user_meta_data->>'managed_by_guardian', ''), 'false') NOT IN ('false', 'null')
  )
$$;

REVOKE ALL ON FUNCTION public.is_managed_account(UUID) FROM PUBLIC, anon, authenticated;

-- The same question about the signed-in person only, so nobody can ask it
-- about someone else.
CREATE OR REPLACE FUNCTION public.my_account_is_managed()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL AND public.is_managed_account(auth.uid())
$$;

REVOKE ALL ON FUNCTION public.my_account_is_managed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_account_is_managed() TO authenticated;

-- Runs as the caller (like community_posts_before_write), so current_user
-- tells a person's request from the server's.
CREATE OR REPLACE FUNCTION public.moments_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  admin BOOLEAN := FALSE;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    admin := public.is_admin();
    IF NEW.visibility <> 'private' AND public.my_account_is_managed() THEN
      RAISE EXCEPTION 'Moments from a Family account stay private' USING ERRCODE = 'P0001', HINT = 'private_only';
    END IF;
    IF TG_OP = 'INSERT' THEN
      NEW.cheer_count := 0;
      NEW.report_count := 0;
      NEW.hidden := FALSE;
      NEW.review_status := CASE WHEN NEW.visibility = 'everyone' THEN 'pending' ELSE 'none' END;
    ELSE
      NEW.cheer_count := OLD.cheer_count;
      NEW.report_count := OLD.report_count;
      NEW.user_id := OLD.user_id;
      IF NOT admin THEN
        NEW.hidden := OLD.hidden;
        IF NEW.visibility <> 'everyone' THEN
          NEW.review_status := 'none';
        ELSIF OLD.visibility IS DISTINCT FROM 'everyone' OR NEW.caption IS DISTINCT FROM OLD.caption OR NEW.media_path IS DISTINCT FROM OLD.media_path THEN
          NEW.review_status := 'pending';
        ELSE
          NEW.review_status := OLD.review_status;
        END IF;
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.moments_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_moments_before_write ON public.moments;
CREATE TRIGGER trg_moments_before_write
  BEFORE INSERT OR UPDATE ON public.moments
  FOR EACH ROW EXECUTE FUNCTION public.moments_before_write();

ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moments_own ON public.moments;
CREATE POLICY moments_own ON public.moments
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Your people see what you share with them (and with everyone), unless you
-- share nothing with them.
DROP POLICY IF EXISTS moments_people ON public.moments;
CREATE POLICY moments_people ON public.moments
  FOR SELECT TO authenticated
  USING (NOT hidden AND visibility IN ('friends', 'everyone') AND public.journey_visible(user_id, 'progress'));

-- Everyone in Hare World sees what is shared with everyone, once the team
-- has looked at it.
DROP POLICY IF EXISTS moments_everyone ON public.moments;
CREATE POLICY moments_everyone ON public.moments
  FOR SELECT TO authenticated
  USING (NOT hidden AND visibility = 'everyone' AND review_status = 'approved' AND NOT public.blocked_pair(user_id, auth.uid()));

DROP POLICY IF EXISTS moments_admin_read ON public.moments;
CREATE POLICY moments_admin_read ON public.moments
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS moments_admin_review ON public.moments;
CREATE POLICY moments_admin_review ON public.moments
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.moments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moments TO authenticated;

COMMENT ON TABLE public.moments IS
  'Hare World Social: a photo or video and a caption at the end of a task or milestone. Private unless shared with your people, or with everyone once the team has looked (STEP 87).';

-- Cheers: the "likes" that make a moment trend.
CREATE TABLE IF NOT EXISTS public.moment_cheers (
  moment_id  UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (moment_id, user_id)
);

CREATE INDEX IF NOT EXISTS moment_cheers_recent_idx ON public.moment_cheers (moment_id, created_at DESC);

ALTER TABLE public.moment_cheers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moment_cheers_own_read ON public.moment_cheers;
CREATE POLICY moment_cheers_own_read ON public.moment_cheers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- A moment you can see, and not your own.
DROP POLICY IF EXISTS moment_cheers_add ON public.moment_cheers;
CREATE POLICY moment_cheers_add ON public.moment_cheers
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.moments m WHERE m.id = moment_id AND m.user_id <> auth.uid())
  );

DROP POLICY IF EXISTS moment_cheers_remove ON public.moment_cheers;
CREATE POLICY moment_cheers_remove ON public.moment_cheers
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.moment_cheers FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.moment_cheers TO authenticated;

CREATE OR REPLACE FUNCTION public.count_moment_cheers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.moments m
     SET cheer_count = (SELECT count(*) FROM public.moment_cheers c WHERE c.moment_id = m.id)
   WHERE m.id = coalesce(NEW.moment_id, OLD.moment_id);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.count_moment_cheers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_count_moment_cheers ON public.moment_cheers;
CREATE TRIGGER trg_count_moment_cheers
  AFTER INSERT OR DELETE ON public.moment_cheers
  FOR EACH ROW EXECUTE FUNCTION public.count_moment_cheers();

-- Reports: two from different people hide a moment until the team looks.
CREATE TABLE IF NOT EXISTS public.moment_reports (
  moment_id   UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      TEXT CHECK (reason IS NULL OR length(reason) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  PRIMARY KEY (moment_id, reporter_id)
);

ALTER TABLE public.moment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moment_reports_own ON public.moment_reports;
CREATE POLICY moment_reports_own ON public.moment_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS moment_reports_add ON public.moment_reports;
CREATE POLICY moment_reports_add ON public.moment_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND resolved_at IS NULL
    AND EXISTS (SELECT 1 FROM public.moments m WHERE m.id = moment_id AND m.user_id <> auth.uid())
  );

DROP POLICY IF EXISTS moment_reports_resolve ON public.moment_reports;
CREATE POLICY moment_reports_resolve ON public.moment_reports
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.moment_reports FROM anon, authenticated;
GRANT SELECT, INSERT ON public.moment_reports TO authenticated;
GRANT UPDATE (resolved_at) ON public.moment_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.count_moment_reports()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM public.moment_reports r WHERE r.moment_id = NEW.moment_id AND r.resolved_at IS NULL;
  UPDATE public.moments
     SET report_count = n,
         hidden = hidden OR n >= 2
   WHERE id = NEW.moment_id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.count_moment_reports() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_count_moment_reports ON public.moment_reports;
CREATE TRIGGER trg_count_moment_reports
  AFTER INSERT ON public.moment_reports
  FOR EACH ROW EXECUTE FUNCTION public.count_moment_reports();

-- The photos and videos: a private bucket, each person's own folder. Others
-- read a file only when they can see its moment (the rule asks moments).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('moments', 'moments', FALSE, 52428800,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
ON CONFLICT (id) DO UPDATE
   SET public = FALSE,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "moments_upload_own" ON storage.objects;
CREATE POLICY "moments_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'moments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "moments_read_own" ON storage.objects;
CREATE POLICY "moments_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'moments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "moments_read_shared" ON storage.objects;
CREATE POLICY "moments_read_shared" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'moments' AND EXISTS (SELECT 1 FROM public.moments m WHERE m.media_path = storage.objects.name));

DROP POLICY IF EXISTS "moments_delete_own" ON storage.objects;
CREATE POLICY "moments_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'moments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Notes to your future self (and the Journal's Quick Note to Self) -----
CREATE TABLE IF NOT EXISTS public.future_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'note' from the Journal; the others from stopping a task.
  kind        TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'do_better', 'keep_going', 'remember_today')),
  body        TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1000),
  task_ref    TEXT CHECK (task_ref IS NULL OR length(task_ref) <= 200),
  task_title  TEXT CHECK (task_title IS NULL OR length(task_title) <= 200),
  -- When it comes back to you (on the Task View, the next time after this).
  show_after  TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS future_notes_user_idx ON public.future_notes (user_id, created_at DESC);

ALTER TABLE public.future_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS future_notes_own ON public.future_notes;
CREATE POLICY future_notes_own ON public.future_notes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.future_notes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.future_notes TO authenticated;

COMMENT ON TABLE public.future_notes IS
  'Notes to your future self: from the Journal (Quick Note to Self) or when you stop a task. Shown again on the Task View and in Memories (STEP 87).';

-- 4. Relationships: matching, only between people who opt in -------------
CREATE TABLE IF NOT EXISTS public.match_profiles (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  looking_for TEXT[] NOT NULL CHECK (
                coalesce(array_length(looking_for, 1), 0) BETWEEN 1 AND 4
                AND looking_for <@ ARRAY['friends', 'mentor', 'mentee', 'accountability']::TEXT[]),
  topics      TEXT[] NOT NULL DEFAULT '{}' CHECK (
                coalesce(array_length(topics, 1), 0) <= 6
                AND topics <@ ARRAY['education', 'career', 'relationships', 'health', 'barrier', 'other']::TEXT[]),
  note        TEXT CHECK (note IS NULL OR length(note) <= 280),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.match_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS match_profiles_own ON public.match_profiles;
CREATE POLICY match_profiles_own ON public.match_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND NOT public.my_account_is_managed());

REVOKE ALL ON public.match_profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_profiles TO authenticated;

-- Someone you passed on isn't suggested again.
CREATE TABLE IF NOT EXISTS public.match_passes (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_id)
);

ALTER TABLE public.match_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS match_passes_own ON public.match_passes;
CREATE POLICY match_passes_own ON public.match_passes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.match_passes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.match_passes TO authenticated;

-- People to suggest: others who opted in and can be found, not you, not
-- already asked or connected, not blocked either way, not passed on; most
-- areas of life in common first. Only for someone who opted in too.
CREATE OR REPLACE FUNCTION public.match_candidates(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  username     TEXT,
  avatar_emoji TEXT,
  avatar_url   TEXT,
  pronouns     TEXT,
  looking_for  TEXT[],
  topics       TEXT[],
  note         TEXT,
  in_common    INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT mp.* FROM public.match_profiles mp
     WHERE mp.user_id = auth.uid() AND NOT public.is_managed_account(auth.uid())
  )
  SELECT p.id, p.display_name, p.username, p.avatar_emoji, p.avatar_url, p.pronouns,
         mp.looking_for, mp.topics, mp.note,
         (SELECT count(*)::INTEGER FROM unnest(mp.topics) t WHERE t = ANY (me.topics))
    FROM public.match_profiles mp
    JOIN public.profiles p ON p.id = mp.user_id
   CROSS JOIN me
   WHERE mp.user_id <> auth.uid()
     AND p.discoverable = TRUE
     AND NOT public.is_managed_account(mp.user_id)
     AND NOT public.blocked_pair(mp.user_id, auth.uid())
     AND NOT EXISTS (
           SELECT 1 FROM public.social_connections sc
            WHERE sc.status IN ('pending', 'connected', 'matched')
              AND ((sc.owner_id = auth.uid() AND sc.target_user_id = mp.user_id)
                OR (sc.target_user_id = auth.uid() AND sc.owner_id = mp.user_id)))
     AND NOT EXISTS (SELECT 1 FROM public.match_passes x WHERE x.user_id = auth.uid() AND x.other_id = mp.user_id)
   ORDER BY 10 DESC, mp.updated_at DESC
   LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

REVOKE ALL ON FUNCTION public.match_candidates(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_candidates(INTEGER) TO authenticated;

COMMENT ON TABLE public.match_profiles IS
  'Relationships in Hare World: people who opt in to be suggested to others who opted in, with what they choose to show. A match is a friend request (STEP 87).';

-- 5. Collab Groups: who is in your groups, without asking the same table ---
CREATE OR REPLACE FUNCTION public.is_collab_member(p_group UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.collab_group_members m WHERE m.group_id = p_group AND m.user_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.is_collab_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_collab_member(UUID) TO authenticated;

DROP POLICY IF EXISTS collab_group_members_read ON public.collab_group_members;
CREATE POLICY collab_group_members_read ON public.collab_group_members
  FOR SELECT USING (user_id = auth.uid() OR public.is_collab_member(group_id));

DROP POLICY IF EXISTS collab_groups_read ON public.collab_groups;
CREATE POLICY collab_groups_read ON public.collab_groups
  FOR SELECT USING (is_public OR leader_id = auth.uid() OR public.is_collab_member(id));
