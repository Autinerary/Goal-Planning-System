-- =====================================================================
-- What became of each step: a lasting record of the steps a plan showed (STEP 92)
--
-- 29 October 2026. Autinerary is building a model that forecasts, from a
-- person's own history, which of their steps they are likely to do next. It
-- is trained only on made-up histories; no person's data trains it. Checking
-- it needs what production can't answer today: which steps someone was shown,
-- and which of those they did. A plan's steps live only in user_paths.payload,
-- which the next plan replaces, and step ids are positions
-- (milestone_g0_education_1) that the next plan reuses for a different step:
-- on 29 October, 74 of the 83 steps real people had finished could no longer
-- be tied to the step they finished.
--
--   plan_step_history   one row per step per version of a plan: when that
--                       version was first and last saved, and the step's
--                       shape in closed categories and numbers only (its
--                       life area, estimated days, order, the plan's size,
--                       the goal's number, whether its name was written for
--                       the person). Never its name or description, nor
--                       anything the person typed. Completion stays in
--                       race_progress: a completion belongs to the latest
--                       version first saved before it.
--
-- Written only by a trigger on user_paths, which never stops a plan saving;
-- filled once from the plans saved so far. A person reads their own rows
-- (they are in their data download, and starting over clears them); deleted
-- with the account.
--
-- Nothing else changes. Run after STEP 91. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. The record -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_step_history (
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id        TEXT        NOT NULL CHECK (char_length(path_id) <= 100),
  plan_version   TEXT        NOT NULL CHECK (char_length(plan_version) BETWEEN 1 AND 100),
  milestone_id   TEXT        NOT NULL CHECK (char_length(milestone_id) BETWEEN 1 AND 200),
  area           TEXT        CHECK (area IN ('education', 'career', 'relationships', 'health')),
  estimated_days SMALLINT    CHECK (estimated_days BETWEEN 0 AND 3650),
  step_order     SMALLINT    CHECK (step_order BETWEEN 0 AND 1000),
  plan_size      SMALLINT    CHECK (plan_size BETWEEN 1 AND 1000),
  goal_index     SMALLINT    CHECK (goal_index BETWEEN 0 AND 99),
  name_source    TEXT        CHECK (name_source IN ('generated', 'template')),
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, plan_version, milestone_id)
);

CREATE INDEX IF NOT EXISTS plan_step_history_user_step ON public.plan_step_history (user_id, milestone_id);

ALTER TABLE public.plan_step_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_step_history_own_read ON public.plan_step_history;
CREATE POLICY plan_step_history_own_read ON public.plan_step_history
  FOR SELECT USING (user_id = auth.uid());

-- Only the trigger writes it.
REVOKE ALL ON public.plan_step_history FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.plan_step_history FROM authenticated;

COMMENT ON TABLE public.plan_step_history IS
  'STEP 92: one row per step per version of a person''s plan: when that version was first and last saved, and the step''s shape in closed categories and numbers only (never its words). For checking forecasts of which steps people do; completions stay in race_progress. Written only by the trigger on user_paths; read by its owner; deleted with the account.';

-- 2. Recording a plan's steps ---------------------------------------------
-- Every jsonb call is guarded by jsonb_typeof, and any error is caught: a
-- plan always saves, with or without its record.
CREATE OR REPLACE FUNCTION public.plan_step_history_record(p_user UUID, p_path TEXT, p_payload JSONB,
                                                           p_first TIMESTAMPTZ, p_last TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  steps    JSONB;
  n        INTEGER;
  version  TEXT;
  recorded INTEGER := 0;
BEGIN
  IF p_user IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN 0;
  END IF;
  steps := CASE
    WHEN jsonb_typeof(p_payload -> 'path') = 'object' AND jsonb_typeof(p_payload #> '{path,milestones}') = 'array'
      THEN p_payload #> '{path,milestones}'
    ELSE '[]'::jsonb
  END;
  n := jsonb_array_length(steps);
  IF n = 0 THEN
    RETURN 0;
  END IF;
  version := left(coalesce(nullif(p_payload ->> 'generatedAt', ''), nullif(p_payload ->> 'id', ''), nullif(p_path, ''), 'unknown'), 100);

  INSERT INTO public.plan_step_history AS h
    (user_id, path_id, plan_version, milestone_id, area, estimated_days, step_order, plan_size, goal_index, name_source,
     first_seen_at, last_seen_at)
  SELECT DISTINCT ON (s ->> 'id')
         p_user, left(coalesce(p_path, ''), 100), version, s ->> 'id',
         CASE WHEN s ->> 'category' IN ('education', 'career', 'relationships', 'health') THEN s ->> 'category' END,
         CASE WHEN s ->> 'estimatedDays' ~ '^[0-9]{1,4}(\.[0-9]+)?$'
              THEN least(round((s ->> 'estimatedDays')::numeric), 3650)::smallint END,
         CASE WHEN s ->> 'order' ~ '^[0-9]{1,3}$' THEN least((s ->> 'order')::int, 1000)::smallint END,
         least(n, 1000)::smallint,
         CASE WHEN s ->> 'raceId' ~ '^race_[0-9]{1,2}$' THEN substring(s ->> 'raceId' FROM 6)::smallint END,
         CASE WHEN s ->> 'nameSource' IN ('generated', 'template') THEN s ->> 'nameSource' END,
         p_first, greatest(p_first, p_last)
  FROM jsonb_array_elements(steps) AS s
  WHERE jsonb_typeof(s) = 'object' AND char_length(coalesce(s ->> 'id', '')) BETWEEN 1 AND 200
  ORDER BY s ->> 'id'
  ON CONFLICT (user_id, plan_version, milestone_id) DO UPDATE
    SET first_seen_at = least(h.first_seen_at, EXCLUDED.first_seen_at),
        last_seen_at  = greatest(h.last_seen_at, EXCLUDED.last_seen_at);
  GET DIAGNOSTICS recorded = ROW_COUNT;
  RETURN recorded;
EXCEPTION WHEN others THEN
  RAISE WARNING 'plan_step_history_record: %', SQLERRM;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_step_history_on_save()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.plan_step_history_record(NEW.user_id, NEW.path_id, NEW.payload, now(), now());
  RETURN NEW;
END;
$$;

-- Nobody calls these directly: the record function takes any person's id.
REVOKE ALL ON FUNCTION public.plan_step_history_record(UUID, TEXT, JSONB, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_step_history_on_save() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS plan_step_history_on_save ON public.user_paths;
CREATE TRIGGER plan_step_history_on_save
  AFTER INSERT OR UPDATE OF payload ON public.user_paths
  FOR EACH ROW EXECUTE FUNCTION public.plan_step_history_on_save();

-- 3. The plans saved so far, once -------------------------------------------
-- Each from when it was generated (or, failing that, first saved) to when it
-- was last saved. Plans whose account no longer exists are skipped.
DO $$
DECLARE
  r       RECORD;
  made_at TIMESTAMPTZ;
BEGIN
  FOR r IN
    SELECT p.user_id, p.path_id, p.payload, p.updated_at, p.created_at
    FROM public.user_paths p
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id)
  LOOP
    made_at := coalesce(r.created_at, r.updated_at, now());
    BEGIN
      IF r.payload ->> 'generatedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}' THEN
        made_at := least((r.payload ->> 'generatedAt')::timestamptz, now());
      END IF;
    EXCEPTION WHEN others THEN
      made_at := coalesce(r.created_at, r.updated_at, now());
    END;
    PERFORM public.plan_step_history_record(r.user_id, r.path_id, r.payload, made_at, coalesce(r.updated_at, made_at));
  END LOOP;
END;
$$;
