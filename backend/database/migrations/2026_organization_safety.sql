-- STEP 102 — groups for the safety check (backend core/moderation.py; docs/ai-moderation.md), on the organisations
-- STEP 17 made (organizations, organization_members), so a student group or a service can use Autinerary with the
-- people it supports. Safe to run twice.
--
-- 1. Each group can have crisis lines of its own, such as its campus counselling, shown on its members' crisis card
--    (organizations.crisis_lines; set by the group's leaders or the team, through the app's server).
-- 2. The safety check's counts carry the groups of the person they're about (ai_safety_events.org_ids), never the
--    person, and the journal can be counted too (surface 'journal').
-- 3. A group's leaders see their group's counts, week by week (organization_safety_counts): only once the group has
--    at least 10 members, and with 1s and 2s hidden, so no one can be picked out. The team sees every group's.
-- 4. Two fixes to STEP 17's sharing, before groups are used:
--    - anyone could read every group's join code (the table was readable whole), and so join any group: the code is
--      now readable only through the app's server, which gives it to the group's leaders;
--    - "members see the rows of the groups they belong to" looked itself up, which Postgres refuses as recursion;
--      now each person reads their own membership rows. Who else is in a group is for its leaders, through the
--      server. Nothing in the apps reads other members' rows with a person's own sign-in.
BEGIN;

-- 1. A group's own crisis lines: [{"name", "how", "tel", "sms", "smsBody"}], at most 5.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS crisis_lines jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_crisis_lines_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_crisis_lines_check
  CHECK (CASE WHEN jsonb_typeof(crisis_lines) = 'array' THEN jsonb_array_length(crisis_lines) <= 5 ELSE false END);

-- 2. The counts carry the person's groups, and the journal is counted too.
ALTER TABLE public.ai_safety_events
  ADD COLUMN IF NOT EXISTS org_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS ai_safety_events_org_ids ON public.ai_safety_events USING GIN (org_ids);
ALTER TABLE public.ai_safety_events DROP CONSTRAINT IF EXISTS ai_safety_events_surface_check;
ALTER TABLE public.ai_safety_events ADD CONSTRAINT ai_safety_events_surface_check
  CHECK (surface IN ('assistant', 'agent', 'journal'));

-- 3. A group's counts, for its leaders and the team.
CREATE OR REPLACE FUNCTION public.organization_safety_counts(p_org uuid, p_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  minimum CONSTANT int := 10;    -- members a group needs before its counts are shown
  smallest CONSTANT int := 3;    -- a count of 1 or 2 is shown as "fewer than 3"
  members int;
  span int := LEAST(GREATEST(COALESCE(p_days, 90), 7), 365);
  result jsonb;
BEGIN
  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.org_id = p_org AND m.user_id = auth.uid() AND m.role = 'leader')) THEN
    RAISE EXCEPTION 'Only this group''s leaders can see its counts.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT count(*) INTO members FROM public.organization_members WHERE org_id = p_org;
  IF members < minimum THEN
    RETURN jsonb_build_object('members', members, 'enough', false, 'minimum', minimum, 'smallest', smallest, 'days', span);
  END IF;

  WITH ev AS (
    SELECT date_trunc('week', created_at)::date AS week,
           CASE WHEN checked_by = 'unavailable' AND action = 'allow' THEN 'unchecked' ELSE action END AS action
      FROM public.ai_safety_events
     WHERE p_org = ANY (org_ids) AND created_at >= now() - make_interval(days => span)
  ), weeks AS (
    SELECT week,
           count(*) FILTER (WHERE action = 'care') AS care,
           count(*) FILTER (WHERE action = 'steer') AS steer,
           count(*) FILTER (WHERE action = 'hide') AS hide,
           count(*) FILTER (WHERE action IN ('rewritten', 'dropped')) AS answers,
           count(*) FILTER (WHERE action = 'unchecked') AS unchecked
      FROM ev GROUP BY week
  ), totals AS (
    SELECT count(*) FILTER (WHERE action = 'care') AS care,
           count(*) FILTER (WHERE action = 'steer') AS steer,
           count(*) FILTER (WHERE action = 'hide') AS hide,
           count(*) FILTER (WHERE action IN ('rewritten', 'dropped')) AS answers,
           count(*) FILTER (WHERE action = 'unchecked') AS unchecked
      FROM ev
  )
  SELECT jsonb_build_object(
    'members', members, 'enough', true, 'minimum', minimum, 'smallest', smallest, 'days', span,
    'totals', (SELECT jsonb_build_object(
        'care',      CASE WHEN t.care      BETWEEN 1 AND smallest - 1 THEN NULL ELSE t.care END,
        'steer',     CASE WHEN t.steer     BETWEEN 1 AND smallest - 1 THEN NULL ELSE t.steer END,
        'hide',      CASE WHEN t.hide      BETWEEN 1 AND smallest - 1 THEN NULL ELSE t.hide END,
        'answers',   CASE WHEN t.answers   BETWEEN 1 AND smallest - 1 THEN NULL ELSE t.answers END,
        'unchecked', CASE WHEN t.unchecked BETWEEN 1 AND smallest - 1 THEN NULL ELSE t.unchecked END)
      FROM totals t),
    'weeks', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'week',      w.week,
        'care',      CASE WHEN w.care      BETWEEN 1 AND smallest - 1 THEN NULL ELSE w.care END,
        'steer',     CASE WHEN w.steer     BETWEEN 1 AND smallest - 1 THEN NULL ELSE w.steer END,
        'hide',      CASE WHEN w.hide      BETWEEN 1 AND smallest - 1 THEN NULL ELSE w.hide END,
        'answers',   CASE WHEN w.answers   BETWEEN 1 AND smallest - 1 THEN NULL ELSE w.answers END,
        'unchecked', CASE WHEN w.unchecked BETWEEN 1 AND smallest - 1 THEN NULL ELSE w.unchecked END)
        ORDER BY w.week DESC) FROM weeks w), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.organization_safety_counts(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organization_safety_counts(uuid, int) TO authenticated;

-- 4a. The join code isn't readable from the browser: every other column is, as before.
REVOKE SELECT ON public.organizations FROM anon, authenticated;
GRANT SELECT (id, slug, name, description, website, logo_url, is_verified, created_at, crisis_lines)
  ON public.organizations TO anon, authenticated;

-- 4b. Each person reads their own membership rows (no recursion).
DROP POLICY IF EXISTS organization_members_read ON public.organization_members;
CREATE POLICY organization_members_read ON public.organization_members
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON COLUMN public.organizations.crisis_lines IS
  'STEP 102: the group''s own crisis lines (for example its campus counselling), shown on its members'' crisis card: [{name, how, tel, sms, smsBody}], at most 5.';
COMMENT ON COLUMN public.ai_safety_events.org_ids IS
  'STEP 102: the groups of the person a line is about, never the person, so each group''s leaders can see its counts (organization_safety_counts).';

COMMIT;

NOTIFY pgrst, 'reload schema';
