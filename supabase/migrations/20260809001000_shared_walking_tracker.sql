-- This table is intentionally shared when the app is used without sign-in.
-- Anyone who has the site URL can read and modify this family log.
create table if not exists public.shared_walking_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null unique,
  minutes integer not null check (minutes between 1 and 600),
  feeling text check (feeling is null or feeling in ('مريح', 'مقبول', 'متعب')),
  note text check (note is null or char_length(note) <= 120),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shared_walking_settings (
  id smallint primary key default 1 check (id = 1),
  goal_minutes integer not null default 20 check (goal_minutes between 1 and 600),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.shared_walking_entries enable row level security;
alter table public.shared_walking_settings enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.shared_walking_entries to anon, authenticated;
grant select, insert, update, delete on table public.shared_walking_settings to anon, authenticated;

drop policy if exists "Anyone with the link can read shared walking entries" on public.shared_walking_entries;
drop policy if exists "Anyone with the link can create shared walking entries" on public.shared_walking_entries;
drop policy if exists "Anyone with the link can update shared walking entries" on public.shared_walking_entries;
drop policy if exists "Anyone with the link can delete shared walking entries" on public.shared_walking_entries;
create policy "Anyone with the link can read shared walking entries"
  on public.shared_walking_entries for select to anon, authenticated
  using (true);
create policy "Anyone with the link can create shared walking entries"
  on public.shared_walking_entries for insert to anon, authenticated
  with check (true);
create policy "Anyone with the link can update shared walking entries"
  on public.shared_walking_entries for update to anon, authenticated
  using (true)
  with check (true);
create policy "Anyone with the link can delete shared walking entries"
  on public.shared_walking_entries for delete to anon, authenticated
  using (true);

drop policy if exists "Anyone with the link can read shared walking settings" on public.shared_walking_settings;
drop policy if exists "Anyone with the link can create shared walking settings" on public.shared_walking_settings;
drop policy if exists "Anyone with the link can update shared walking settings" on public.shared_walking_settings;
create policy "Anyone with the link can read shared walking settings"
  on public.shared_walking_settings for select to anon, authenticated
  using (true);
create policy "Anyone with the link can create shared walking settings"
  on public.shared_walking_settings for insert to anon, authenticated
  with check (id = 1);
create policy "Anyone with the link can update shared walking settings"
  on public.shared_walking_settings for update to anon, authenticated
  using (true)
  with check (id = 1);

insert into public.shared_walking_settings (id, goal_minutes)
values (1, 20)
on conflict (id) do nothing;
