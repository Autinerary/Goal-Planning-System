-- Commitment: a fifth Life Stat.
--
-- Nullable, unlike the other four. Commitment measures whether someone keeps
-- coming back over weeks, so it cannot be computed at all until an account has
-- enough history — and a new user must not be shown "Commitment 0/10" for the
-- crime of having just signed up. NULL means "not enough history yet", which
-- is a different statement from a low score.

BEGIN;

ALTER TABLE public.life_stats_snapshots
  ADD COLUMN IF NOT EXISTS commitment smallint
    CHECK (commitment IS NULL OR commitment BETWEEN 0 AND 100);

COMMENT ON COLUMN public.life_stats_snapshots.commitment IS
  'Consistency over a 28-day window. NULL when the account is too new to judge — not the same as a score of 0.';

COMMIT;
