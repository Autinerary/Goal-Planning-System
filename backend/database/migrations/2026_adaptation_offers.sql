-- =====================================================================
-- Adaptation offers: a suggested change, offered and answered (STEP 73)
--
-- Adaptation never changed anyone's plan: its rules couldn't fire, and no
-- route applied one (8 October audit). It now suggests one change to one
-- milestone at a time, on the Path page, and only the person's Accept
-- changes their stored path (docs/reports/adaptation-2026-10-13.md).
--
-- Every offer and its answer is a row in adaptation_outcomes:
--   * path_id, milestone_id: the step it names (ids repeat across a
--     person's paths, so both);
--   * suggestion_id: fixed by rule, path and milestone, unique per person,
--     so a suggestion is offered once, whatever the answer;
--   * change: what it would change, and the words it was offered with;
--   * offered_at, accepted_at, dismissed_at ("Not now"): one answer at most.
-- rule_fired holds the rule's name, as for the rows before.
--
-- close_adaptation_loop credited every unresolved row of the last 14 days
-- with the next journal entry's reward. Offers are not fired adaptations,
-- so it now leaves them out.
--
-- Written by the backend only (api/routes/adaptations.py), as before: RLS
-- stays on with no policies. Off unless ADAPTATION_OFFERS_ENABLED=true on
-- the backend and NEXT_PUBLIC_ADAPTATION_OFFERS_ENABLED=true in the app;
-- until this is applied the route says offers aren't available.
--
-- Run after STEP 71. Independent of STEP 72 (schedule feedback), which may come
-- before or after it. Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.adaptation_outcomes
  ADD COLUMN IF NOT EXISTS path_id        TEXT,
  ADD COLUMN IF NOT EXISTS milestone_id   TEXT,
  ADD COLUMN IF NOT EXISTS suggestion_id  TEXT,
  ADD COLUMN IF NOT EXISTS change         JSONB,
  ADD COLUMN IF NOT EXISTS offered_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_at   TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS adaptation_outcomes_offer_once
  ON public.adaptation_outcomes (user_id, suggestion_id)
  WHERE suggestion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS adaptation_outcomes_offers_by_path
  ON public.adaptation_outcomes (user_id, path_id)
  WHERE suggestion_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adaptation_outcomes_one_answer') THEN
    ALTER TABLE public.adaptation_outcomes
      ADD CONSTRAINT adaptation_outcomes_one_answer CHECK (accepted_at IS NULL OR dismissed_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adaptation_outcomes_offer_named') THEN
    ALTER TABLE public.adaptation_outcomes
      ADD CONSTRAINT adaptation_outcomes_offer_named
      CHECK (suggestion_id IS NULL OR (path_id IS NOT NULL AND milestone_id IS NOT NULL AND offered_at IS NOT NULL));
  END IF;
END $$;

-- The journal's reward loop: unchanged, except that offers are left out.
CREATE OR REPLACE FUNCTION public.close_adaptation_loop(
  user_id_in UUID,
  reward_in  REAL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE public.adaptation_outcomes
     SET next_reflection_reward = reward_in,
         outcome_resolved_at    = NOW()
   WHERE user_id = user_id_in
     AND next_reflection_reward IS NULL
     AND suggestion_id IS NULL
     AND created_at > NOW() - INTERVAL '14 days';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON COLUMN public.adaptation_outcomes.suggestion_id IS
  'An offered change (STEP 73): fixed by rule, path and milestone; offered once per person.';
