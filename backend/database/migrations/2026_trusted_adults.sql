-- =====================================================================
-- Trusted adults approve a teen's account (STEP 84)
--
-- The team's note, October 2026: "Have trusted legal adult who HAS AN
-- ACCOUNT be able to sign in, review info, and approve account. We need to
-- add this as a paid feature."
--
-- Until now a parent or legal guardian could add a child from their own
-- account (STEP 06's guardianships, app/api/family/children), and someone
-- under 18 who tried to sign up was turned away. With this, a teen can ask a
-- trusted adult instead: the account is made locked, the adult (who must
-- already have an adult account) signs in, reviews it and approves or
-- declines. Approving links them as STEP 06's guardianship does and unlocks
-- the account. It is used only once the team turns it on
-- (NEXT_PUBLIC_TEEN_REQUESTS); when paid plans are on, approving is part of
-- one.
--
-- Requests are read by the teen and the adult they asked, and written only
-- by the server, which checks ages and the adult's answers.
--
-- Run after STEP 83. Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.guardian_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adult_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  relationship TEXT CHECK (relationship IS NULL OR relationship IN ('parent', 'legal_guardian')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  CHECK (child_id <> adult_id),
  CHECK ((status = 'pending') = (decided_at IS NULL)),
  CHECK (status <> 'approved' OR relationship IS NOT NULL)
);

-- One open or settled request per teen: a new one replaces a declined one.
CREATE UNIQUE INDEX IF NOT EXISTS guardian_requests_one_per_child ON public.guardian_requests (child_id);
CREATE INDEX IF NOT EXISTS guardian_requests_adult_idx ON public.guardian_requests (adult_id, status);

ALTER TABLE public.guardian_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guardian_requests_read_own ON public.guardian_requests;
CREATE POLICY guardian_requests_read_own ON public.guardian_requests
  FOR SELECT TO authenticated USING (auth.uid() = child_id OR auth.uid() = adult_id);
REVOKE ALL ON public.guardian_requests FROM anon, authenticated;
GRANT SELECT ON public.guardian_requests TO authenticated;

COMMENT ON TABLE public.guardian_requests IS
  'A teen asking a trusted adult to approve their account (STEP 84): the teen and that adult can read it; the server writes it after checking ages and the adult''s answers.';
