-- ============================================================================
-- Relationship declaration flag (Odosa follow-up).
--
-- relationship defaults to 'lived', which is the safe default for weighting —
-- it never silently demotes anyone. But it makes "I declared lived experience"
-- indistinguishable from "nobody ever asked me", so the badge would claim
-- lived experience for people who never said so.
--
-- This flag separates the two:
--   relationship_declared = FALSE  never asked  -> no badge, weight 1.0 (safe)
--   relationship_declared = TRUE   user chose   -> badge shown, weight applied
--
-- Existing rows are FALSE: nobody is retroactively credited with a claim they
-- didn't make.
--
-- Idempotent. Requires 2026_relationship_weighting.sql.
-- ============================================================================

ALTER TABLE public.user_barriers
  ADD COLUMN IF NOT EXISTS relationship_declared BOOLEAN NOT NULL DEFAULT FALSE;

-- Onboarding answers ARE a declaration, so backfill anyone who picked a
-- non-default relationship — only 'lived' is ambiguous with the column default.
UPDATE public.user_barriers
   SET relationship_declared = TRUE
 WHERE relationship IS NOT NULL
   AND relationship <> 'lived'
   AND relationship_declared = FALSE;

CREATE INDEX IF NOT EXISTS user_barriers_relationship_declared_idx
  ON public.user_barriers (user_id, relationship_declared);

COMMENT ON COLUMN public.user_barriers.relationship_declared IS
  'TRUE only when the person explicitly chose their relationship. Undeclared rows show no badge and are weighted as lived (safe default).';
