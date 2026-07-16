-- Private, optional condition and support details collected during onboarding.
-- This is self-reported personalization data, not a clinical diagnosis or score.

CREATE TABLE IF NOT EXISTS public.user_diagnostic_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_diagnostic_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own diagnostic profile" ON public.user_diagnostic_profiles;
DROP POLICY IF EXISTS "Users can insert own diagnostic profile" ON public.user_diagnostic_profiles;
DROP POLICY IF EXISTS "Users can update own diagnostic profile" ON public.user_diagnostic_profiles;
DROP POLICY IF EXISTS "Users can delete own diagnostic profile" ON public.user_diagnostic_profiles;

CREATE POLICY "Users can view own diagnostic profile"
  ON public.user_diagnostic_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagnostic profile"
  ON public.user_diagnostic_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own diagnostic profile"
  ON public.user_diagnostic_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own diagnostic profile"
  ON public.user_diagnostic_profiles FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_diagnostic_profiles_profile
  ON public.user_diagnostic_profiles USING gin (profile);
