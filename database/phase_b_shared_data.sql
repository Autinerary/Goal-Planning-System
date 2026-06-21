-- ============================================================================
-- Phase B — Shared pathway data (path summary, calendar tasks, race progress,
-- service suggestions). Run this in the Supabase SQL editor for project
-- rvflowbufyhsdpugextz AFTER profiles_and_friends.sql.
--
-- Safe to re-run (all CREATE/POLICY/INDEX statements are idempotent).
--
-- What this enables:
--   - The Next.js app can read/write the multi-agent path payload directly
--     from Supabase (no FastAPI dependency for read).
--   - Calendar tasks the user adds via /calendar are saved to Supabase.
--   - Milestone-completion state from /races is saved to Supabase.
--   - Users can SUGGEST a resource (URL + note) to a connected friend.
--   - A connected friend can READ all of the above for their friend, which is
--     what powers /friend/[id] and /compare/[id].
--
-- Friend visibility is enforced in two ways:
--   1. RLS policies join against public.social_connections and require status
--      = 'connected' (matched is also treated as connected for read access).
--   2. The API layer additionally verifies the connection before issuing
--      friend-scoped fetches.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helper: is the viewer connected to a given owner?
-- Returns true when an accepted social_connections row exists in either
-- direction (owner_id=viewer & target_user_id=target, or vice versa) with
-- status in ('connected', 'matched').
-- SECURITY DEFINER so it can read social_connections even with RLS on the
-- caller side; locked down to authenticated role only.
-- ----------------------------------------------------------------------------

create or replace function public.is_connected_to(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.social_connections sc
    where sc.status in ('connected', 'matched')
      and (
        (sc.owner_id = auth.uid() and sc.target_user_id = target_user)
        or
        (sc.target_user_id = auth.uid() and sc.owner_id = target_user)
      )
  );
$$;

revoke all on function public.is_connected_to(uuid) from public;
grant execute on function public.is_connected_to(uuid) to authenticated;

-- ============================================================================
-- 1. user_paths — expand RLS so the path owner AND connected friends can READ,
--    and the path owner can write.
-- ============================================================================

-- (table already exists from database/user_paths.sql; do not recreate)
alter table public.user_paths enable row level security;

drop policy if exists "Owner can read own path" on public.user_paths;
create policy "Owner can read own path"
  on public.user_paths
  for select
  using (auth.uid() = user_id);

drop policy if exists "Friends can read connected path" on public.user_paths;
create policy "Friends can read connected path"
  on public.user_paths
  for select
  using (public.is_connected_to(user_id));

drop policy if exists "Owner can insert own path" on public.user_paths;
create policy "Owner can insert own path"
  on public.user_paths
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owner can update own path" on public.user_paths;
create policy "Owner can update own path"
  on public.user_paths
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- 2. calendar_tasks — tasks the user added to their calendar
-- ============================================================================

create table if not exists public.calendar_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- client-supplied stable id for de-dupe (e.g. 'suggestion_169...' or scenario task id)
  client_id    text not null,
  day          text not null,
  time         text not null,
  name         text not null,
  duration     text default '30 min' not null,
  priority     text default 'medium' not null,
  source       text,            -- e.g. friend name or feature that suggested it
  scenario     text,            -- 'worst' | 'average' | 'best' | null
  completed    boolean default false not null,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, client_id)
);

create index if not exists calendar_tasks_user_day_idx
  on public.calendar_tasks (user_id, day);

alter table public.calendar_tasks enable row level security;

drop policy if exists "Owner can read own calendar" on public.calendar_tasks;
create policy "Owner can read own calendar"
  on public.calendar_tasks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Friends can read connected calendar" on public.calendar_tasks;
create policy "Friends can read connected calendar"
  on public.calendar_tasks
  for select
  using (public.is_connected_to(user_id));

drop policy if exists "Owner can insert own calendar" on public.calendar_tasks;
create policy "Owner can insert own calendar"
  on public.calendar_tasks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owner can update own calendar" on public.calendar_tasks;
create policy "Owner can update own calendar"
  on public.calendar_tasks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owner can delete own calendar" on public.calendar_tasks;
create policy "Owner can delete own calendar"
  on public.calendar_tasks
  for delete
  using (auth.uid() = user_id);

create or replace function public.touch_calendar_tasks()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_calendar_tasks on public.calendar_tasks;
create trigger trg_touch_calendar_tasks
  before update on public.calendar_tasks
  for each row execute function public.touch_calendar_tasks();

-- ============================================================================
-- 3. race_progress — completed milestones (and hearted goals)
-- ============================================================================

create table if not exists public.race_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  milestone_id text not null,
  kind         text not null default 'completed' check (kind in ('completed', 'hearted')),
  completed_at timestamptz not null default now(),
  primary key (user_id, milestone_id, kind)
);

create index if not exists race_progress_user_idx
  on public.race_progress (user_id, kind);

alter table public.race_progress enable row level security;

drop policy if exists "Owner can read own progress" on public.race_progress;
create policy "Owner can read own progress"
  on public.race_progress
  for select
  using (auth.uid() = user_id);

drop policy if exists "Friends can read connected progress" on public.race_progress;
create policy "Friends can read connected progress"
  on public.race_progress
  for select
  using (public.is_connected_to(user_id));

drop policy if exists "Owner can insert own progress" on public.race_progress;
create policy "Owner can insert own progress"
  on public.race_progress
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owner can delete own progress" on public.race_progress;
create policy "Owner can delete own progress"
  on public.race_progress
  for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- 4. service_suggestions — me → friend resource recommendations
-- ============================================================================

create table if not exists public.service_suggestions (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null references auth.users(id) on delete cascade,
  to_user_id    uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  url           text,
  description   text,
  note          text,           -- why I'm suggesting it
  status        text not null default 'pending' check (status in ('pending', 'viewed', 'accepted', 'dismissed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists service_suggestions_to_idx
  on public.service_suggestions (to_user_id, status, created_at desc);

create index if not exists service_suggestions_from_idx
  on public.service_suggestions (from_user_id, created_at desc);

alter table public.service_suggestions enable row level security;

-- Both sender and receiver can see the suggestion
drop policy if exists "Sender or receiver can read suggestions" on public.service_suggestions;
create policy "Sender or receiver can read suggestions"
  on public.service_suggestions
  for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- Sender can create only if they are connected to the receiver
drop policy if exists "Sender can create when connected" on public.service_suggestions;
create policy "Sender can create when connected"
  on public.service_suggestions
  for insert
  with check (
    auth.uid() = from_user_id
    and public.is_connected_to(to_user_id)
  );

-- Receiver can update status (viewed/accepted/dismissed)
drop policy if exists "Receiver can update status" on public.service_suggestions;
create policy "Receiver can update status"
  on public.service_suggestions
  for update
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

-- Sender can delete a suggestion they sent
drop policy if exists "Sender can delete own suggestion" on public.service_suggestions;
create policy "Sender can delete own suggestion"
  on public.service_suggestions
  for delete
  using (auth.uid() = from_user_id);

create or replace function public.touch_service_suggestions()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_service_suggestions on public.service_suggestions;
create trigger trg_touch_service_suggestions
  before update on public.service_suggestions
  for each row execute function public.touch_service_suggestions();
