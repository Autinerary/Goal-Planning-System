-- STEP 104 — achievements (pull request #3, by SuperHal989): which achievements each person has earned, and when, so an
-- achievement stays earned (frontend/lib/achievements.ts; the server writes these with the service key, in
-- frontend/lib/server/achievements.ts, and /achievements reads them). Each person can read only their own; nobody can
-- write from the browser. Deleting an account deletes its rows.
--
-- Already in production: the table was made there on 30 October 2026, while the pull request was being written, with
-- the same columns, policy and grants. This file records it, changes nothing there, and is safe to run twice.
BEGIN;

CREATE TABLE IF NOT EXISTS public.achievement_unlocks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE public.achievement_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own achievement unlocks" ON public.achievement_unlocks;
CREATE POLICY "Users can read their own achievement unlocks"
  ON public.achievement_unlocks
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON public.achievement_unlocks FROM anon, authenticated;
GRANT SELECT ON public.achievement_unlocks TO authenticated;

COMMENT ON TABLE public.achievement_unlocks IS
  'STEP 104: the achievements each person has earned (frontend/lib/achievements.ts), and when. Written by the server only.';

COMMIT;

NOTIFY pgrst, 'reload schema';
