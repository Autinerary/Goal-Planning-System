-- Add a JSONB `preferences` column to profiles for view/interaction settings.
--
-- Stores the user's recorded choices so we can adapt the UI and learn from
-- intersecting profiles (e.g. "seniors with ADHD", "young adults with OCD").
-- Shape (all optional):
--   {
--     "ageRange": "18-40" | "40-65" | "65+",
--     "techSavvy": "not_at_all" | "somewhat" | "always",
--     "viewPreference": "plain" | "pretty" | "exciting" | "fun",
--     "layout": { "pinwheelSide": "left"|"right", "widgetSize": "...", "accent": "..." }
--   }

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Flag rows created by the synthetic-profile generator so they can be filtered
-- out of real analytics and purged easily.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN DEFAULT FALSE;

-- Optional: index for analytics queries filtering by a preference key.
CREATE INDEX IF NOT EXISTS idx_profiles_preferences ON public.profiles USING gin (preferences);
