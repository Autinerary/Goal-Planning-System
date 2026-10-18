-- =====================================================================
-- Who may run STEP 78's and 79's functions (STEP 80)
--
-- Supabase gives every new function in public to anon and authenticated
-- directly (its default privileges), so "REVOKE ALL ... FROM PUBLIC" in
-- STEPs 78 and 79 left them callable by anyone. For three of them that
-- matters: they write, bypassing row-level security, and take their date
-- and thresholds as arguments. Only the server (the service role, from the
-- monthly cron jobs) may run them now:
--
--   rating_sweep()          hides and restores services
--   choice_build_ballot()   makes a month's Community's Choice ballot
--   choice_tally()          saves and tags the winners
--
-- The others answer only for the signed-in caller, so they stay for signed-in
-- people and go for signed-out ones: can_rate(), rating_access(),
-- claim_prior_use(), choice_nominate(), is_spot_guide(),
-- spot_guide_batches(). choice_month() and choice_kind_of() stay public.
--
-- Run after STEP 79. Idempotent. Safe to re-run.
-- =====================================================================

REVOKE EXECUTE ON FUNCTION public.rating_sweep(BOOLEAN, TIMESTAMPTZ, INTEGER, NUMERIC, NUMERIC, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.choice_build_ballot(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.choice_tally(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rating_sweep(BOOLEAN, TIMESTAMPTZ, INTEGER, NUMERIC, NUMERIC, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.choice_build_ballot(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.choice_tally(TEXT, BOOLEAN) TO service_role;

REVOKE EXECUTE ON FUNCTION public.can_rate(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rating_access(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_prior_use(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.choice_nominate(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_spot_guide() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spot_guide_batches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_rate(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rating_access(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_prior_use(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.choice_nominate(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_spot_guide() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spot_guide_batches() TO authenticated;

-- Say what anon and authenticated can still run among them, to check.
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.proname, r.rolname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
    WHERE p.proname IN ('rating_sweep', 'choice_build_ballot', 'choice_tally')
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')
  LOOP
    RAISE WARNING '% can still run %: check it.', f.rolname, f.proname;
  END LOOP;
END $$;
