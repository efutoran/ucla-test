-- Tracks approximate unique investors watching each team's presentation. Keeps all data.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run (after 002).

begin;

-- Who had the app open while each team was presenting (one row per investor per team).
-- Written by investors' phones; the admin Results tab shows the count as "~N watching".
create table audience (
  team_id uuid not null references teams (id) on delete cascade,
  investor_id uuid not null references investors (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (team_id, investor_id)
);
alter table audience enable row level security;
create policy "open" on audience for all using (true) with check (true);

commit;
