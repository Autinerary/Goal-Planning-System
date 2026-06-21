-- =====================================================================
-- Life Stats — backing tables for Mentality / Happiness / Focus / Energy
--
-- - life_stats_checkins:  optional daily mood self-report (1..10)
-- - life_stats_snapshots: one row per user per day; powers trend arrows
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

-- -------------------------------------------------------------------
-- 1. Daily mood self-report (drives Happiness when present)
-- -------------------------------------------------------------------
create table if not exists public.life_stats_checkins (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  checkin_date date        not null default current_date,
  mood         smallint    not null check (mood between 1 and 10),
  note         text,
  created_at   timestamptz not null default now(),
  primary key (user_id, checkin_date)
);

create index if not exists life_stats_checkins_user_date_desc
  on public.life_stats_checkins (user_id, checkin_date desc);

-- -------------------------------------------------------------------
-- 2. Daily snapshot (powers "+X% from last week" trend arrows)
--
-- Values are stored as 0..100 so we can render them at any fidelity
-- (the UI divides by 10 for "X/10").
-- -------------------------------------------------------------------
create table if not exists public.life_stats_snapshots (
  user_id         uuid        not null references auth.users(id) on delete cascade,
  snapshot_date   date        not null default current_date,
  mentality       smallint    not null check (mentality between 0 and 100),
  happiness       smallint    not null check (happiness between 0 and 100),
  focus           smallint    not null check (focus     between 0 and 100),
  energy          smallint    not null check (energy    between 0 and 100),
  -- Source of the happiness number: 'checkin' = user-reported, 'inferred' = derived.
  happiness_source text not null default 'inferred'
    check (happiness_source in ('checkin', 'inferred')),
  computed_at     timestamptz not null default now(),
  primary key (user_id, snapshot_date)
);

create index if not exists life_stats_snapshots_user_date_desc
  on public.life_stats_snapshots (user_id, snapshot_date desc);

-- -------------------------------------------------------------------
-- 3. Row-level security
--
-- Users can only read/write their own check-ins and snapshots.
-- The cron endpoint uses the service role key so it bypasses RLS.
-- -------------------------------------------------------------------
alter table public.life_stats_checkins  enable row level security;
alter table public.life_stats_snapshots enable row level security;

drop policy if exists "own_checkins_select" on public.life_stats_checkins;
create policy "own_checkins_select"
  on public.life_stats_checkins for select
  using (auth.uid() = user_id);

drop policy if exists "own_checkins_modify" on public.life_stats_checkins;
create policy "own_checkins_modify"
  on public.life_stats_checkins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own_snapshots_select" on public.life_stats_snapshots;
create policy "own_snapshots_select"
  on public.life_stats_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "own_snapshots_modify" on public.life_stats_snapshots;
create policy "own_snapshots_modify"
  on public.life_stats_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
