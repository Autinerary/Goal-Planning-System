-- =====================================================================
-- Flag paths written before the agents computed their own numbers (STEP 53)
--
-- Until 064801c (26 August 2026, "derive confidence from real signals") the
-- agents wrote fixed numbers into every path they generated: path planning's
-- confidence 0.85, calendar optimization's 0.82, pattern recognition's 0.80,
-- and pattern recognition's "patterns" carried a made-up success_rate of 0.82
-- (and 0.79). Those values describe the old code, not the person. Paths
-- generated since then compute them.
--
-- is_legacy marks the rows from before, so any evaluation that assumes real
-- computed values can leave them out. Nothing is deleted or changed: the
-- payload stays exactly as it was.
--
-- How a legacy row is recognised: the same change added `nameSource` to every
-- milestone, so a path none of whose milestones carries it was written by the
-- old code. Checked on 8 October 2026 against all 95 rows: it marks exactly
-- the 16 paths generated before 26 August, and none after. The fixed values
-- alone are not a safe test: pattern recognition's computed confidence can
-- legitimately round to 0.80, and does in 4 paths generated in September.
--
--   rule (fixed value present in the path)            paths
--   path planning confidence 0.85                        16
--   calendar optimization confidence 0.82                16
--   pattern recognition confidence 0.80                  16  (+4 later paths
--                                                             where 0.80 was
--                                                             computed: not flagged)
--   pattern recognition patterns[].success_rate 0.82    14
--   flagged in total (rows written before 064801c)       16
--
-- A boolean rather than a data_version column: it is the smaller change (one
-- column, no writer changes, since every new row is simply not legacy) and it
-- answers the only question asked of it, "can these numbers be trusted?".
-- A data_version would need every writer to stamp a version from now on.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

ALTER TABLE public.user_paths
  ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_paths.is_legacy IS
  'true = generated before 064801c (26 Aug 2026): agent confidences and pattern success_rate in the payload are fixed values from the old code, not computed. Exclude from evaluations of those values.';

-- Every array function is wrapped in CASE: Postgres does not evaluate AND
-- left to right, so a type check beside it does not protect it.
UPDATE public.user_paths AS p
SET is_legacy = true
WHERE NOT p.is_legacy
  -- has milestones at all
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.payload::jsonb -> 'races') = 'array'
           THEN p.payload::jsonb -> 'races' ELSE '[]'::jsonb END
    ) AS r(race)
    WHERE CASE WHEN jsonb_typeof(r.race -> 'milestones') = 'array'
               THEN jsonb_array_length(r.race -> 'milestones') ELSE 0 END > 0
  )
  -- and none of them carries nameSource
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.payload::jsonb -> 'races') = 'array'
           THEN p.payload::jsonb -> 'races' ELSE '[]'::jsonb END
    ) AS r(race)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.race -> 'milestones') = 'array'
           THEN r.race -> 'milestones' ELSE '[]'::jsonb END
    ) AS m(milestone)
    WHERE jsonb_typeof(m.milestone) = 'object' AND m.milestone ? 'nameSource'
  );

CREATE INDEX IF NOT EXISTS user_paths_is_legacy_idx
  ON public.user_paths (is_legacy) WHERE is_legacy;
