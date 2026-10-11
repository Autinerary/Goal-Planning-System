-- =====================================================================
-- Hare World's people features, with rules in the database (STEP 66)
--
-- Riipen Labs, Group 34 found that most of Hare World's people features
-- didn't work (slides 8, 19 and 20): messages went to the wrong person and
-- were never shown, the meme feed showed only your own, "Mentor call" was a
-- timer, and mentor tasks, notes of support and working on a race together
-- had nothing behind them. The app now reads and writes these tables as the
-- signed-in person, so the rules below are what keeps them private.
--
-- Everything here is only between two people a connection links (accepted,
-- either direction), never between people where either blocked the other
-- (STEP 65), and has a limit per hour or day against floods.
--
-- 1. messages: chat, and notes of support (kind = 'support'). Each person
--    reads their own conversations; sends as themselves; can unsend what
--    they sent; marks what they received as read (mark_conversation_read).
--    report_message() keeps a copy for the team to review.
-- 2. memes: an emoji or a short text with a caption, for your connections
--    (all of them, or the ones you pick). Likes are counted by the database.
-- 3. video_calls: a call booked with a time and a link to a video room.
--    Either person can cancel it or mark it done (set_call_status).
-- 4. mentor_tasks: someone who chose you as their mentor can be sent small
--    tasks; they accept, decline or tick them off (set_mentor_task_status).
-- 5. race_collabs: invite a connection to work on one of your goals
--    together; they accept or decline (respond_race_collab).
-- 6. block_user() also clears what was waiting between two people: calls
--    still booked, task suggestions and invitations.
--
-- Updates from your people need no table: connected people can already read
-- each other's progress (race_progress) and paths (user_paths).
--
-- The tables in 1 to 3 came from the first schema (database/schema.sql) and
-- were repointed at profiles in STEP 22. Whatever rules they had are removed
-- first, so only these apply.
--
-- Run after STEP 65. Idempotent. Safe to re-run.
-- =====================================================================

-- Helpers ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.connected_pair(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_connections sc
     WHERE sc.status = 'connected'
       AND ((sc.owner_id = a AND sc.target_user_id = b)
         OR (sc.owner_id = b AND sc.target_user_id = a))
  )
$$;

CREATE OR REPLACE FUNCTION public.blocked_pair(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks ub
     WHERE (ub.blocker_id = a AND ub.blocked_id = b)
        OR (ub.blocker_id = b AND ub.blocked_id = a)
  )
$$;

