-- =====================================================================
-- Adaptation offers: "Did that help?", twice (STEP 74)
--
-- After someone accepts a suggested change (STEP 73), the Path asks once,
-- yes or no, whether it helped; and once more on their first visit to the
-- Path at least 7 days after accepting. No scheduled job: the backend works
-- out which question is due when the Path asks for its suggestions
-- (api/routes/adaptations.py). Both answers are kept on the offer's row.
--
--   helped_first, helped_first_at    the answer after accepting
--   helped_second, helped_second_at  the answer 7 days or more later
--
-- Only an accepted offer can have an answer. Written by the backend only.
-- Off unless ADAPTATION_OFFERS_ENABLED=true and
-- NEXT_PUBLIC_ADAPTATION_OFFERS_ENABLED=true.
--
-- Run after STEP 73. Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.adaptation_outcomes
  ADD COLUMN IF NOT EXISTS helped_first      TEXT,
  ADD COLUMN IF NOT EXISTS helped_first_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS helped_second     TEXT,
  ADD COLUMN IF NOT EXISTS helped_second_at  TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adaptation_outcomes_helped_answers') THEN
    ALTER TABLE public.adaptation_outcomes
      ADD CONSTRAINT adaptation_outcomes_helped_answers
      CHECK ((helped_first IS NULL OR helped_first IN ('yes', 'no'))
         AND (helped_second IS NULL OR helped_second IN ('yes', 'no')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adaptation_outcomes_helped_after_accept') THEN
    ALTER TABLE public.adaptation_outcomes
      ADD CONSTRAINT adaptation_outcomes_helped_after_accept
      CHECK ((helped_first IS NULL AND helped_second IS NULL) OR accepted_at IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.adaptation_outcomes.helped_second IS
  '"Did it help?" asked again on the first Path visit 7 or more days after accepting (STEP 74).';
