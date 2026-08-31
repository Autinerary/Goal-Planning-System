-- ============================================================================
-- Peer vouching (Odosa).
--
-- "Allowing 'undiagnosed' / 'ally' ratings — Weighting system needed, to
-- prioritize those who ARE members vs direct support structures vs indirect
-- vs allies. IS it done"
--
-- The weighting itself was done: lived 1.00 / direct support 0.60 /
-- professional 0.35 / ally 0.15, applied to resource ratings and community
-- answers. The gap was verification_method='peer'. It has been in the CHECK
-- constraint and has had a full UI badge — "Other members who share this norm
-- have vouched for this person" — since 2026_professional_verification.sql,
-- but nothing in the codebase ever wrote it, so the badge could never appear.
-- This is the ledger that makes it real.
--
-- Why a ledger and not a counter column: a single vouch is weak, so the badge
-- needs a threshold of DISTINCT vouchers; vouches must be revocable, and the
-- count has to stay correct when one is withdrawn; and if a cluster of
-- accounts ever starts vouching for each other, we need to be able to see who.
--
-- Stores no diagnosis, no document and no free text — the same rule as
-- organisation vouching. There is nowhere to put forgeable evidence, which is
-- how the AI-edited-document problem stays out of the design rather than
-- being defended against. Only WHO vouched, for WHOM, on WHICH norm.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.peer_vouches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vouchee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  barrier_type TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One vouch per person per norm. Re-vouching must not inflate the count.
  CONSTRAINT peer_vouches_unique UNIQUE (voucher_id, vouchee_id, barrier_type),
  -- Self-vouching would make the whole mechanism meaningless. Enforced here
  -- as well as in the API so it holds even if a future code path forgets.
  CONSTRAINT peer_vouches_not_self CHECK (voucher_id <> vouchee_id)
);

CREATE INDEX IF NOT EXISTS peer_vouches_vouchee_idx
  ON public.peer_vouches (vouchee_id, barrier_type);
CREATE INDEX IF NOT EXISTS peer_vouches_voucher_idx
  ON public.peer_vouches (voucher_id);

ALTER TABLE public.peer_vouches ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can see that a vouch exists (the badge is public), but only
-- the voucher can create or withdraw their own — nobody can remove someone
-- else's vouch.
DROP POLICY IF EXISTS peer_vouches_read ON public.peer_vouches;
CREATE POLICY peer_vouches_read ON public.peer_vouches
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS peer_vouches_write ON public.peer_vouches;
CREATE POLICY peer_vouches_write ON public.peer_vouches
  FOR ALL USING (voucher_id = auth.uid()) WITH CHECK (voucher_id = auth.uid());

COMMENT ON TABLE public.peer_vouches IS
  'Members with lived experience of a norm vouching that another member shares it. No diagnosis, no documents — only who, for whom, on which norm.';

COMMIT;