REVOKE ALL ON FUNCTION public.connected_pair(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.blocked_pair(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connected_pair(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blocked_pair(UUID, UUID) TO authenticated;

-- The check every new row between two people goes through.
CREATE OR REPLACE FUNCTION public.check_people_pair(a UUID, b UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF a IS NULL OR b IS NULL OR a = b THEN
    RAISE EXCEPTION 'Choose someone else' USING ERRCODE = 'P0001', HINT = 'not_connected';
  END IF;
  IF public.blocked_pair(a, b) THEN
    RAISE EXCEPTION 'Not available' USING ERRCODE = 'P0001', HINT = 'unavailable';
  END IF;
  IF NOT public.connected_pair(a, b) THEN
    RAISE EXCEPTION 'Only with people you are connected to' USING ERRCODE = 'P0001', HINT = 'not_connected';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_people_pair(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Start from no rules on the old tables.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('messages', 'memes', 'meme_likes', 'video_calls')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- 1. Messages and notes of support ---------------------------------------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'message';
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_kind_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_kind_check CHECK (kind IN ('message', 'support'));

CREATE INDEX IF NOT EXISTS messages_sender_receiver_idx ON public.messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_receiver_unread_idx ON public.messages (receiver_id) WHERE read_at IS NULL;

COMMENT ON COLUMN public.messages.kind IS 'message: chat. support: a note of support (STEP 66).';

CREATE OR REPLACE FUNCTION public.check_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_people_pair(NEW.sender_id, NEW.receiver_id);
  NEW.content := btrim(coalesce(NEW.content, ''));
  IF NEW.content = '' THEN
    RAISE EXCEPTION 'Write something first' USING ERRCODE = 'P0001', HINT = 'empty';
  END IF;
  IF char_length(NEW.content) > (CASE WHEN NEW.kind = 'support' THEN 300 ELSE 2000 END) THEN
    RAISE EXCEPTION 'Too long' USING ERRCODE = 'P0001', HINT = 'too_long';
  END IF;
  IF (SELECT count(*) FROM public.messages
       WHERE sender_id = NEW.sender_id AND created_at > (now() - interval '1 hour')) >= 120 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.created_at := now();
  NEW.read_at := NULL;
  NEW.deleted_at := NULL;
  -- Shown at once. Reports (report_message) go to the team.
  NEW.is_moderated := FALSE;
  NEW.moderation_status := 'approved';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_new_message ON public.messages;
CREATE TRIGGER trg_check_new_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.check_new_message();

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_read_own" ON public.messages
  FOR SELECT TO authenticated
  USING (auth.uid() IN (sender_id, receiver_id) AND deleted_at IS NULL);

CREATE POLICY "messages_send_as_self" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_unsend_own" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(other UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;
  UPDATE public.messages
     SET read_at = now()
   WHERE receiver_id = auth.uid() AND sender_id = other AND read_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.message_reports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       UUID        REFERENCES public.messages(id) ON DELETE SET NULL,
  reporter_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  content_snapshot TEXT,
  reason           TEXT        CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.message_reports IS
  'Messages reported by the person who received them, with a copy of the text, for the team to review (STEP 66).';

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_reports_read" ON public.message_reports;
CREATE POLICY "message_reports_read" ON public.message_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'moderator'))
  );

REVOKE ALL ON public.message_reports FROM anon, authenticated;
GRANT SELECT ON public.message_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.report_message(message UUID, why TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.messages%ROWTYPE;
  report_id UUID;
BEGIN
  SELECT * INTO m FROM public.messages WHERE id = message AND receiver_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'P0001', HINT = 'not_found';
  END IF;
  INSERT INTO public.message_reports (message_id, reporter_id, reported_user_id, content_snapshot, reason)
  VALUES (m.id, auth.uid(), m.sender_id, m.content, left(nullif(btrim(coalesce(why, '')), ''), 500))
  RETURNING id INTO report_id;
  RETURN report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_message(UUID, TEXT) TO authenticated;

-- 2. Memes -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_new_meme()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  person UUID;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'No author' USING ERRCODE = 'P0001', HINT = 'empty';
  END IF;
  -- Pictures would need checking before others see them; emoji and words don't.
  IF NEW.content_type NOT IN ('emoji', 'text') THEN
    RAISE EXCEPTION 'Emoji or text only' USING ERRCODE = 'P0001', HINT = 'type';
  END IF;
  NEW.content := btrim(coalesce(NEW.content, ''));
  NEW.caption := nullif(btrim(coalesce(NEW.caption, '')), '');
  IF NEW.content = '' THEN
    RAISE EXCEPTION 'Write something first' USING ERRCODE = 'P0001', HINT = 'empty';
  END IF;
  IF char_length(NEW.content) > 300 OR char_length(coalesce(NEW.caption, '')) > 200 THEN
    RAISE EXCEPTION 'Too long' USING ERRCODE = 'P0001', HINT = 'too_long';
  END IF;
  NEW.shared_with := coalesce(NEW.shared_with, '{}');
  FOREACH person IN ARRAY NEW.shared_with LOOP
    PERFORM public.check_people_pair(NEW.user_id, person);
  END LOOP;
  IF (SELECT count(*) FROM public.memes
       WHERE user_id = NEW.user_id AND created_at > (now() - interval '1 hour')) >= 30 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.likes := 0;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_new_meme ON public.memes;
CREATE TRIGGER trg_check_new_meme
  BEFORE INSERT ON public.memes
  FOR EACH ROW EXECUTE FUNCTION public.check_new_meme();

ALTER TABLE public.memes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memes_read" ON public.memes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.connected_pair(auth.uid(), user_id)
      AND NOT public.blocked_pair(auth.uid(), user_id)
      AND (cardinality(coalesce(shared_with, '{}')) = 0 OR auth.uid() = ANY (shared_with))
    )
  );

CREATE POLICY "memes_post_as_self" ON public.memes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "memes_delete_own" ON public.memes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.memes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.memes TO authenticated;

ALTER TABLE public.meme_likes ENABLE ROW LEVEL SECURITY;

-- A like is seen with a meme you can see (the memes rule applies inside).
CREATE POLICY "meme_likes_read" ON public.meme_likes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.memes m WHERE m.id = meme_id));

