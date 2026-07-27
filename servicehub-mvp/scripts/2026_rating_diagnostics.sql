-- Rater diagnostics on ratings — enables the nested Rating Breakdown (Odosa).
--
-- Denormalizes the RATER's own diagnostic features + severities onto their
-- rating (a map { barrier_type: severity 1-5 }, e.g. {"autism": 3, "adhd": 2}).
-- This lets us break area ratings (sensory, mobility…) down by diagnostic
-- feature + level WITHOUT reading other users' diagnostic profiles (blocked by
-- RLS). Set from the rater's own user_barriers at rating time.
--
-- Run once against the shared Supabase project. Idempotent.

ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS rater_diagnostics JSONB NOT NULL DEFAULT '{}';
