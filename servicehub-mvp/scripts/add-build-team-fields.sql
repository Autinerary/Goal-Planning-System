-- =====================================================================
-- Build-A-Team progress tracking on saved_resources.
--
-- Adds three optional columns used by the "Build a Team" view inside
-- /my-resources:
--   - calls_scheduled  — has the user scheduled an intro/intake call?
--   - contract_sent    — has the user sent a contract / signup request?
--   - added_to_team_at — timestamp the user promoted the resource from
--                        wishlist -> "current" (team).
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

alter table public.saved_resources
  add column if not exists calls_scheduled  boolean not null default false;

alter table public.saved_resources
  add column if not exists contract_sent    boolean not null default false;

alter table public.saved_resources
  add column if not exists added_to_team_at timestamptz;

-- Backfill added_to_team_at for any rows already in 'current' status that
-- predate this migration so the Team tab can show "added on" dates without
-- nulls.
update public.saved_resources
   set added_to_team_at = coalesce(added_to_team_at, created_at)
 where status = 'current'
   and added_to_team_at is null;

create index if not exists saved_resources_user_status_idx
  on public.saved_resources (user_id, status);