CREATE POLICY "meme_likes_add_own" ON public.meme_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.memes m WHERE m.id = meme_id));

CREATE POLICY "meme_likes_remove_own" ON public.meme_likes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.meme_likes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.meme_likes TO authenticated;

CREATE OR REPLACE FUNCTION public.count_meme_likes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target UUID := coalesce(NEW.meme_id, OLD.meme_id);
BEGIN
  UPDATE public.memes
     SET likes = (SELECT count(*) FROM public.meme_likes WHERE meme_id = target)
   WHERE id = target;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_count_meme_likes ON public.meme_likes;
CREATE TRIGGER trg_count_meme_likes
  AFTER INSERT OR DELETE ON public.meme_likes
  FOR EACH ROW EXECUTE FUNCTION public.count_meme_likes();

-- 3. Calls -------------------------------------------------------------------
ALTER TABLE public.video_calls ADD COLUMN IF NOT EXISTS room_url TEXT;
ALTER TABLE public.video_calls DROP CONSTRAINT IF EXISTS video_calls_room_url_check;
ALTER TABLE public.video_calls ADD CONSTRAINT video_calls_room_url_check
  CHECK (room_url IS NULL OR (room_url ~ '^https://[^[:space:]<>"]+$' AND char_length(room_url) <= 300));

COMMENT ON COLUMN public.video_calls.room_url IS 'The video room for the call: one the app made, or a link the person pasted (STEP 66).';

CREATE OR REPLACE FUNCTION public.check_new_call()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_people_pair(NEW.caller_id, NEW.receiver_id);
  NEW.notes := nullif(btrim(coalesce(NEW.notes, '')), '');
  IF char_length(coalesce(NEW.notes, '')) > 500 THEN
    RAISE EXCEPTION 'Too long' USING ERRCODE = 'P0001', HINT = 'too_long';
  END IF;
  IF (SELECT count(*) FROM public.video_calls
       WHERE caller_id = NEW.caller_id AND created_at > (now() - interval '1 day')) >= 20 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.status := 'scheduled';
  NEW.scheduled_at := coalesce(NEW.scheduled_at, now());
  NEW.started_at := NULL;
  NEW.ended_at := NULL;
  NEW.duration := NULL;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_new_call ON public.video_calls;
CREATE TRIGGER trg_check_new_call
  BEFORE INSERT ON public.video_calls
  FOR EACH ROW EXECUTE FUNCTION public.check_new_call();

ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_calls_read_own" ON public.video_calls
  FOR SELECT TO authenticated
  USING (auth.uid() IN (caller_id, receiver_id));

CREATE POLICY "video_calls_book_as_self" ON public.video_calls
  FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid());

REVOKE ALL ON public.video_calls FROM anon, authenticated;
GRANT SELECT, INSERT ON public.video_calls TO authenticated;

