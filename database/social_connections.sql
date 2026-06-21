-- ============================================================================
-- Hare World — Social Connections
-- ----------------------------------------------------------------------------
-- Stores the user's people: Role Models, Mentors, Friends (and Matched).
-- Run this once in your Supabase SQL editor (project rvflowbufyhsdpugextz)
-- on the same database that auth.users lives in.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.social_connections (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  -- friends | mentors | rolemodels  (kept as text so we don't need an enum migration later)
  category     text not null check (category in ('friends', 'mentors', 'rolemodels')),
  name         text not null,
  role         text default '' not null,
  status       text not null default 'pending' check (status in ('pending', 'connected', 'matched')),
  icon         text default '👤' not null,
  -- Optional: the auth.users.id of the other person, if this connection was
  -- requested against a real account. Null for free-form / manually added rows.
  target_user_id uuid references auth.users(id) on delete set null,
  -- For matched profiles we keep the dream/interest text the match was based on
  match_dream  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists social_connections_owner_idx
  on public.social_connections(owner_id, category, created_at desc);

create index if not exists social_connections_target_idx
  on public.social_connections(target_user_id)
  where target_user_id is not null;

-- Row Level Security so each user sees only their own list
alter table public.social_connections enable row level security;

drop policy if exists "Users can read their own connections" on public.social_connections;
create policy "Users can read their own connections"
  on public.social_connections
  for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can insert their own connections" on public.social_connections;
create policy "Users can insert their own connections"
  on public.social_connections
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own connections" on public.social_connections;
create policy "Users can update their own connections"
  on public.social_connections
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their own connections" on public.social_connections;
create policy "Users can delete their own connections"
  on public.social_connections
  for delete
  using (auth.uid() = owner_id);

-- Keep updated_at fresh
create or replace function public.touch_social_connections()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_social_connections on public.social_connections;
create trigger trg_touch_social_connections
  before update on public.social_connections
  for each row execute function public.touch_social_connections();
