-- =====================================================================
-- Reviewing reported messages (STEP 67)
--
-- STEP 66 kept a copy of every reported message in message_reports, but
-- nobody could review them except in the database. ResourceHub's admin
-- area now has Reported messages (/admin/messages), where the team reads
-- each report, writes what was done, marks it resolved, and can ban the
-- sender from there.
--
-- 1. message_reports.resolution: what the team did, in a sentence.
-- 2. A banned account (profiles.role = 'banned', set in Admin, then Users)
--    can no longer message, send notes, share memes, book
--    calls, suggest tasks or invite people to goals, and nobody can do those
--    with them. Until now a ban only applied in ResourceHub.
--
-- Run after STEP 66. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. What was done ---------------------------------------------------------
ALTER TABLE public.message_reports ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE public.message_reports DROP CONSTRAINT IF EXISTS message_reports_resolution_length;
ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_resolution_length
  CHECK (resolution IS NULL OR char_length(resolution) <= 500);

COMMENT ON COLUMN public.message_reports.resolution IS
  'What the team did about the report, written when it was resolved (STEP 67).';

CREATE INDEX IF NOT EXISTS message_reports_open_idx
  ON public.message_reports (created_at DESC) WHERE resolved_at IS NULL;

-- 2. A ban applies to Hare World too ---------------------------------------
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
  -- Banned by the team (STEP 67). Said the same way as a block, so the other
  -- person isn't told why.
  IF EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id IN (a, b) AND pr.role = 'banned') THEN
    RAISE EXCEPTION 'Not available' USING ERRCODE = 'P0001', HINT = 'unavailable';
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

-- Memes shared with all your connections name nobody, so the check above
-- isn't reached; the meme check says it itself.
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
  -- Banned by the team (STEP 67): no memes, even for all connections.
  IF EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = NEW.user_id AND pr.role = 'banned') THEN
    RAISE EXCEPTION 'Not available' USING ERRCODE = 'P0001', HINT = 'unavailable';
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
