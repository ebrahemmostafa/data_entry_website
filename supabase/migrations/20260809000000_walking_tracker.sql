create table if not exists public.walking_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  minutes integer not null check (minutes between 1 and 600),
  feeling text check (feeling is null or feeling in ('مريح', 'مقبول', 'متعب')),
  note text check (note is null or char_length(note) <= 120),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, entry_date)
);

create table if not exists public.walking_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  goal_minutes integer not null default 20 check (goal_minutes between 1 and 600),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.walking_entries enable row level security;
alter table public.walking_settings enable row level security;

revoke all on table public.walking_entries from anon;
revoke all on table public.walking_settings from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.walking_entries to authenticated;
grant select, insert, update, delete on table public.walking_settings to authenticated;

drop policy if exists "Users can read their walking entries" on public.walking_entries;
drop policy if exists "Users can create their walking entries" on public.walking_entries;
drop policy if exists "Users can update their walking entries" on public.walking_entries;
drop policy if exists "Users can delete their walking entries" on public.walking_entries;
create policy "Users can read their walking entries"
  on public.walking_entries for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Users can create their walking entries"
  on public.walking_entries for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Users can update their walking entries"
  on public.walking_entries for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Users can delete their walking entries"
  on public.walking_entries for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Users can read their walking settings" on public.walking_settings;
drop policy if exists "Users can create their walking settings" on public.walking_settings;
drop policy if exists "Users can update their walking settings" on public.walking_settings;
create policy "Users can read their walking settings"
  on public.walking_settings for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Users can create their walking settings"
  on public.walking_settings for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Users can update their walking settings"
  on public.walking_settings for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