CREATE OR REPLACE FUNCTION public.set_call_status(call UUID, new_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_status NOT IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'Cancel it or mark it done' USING ERRCODE = '22023';
  END IF;
  UPDATE public.video_calls
     SET status = new_status,
         ended_at = CASE WHEN new_status = 'completed' THEN now() ELSE ended_at END
   WHERE id = call AND auth.uid() IN (caller_id, receiver_id) AND status = 'scheduled';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found' USING ERRCODE = 'P0001', HINT = 'not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_call_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_call_status(UUID, TEXT) TO authenticated;

-- 4. Tasks from mentors --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentee_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  note       TEXT        CHECK (note IS NULL OR char_length(note) <= 500),
  due_on     DATE,
  status     TEXT        NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'done', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mentor_tasks_not_self CHECK (mentor_id <> mentee_id)
);

CREATE INDEX IF NOT EXISTS mentor_tasks_mentee_idx ON public.mentor_tasks (mentee_id, status);
CREATE INDEX IF NOT EXISTS mentor_tasks_mentor_idx ON public.mentor_tasks (mentor_id);

COMMENT ON TABLE public.mentor_tasks IS
  'Small tasks a mentor suggests to someone who chose them as a mentor; that person accepts, declines or ticks them off (STEP 66).';

CREATE OR REPLACE FUNCTION public.check_new_mentor_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_people_pair(NEW.mentor_id, NEW.mentee_id);
  -- Only someone the mentee chose as their mentor.
  IF NOT EXISTS (
    SELECT 1 FROM public.social_connections sc
     WHERE sc.owner_id = NEW.mentee_id AND sc.target_user_id = NEW.mentor_id
       AND sc.category = 'mentors' AND sc.status = 'connected'
  ) THEN
    RAISE EXCEPTION 'Only for people who chose you as a mentor' USING ERRCODE = 'P0001', HINT = 'not_mentor';
  END IF;
  NEW.title := btrim(coalesce(NEW.title, ''));
  NEW.note := nullif(btrim(coalesce(NEW.note, '')), '');
  IF (SELECT count(*) FROM public.mentor_tasks
       WHERE mentor_id = NEW.mentor_id AND created_at > (now() - interval '1 day')) >= 30 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.status := 'suggested';
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_new_mentor_task ON public.mentor_tasks;
CREATE TRIGGER trg_check_new_mentor_task
  BEFORE INSERT ON public.mentor_tasks
  FOR EACH ROW EXECUTE FUNCTION public.check_new_mentor_task();

ALTER TABLE public.mentor_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentor_tasks_read_own" ON public.mentor_tasks;
CREATE POLICY "mentor_tasks_read_own" ON public.mentor_tasks
  FOR SELECT TO authenticated
  USING (auth.uid() IN (mentor_id, mentee_id));

DROP POLICY IF EXISTS "mentor_tasks_suggest_as_self" ON public.mentor_tasks;
CREATE POLICY "mentor_tasks_suggest_as_self" ON public.mentor_tasks
  FOR INSERT TO authenticated
  WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "mentor_tasks_remove_own" ON public.mentor_tasks;
CREATE POLICY "mentor_tasks_remove_own" ON public.mentor_tasks
  FOR DELETE TO authenticated
  USING (auth.uid() IN (mentor_id, mentee_id));

REVOKE ALL ON public.mentor_tasks FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.mentor_tasks TO authenticated;

