-- =====================================================================
-- Ideal Self — AI-generated portrait of the user's "Dream Self"
--
-- One row per user. Stores the public URL of the generated portrait
-- (uploaded to the shared `resource-images` Storage bucket) plus the
-- prompt/style used so the user can regenerate on demand.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.ideal_self_portraits (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  -- Public URL of the portrait in Supabase Storage. May also hold a data URL
  -- as a last-resort fallback if the Storage upload failed.
  image_url   text        not null,
  -- Storage path (bucket-relative) so a regenerate can overwrite/clean up.
  image_path  text,
  -- The exact prompt sent to the image model + a short style label.
  prompt      text,
  style       text        not null default 'painterly',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.ideal_self_portraits enable row level security;

-- Owner-only access. Service-role bypasses RLS as always.
drop policy if exists ideal_self_owner_select on public.ideal_self_portraits;
create policy ideal_self_owner_select on public.ideal_self_portraits
  for select using (auth.uid() = user_id);

drop policy if exists ideal_self_owner_insert on public.ideal_self_portraits;
create policy ideal_self_owner_insert on public.ideal_self_portraits
  for insert with check (auth.uid() = user_id);

drop policy if exists ideal_self_owner_update on public.ideal_self_portraits;
create policy ideal_self_owner_update on public.ideal_self_portraits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ideal_self_owner_delete on public.ideal_self_portraits;
create policy ideal_self_owner_delete on public.ideal_self_portraits
  for delete using (auth.uid() = user_id);

-- Bump updated_at on every change.
create or replace function public._ideal_self_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ideal_self_touch on public.ideal_self_portraits;
create trigger ideal_self_touch
before update on public.ideal_self_portraits
for each row execute function public._ideal_self_touch_updated_at();

comment on table public.ideal_self_portraits is
  'AI-generated "Dream Self" portrait per user. image_url points at the resource-images Storage bucket.';
