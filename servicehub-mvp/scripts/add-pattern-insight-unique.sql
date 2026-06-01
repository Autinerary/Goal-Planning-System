-- Migration: add unique constraint on pattern_discoveries.insight
-- Required so the patterns API upsert (onConflict: 'insight') dedupes correctly.
-- Safe to run multiple times.

-- Remove any pre-existing duplicate insights, keeping the most recent row
DELETE FROM public.pattern_discoveries a
USING public.pattern_discoveries b
WHERE a.insight = b.insight
  AND a.discovered_at < b.discovered_at;

-- Create the unique index (acts as the conflict target for upserts)
CREATE UNIQUE INDEX IF NOT EXISTS pattern_discoveries_insight_key
  ON public.pattern_discoveries(insight);
