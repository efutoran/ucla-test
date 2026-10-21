-- Demo Day Voting schema.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: it drops and recreates everything.

drop function if exists reset_event(jsonb, jsonb);
drop table if exists votes, teams, time_slots, investors, settings cascade;

create table settings (
  id int primary key default 1 check (id = 1),
  current_slot_id uuid,              -- "now presenting" slot (no FK so TRUNCATE doesn't touch this table)
  reset_at timestamptz not null default now()
);
insert into settings (id) values (1);

create table time_slots (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  sort_order int not null
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slot_id uuid not null references time_slots (id),
  description text,
  sort_order int not null
);

create table investors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null
);

create table votes (
  investor_id uuid not null references investors (id),
  team_id uuid not null references teams (id),
  created_at timestamptz not null default now(),
  primary key (investor_id, team_id)   -- one thumb per investor per team
);
-- So realtime DELETE events carry investor_id + team_id
alter table votes replica identity full;

-- Security is intentionally open (per requirements): anyone with the anon key can read/write.
alter table settings enable row level security;
alter table time_slots enable row level security;
alter table teams enable row level security;
alter table investors enable row level security;
alter table votes enable row level security;
create policy "open" on settings for all using (true) with check (true);
create policy "open" on time_slots for all using (true) with check (true);
create policy "open" on teams for all using (true) with check (true);
create policy "open" on investors for all using (true) with check (true);
create policy "open" on votes for all using (true) with check (true);

-- Realtime: clients listen to votes (live counts) and settings (current slot + reset signal).
alter publication supabase_realtime add table votes, settings;

-- Wipe everything and load a fresh roster. Called by the admin page on CSV upload.
-- p_teams:     [{ "name": "...", "slot": "...", "description": "..." }, ...]
-- p_investors: [{ "name": "..." }, ...]
create or replace function reset_event(p_teams jsonb, p_investors jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- TRUNCATE (not DELETE) so thousands of vote deletions aren't broadcast over realtime
  truncate votes, teams, time_slots, investors;

  insert into time_slots (label, sort_order)
  select slot, min(ord)::int
  from (
    select coalesce(nullif(trim(t ->> 'slot'), ''), 'Unscheduled') as slot, ord
    from jsonb_array_elements(p_teams) with ordinality as x (t, ord)
  ) s
  group by slot;

  insert into teams (name, slot_id, description, sort_order)
  select trim(t ->> 'name'), ts.id, nullif(trim(t ->> 'description'), ''), ord::int
  from jsonb_array_elements(p_teams) with ordinality as x (t, ord)
  join time_slots ts on ts.label = coalesce(nullif(trim(t ->> 'slot'), ''), 'Unscheduled')
  where coalesce(trim(t ->> 'name'), '') <> '';

  insert into investors (name, sort_order)
  select name, min(ord)::int
  from (
    select trim(i ->> 'name') as name, ord
    from jsonb_array_elements(p_investors) with ordinality as x (i, ord)
  ) s
  where name <> ''
  group by name;

  -- Bumping reset_at tells every open client to reload
  update settings set current_slot_id = null, reset_at = now() where id = 1;
end;
$$;

grant execute on function reset_event(jsonb, jsonb) to anon, authenticated;
