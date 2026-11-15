create table if not exists public.achievement_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.achievement_unlocks enable row level security;

drop policy if exists "Users can read their own achievement unlocks" on public.achievement_unlocks;
create policy "Users can read their own achievement unlocks"
  on public.achievement_unlocks
  for select
  using (auth.uid() = user_id);

revoke all on public.achievement_unlocks from anon, authenticated;
grant select on public.achievement_unlocks to authenticated;

drop function if exists public.refresh_friend_achievements();
drop function if exists public.record_halloween_login();
