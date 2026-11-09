-- STEP 101 — what the safety check on the assistant and on agents found and did, as counts (backend
-- core/moderation.py; docs/ai-moderation.md). One line each time it hid personal details, steered an answer, gave the
-- crisis lines, wrote an answer again or left it out, or couldn't run: what kind of thing it was and what was done.
-- No words, no account, and the time only to the hour, so it can't say who wrote what: only how often, and what kind.
-- Written by our server (the service role); read by the team (is_admin) on /admin/ai-safety. Nothing else changes.
-- Safe to run twice.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_safety_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  surface     text NOT NULL CHECK (surface IN ('assistant', 'agent')),
  direction   text NOT NULL CHECK (direction IN ('person', 'reply')),
  severity    smallint NOT NULL CHECK (severity BETWEEN 0 AND 4),
  category    text NOT NULL CHECK (category IN ('none', 'care', 'personal_info', 'sexual', 'violence', 'hate_harassment',
                                                'dangerous', 'jailbreak', 'exploitation', 'medical_advice')),
  action      text NOT NULL CHECK (action IN ('allow', 'hide', 'steer', 'care', 'rewritten', 'dropped')),
  checked_by  text NOT NULL CHECK (checked_by IN ('openai', 'rules', 'unavailable')),
  hidden      text[] CHECK (hidden IS NULL OR hidden <@ ARRAY['email', 'phone', 'id_number', 'address', 'password']::text[])
);

-- The hour, whatever the server sends: a time to the second could be matched with other records.
CREATE OR REPLACE FUNCTION public.ai_safety_events_to_the_hour()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_at := date_trunc('hour', now());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ai_safety_events_to_the_hour() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ai_safety_events_to_the_hour ON public.ai_safety_events;
CREATE TRIGGER trg_ai_safety_events_to_the_hour
  BEFORE INSERT OR UPDATE ON public.ai_safety_events
  FOR EACH ROW EXECUTE FUNCTION public.ai_safety_events_to_the_hour();

CREATE INDEX IF NOT EXISTS ai_safety_events_created_at ON public.ai_safety_events (created_at DESC);

-- Nobody signed in writes or changes a line; the team reads them.
ALTER TABLE public.ai_safety_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_safety_events FROM anon, authenticated;
GRANT SELECT ON public.ai_safety_events TO authenticated;
DROP POLICY IF EXISTS ai_safety_events_team_reads ON public.ai_safety_events;
CREATE POLICY ai_safety_events_team_reads ON public.ai_safety_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.ai_safety_events IS
  'STEP 101: what the safety check on the assistant and on agents found and did (core/moderation.py), as counts: no words, no account, the time to the hour. Written by the server; read by the team.';

COMMIT;

NOTIFY pgrst, 'reload schema';
