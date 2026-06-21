-- ============================================================================
-- Hare World — Phase A: Profiles + Facebook-style Friend Requests
-- ----------------------------------------------------------------------------
-- Run this in your Supabase SQL editor (project rvflowbufyhsdpugextz)
-- on the same database that auth.users lives in. Safe to re-run.
-- ----------------------------------------------------------------------------
-- This migration is idempotent. It does NOT drop social_connections — it
-- extends the RLS policies on it so the receiver of a request can accept/decline.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. public.profiles
-- ----------------------------------------------------------------------------
-- One row per auth.users entry. Auto-created by trigger on signup, plus
-- backfilled below. `discoverable` is opt-in (defaults FALSE) so users only
-- appear in /api/users/search after they explicitly turn it on.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  email         text,
  avatar_emoji  text not null default '👤',
  dream         text,
  discoverable  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- If an older version of public.profiles already exists, make sure every
-- column this migration relies on is present. Safe to run repeatedly.
alter table public.profiles
  add column if not exists display_name text;
alter table public.profiles
  add column if not exists email        text;
alter table public.profiles
  add column if not exists avatar_emoji text not null default '👤';
alter table public.profiles
  add column if not exists dream        text;
alter table public.profiles
  add column if not exists discoverable boolean not null default false;
alter table public.profiles
  add column if not exists created_at   timestamptz not null default now();
alter table public.profiles
  add column if not exists updated_at   timestamptz not null default now();

-- Case-insensitive name search; partial index on discoverable rows only
create index if not exists profiles_discoverable_name_idx
  on public.profiles (lower(display_name))
  where discoverable = true;

create index if not exists profiles_discoverable_email_idx
  on public.profiles (lower(email))
  where discoverable = true;

-- ----------------------------------------------------------------------------
-- 2. Touch trigger for updated_at
-- ----------------------------------------------------------------------------
create or replace function public.touch_profiles()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_profiles on public.profiles;
create trigger trg_touch_profiles
  before update on public.profiles
  for each row execute function public.touch_profiles();

-- ----------------------------------------------------------------------------
-- 3. Auto-create profile row on signup
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 4. Backfill profiles for existing users
-- ----------------------------------------------------------------------------
insert into public.profiles (id, display_name, email)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  u.email
from auth.users u
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. RLS on public.profiles
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- A profile is visible if EITHER:
--   (a) it's mine, or
--   (b) it's marked discoverable (so search/typeahead can find it), or
--   (c) we already have a connected friendship in either direction
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read"
  on public.profiles
  for select
  using (
    id = auth.uid()
    or discoverable = true
    or exists (
      select 1 from public.social_connections sc
      where sc.status = 'connected'
        and (
          (sc.owner_id = auth.uid() and sc.target_user_id = profiles.id)
          or (sc.target_user_id = auth.uid() and sc.owner_id = profiles.id)
        )
    )
  );

-- Only owner can update their own profile
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Insert is normally done by the trigger above, but allow the owner to
-- self-insert in case the trigger is missed (e.g. seed scripts).
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. Extend social_connections RLS so the RECEIVER of a request can
--    see + accept it (the existing policies only allowed owner_id = auth.uid()).
-- ----------------------------------------------------------------------------
-- Defensive: if an older social_connections table is in place, make sure the
-- columns the policies below reference actually exist.
alter table public.social_connections
  add column if not exists target_user_id uuid references auth.users(id) on delete set null;
alter table public.social_connections
  add column if not exists status text not null default 'pending';

-- Drop and re-create the SELECT policy with the broader rule
drop policy if exists "Users can read their own connections" on public.social_connections;
create policy "Users can read their own connections"
  on public.social_connections
  for select
  using (
    auth.uid() = owner_id
    or auth.uid() = target_user_id
  );

-- Allow the receiver to UPDATE the row when accepting (status -> 'connected')
-- The existing owner-update policy stays as-is; we add a second one for receivers.
drop policy if exists "Receivers can accept their pending requests" on public.social_connections;
create policy "Receivers can accept their pending requests"
  on public.social_connections
  for update
  using (auth.uid() = target_user_id and status = 'pending')
  with check (auth.uid() = target_user_id and status in ('pending', 'connected'));

-- Allow the receiver to DELETE the row when declining
drop policy if exists "Receivers can decline their pending requests" on public.social_connections;
create policy "Receivers can decline their pending requests"
  on public.social_connections
  for delete
  using (auth.uid() = target_user_id);
