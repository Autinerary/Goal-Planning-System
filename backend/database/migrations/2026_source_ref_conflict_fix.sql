-- =====================================================================
-- Fix: resources.source_ref could never actually be used as an upsert
-- conflict target
--
-- STEP 39 added a UNIQUE INDEX on source_ref, but made it PARTIAL:
--   CREATE UNIQUE INDEX ... ON resources (source_ref)
--     WHERE source_ref IS NOT NULL;
--
-- Postgres can only use a partial unique index for ON CONFLICT
-- inference when the INSERT statement's own ON CONFLICT clause repeats
-- that exact WHERE predicate. Supabase's JS client -- and PostgREST's
-- upsert() in general -- issues ON CONFLICT with a bare column list and
-- has no way to also supply a predicate, so it could never match this
-- index. The result: every venue-import upsert batch failed with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification", and a real run over 20 cities found 9,620 usable
-- OpenStreetMap venues and wrote zero of them.
--
-- The partial predicate was never actually necessary. Standard SQL
-- uniqueness semantics already treat NULL as distinct from every other
-- NULL, so a PLAIN (non-partial) UNIQUE constraint on a nullable column
-- already allows unlimited rows with source_ref = NULL -- which is
-- every resource that was not imported from an external source. That
-- was the entire reason the index was made partial in the first place,
-- and it was redundant.
--
-- This drops the unusable partial index and replaces it with a real
-- UNIQUE constraint carrying the same name, so it is now a valid
-- inference target for ON CONFLICT (source_ref).
--
-- Idempotent from EITHER starting state: a bare partial index (never
-- run before) or an existing real constraint (already run once). See
-- the note below on why the order of the two DROPs matters -- getting
-- it backwards is what broke re-running this file at all.
-- =====================================================================

-- Constraint first, index second. A UNIQUE constraint is backed by an
-- index of the SAME NAME, and Postgres refuses `DROP INDEX` on an index
-- a constraint owns -- "cannot drop index ... because constraint ...
-- requires it, HINT: drop the constraint instead". That is exactly what
-- running this file a second time hit: the first run had already turned
-- resources_source_ref_key from a bare index into a real constraint, so
-- the DROP INDEX line that worked the first time failed the second.
-- Dropping the constraint first removes its backing index automatically,
-- so this now succeeds whichever shape the object is currently in --
-- and the second line's IF EXISTS makes it a no-op the rest of the time.
ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_source_ref_key;

DROP INDEX IF EXISTS public.resources_source_ref_key;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_source_ref_key UNIQUE (source_ref);

COMMENT ON CONSTRAINT resources_source_ref_key ON public.resources IS
  'Real unique constraint, not a partial index -- PostgREST upsert(onConflict: "source_ref") can only target a plain constraint, and NULL source_ref values already do not collide with each other under normal SQL semantics, so no partial predicate was needed.';