CREATE OR REPLACE FUNCTION public.set_mentor_task_status(task UUID, new_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_status NOT IN ('accepted', 'done', 'declined', 'suggested') THEN
    RAISE EXCEPTION 'Accept, decline or tick it off' USING ERRCODE = '22023';
  END IF;
  UPDATE public.mentor_tasks
     SET status = new_status, updated_at = now()
   WHERE id = task AND mentee_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0001', HINT = 'not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_mentor_task_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_mentor_task_status(UUID, TEXT) TO authenticated;

-- 5. Goals together ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.race_collabs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal         TEXT        NOT NULL CHECK (char_length(goal) BETWEEN 1 AND 200),
  note         TEXT        CHECK (note IS NULL OR char_length(note) <= 300),
  status       TEXT        NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT race_collabs_not_self CHECK (owner_id <> partner_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS race_collabs_once ON public.race_collabs (owner_id, partner_id, lower(goal));
CREATE INDEX IF NOT EXISTS race_collabs_partner_idx ON public.race_collabs (partner_id, status);

COMMENT ON TABLE public.race_collabs IS
  'One of your goals, worked on with a connection who accepted (STEP 66).';

CREATE OR REPLACE FUNCTION public.check_new_race_collab()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_people_pair(NEW.owner_id, NEW.partner_id);
  NEW.goal := btrim(coalesce(NEW.goal, ''));
  NEW.note := nullif(btrim(coalesce(NEW.note, '')), '');
  IF (SELECT count(*) FROM public.race_collabs
       WHERE owner_id = NEW.owner_id AND created_at > (now() - interval '1 day')) >= 20 THEN
    RAISE EXCEPTION 'Slow down' USING ERRCODE = 'P0001', HINT = 'slow_down';
  END IF;
  NEW.status := 'invited';
  NEW.responded_at := NULL;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_new_race_collab ON public.race_collabs;
CREATE TRIGGER trg_check_new_race_collab
  BEFORE INSERT ON public.race_collabs
  FOR EACH ROW EXECUTE FUNCTION public.check_new_race_collab();

ALTER TABLE public.race_collabs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "race_collabs_read_own" ON public.race_collabs;
CREATE POLICY "race_collabs_read_own" ON public.race_collabs
  FOR SELECT TO authenticated
  USING (auth.uid() IN (owner_id, partner_id));

DROP POLICY IF EXISTS "race_collabs_invite_as_self" ON public.race_collabs;
CREATE POLICY "race_collabs_invite_as_self" ON public.race_collabs
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "race_collabs_leave" ON public.race_collabs;
CREATE POLICY "race_collabs_leave" ON public.race_collabs
  FOR DELETE TO authenticated
  USING (auth.uid() IN (owner_id, partner_id));

REVOKE ALL ON public.race_collabs FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.race_collabs TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_race_collab(collab UUID, accept BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.race_collabs
     SET status = CASE WHEN accept THEN 'accepted' ELSE 'declined' END,
         responded_at = now()
   WHERE id = collab AND partner_id = auth.uid() AND status = 'invited';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0001', HINT = 'not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_race_collab(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_race_collab(UUID, BOOLEAN) TO authenticated;

-- 6. Blocking clears what was waiting ----------------------------------------
CREATE OR REPLACE FUNCTION public.block_user(target UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;
  IF target IS NULL OR target = me THEN
    RAISE EXCEPTION 'Choose someone else to block' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (me, target)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.social_connections
   WHERE (owner_id = me AND target_user_id = target)
      OR (owner_id = target AND target_user_id = me);

  -- What was waiting between the two of you (STEP 66).
  UPDATE public.video_calls SET status = 'cancelled'
   WHERE status = 'scheduled'
     AND ((caller_id = me AND receiver_id = target) OR (caller_id = target AND receiver_id = me));
  DELETE FROM public.mentor_tasks
   WHERE status = 'suggested'
     AND ((mentor_id = me AND mentee_id = target) OR (mentor_id = target AND mentee_id = me));
  DELETE FROM public.race_collabs
   WHERE status = 'invited'
     AND ((owner_id = me AND partner_id = target) OR (owner_id = target AND partner_id = me));
END;
$$;

COMMENT ON FUNCTION public.block_user(UUID) IS
  'Block someone: removes every connection and request between you, both ways, hides you from each other (STEP 65), and clears booked calls, task suggestions and invitations between you (STEP 66).';

REVOKE ALL ON FUNCTION public.block_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;
