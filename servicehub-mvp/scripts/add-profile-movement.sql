-- Add a JSONB `movement` column to profiles for server-side navigation analytics.
--
-- Records the order a user moves through the app's screens so we can answer
-- "what path did they take through the product?" across devices (localStorage
-- alone is device-scoped and cleared easily). The client mirrors its local
-- movement log here periodically via POST /api/me/movement.
--
-- Shape:
--   {
--     "visits": [ { "path": "/races", "label": "Races", "at": "2026-01-01T..." }, ... ],
--     "summary": "Home → Onboarding → Races → Tasks",
--     "updatedAt": "2026-01-01T..."
--   }

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS movement JSONB DEFAULT '{}'::jsonb;

-- Index for analytics queries that filter/inspect the movement blob.
CREATE INDEX IF NOT EXISTS idx_profiles_movement ON public.profiles USING gin (movement);
