-- 'Real' Pitch Event schema (fresh install).
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- WARNING: re-running it drops all data. To upgrade an existing install, use supabase/migrations/ instead.

drop function if exists reset_event(jsonb, jsonb);
drop function if exists import_roster(jsonb, jsonb);
drop function if exists delete_roster(uuid[], uuid[]);
drop table if exists votes, teams, time_slots, investors, settings cascade;

create table settings (
  id int primary key default 1 check (id = 1),
  current_team_id uuid,                                -- "now presenting" team
  roster_updated_at timestamptz not null default now() -- bumped on import/delete so clients reload
);
insert into settings (id) values (1);

-- One team per time slot. Date + slot are just "when they presented".
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slot_date text,   -- e.g. "10/28" (shown to admin only)
  slot text,        -- e.g. "10:00"
  description text, -- one-liner
  members text,     -- e.g. "Alice Wu, Ben Ortiz" (shown as entered)
  created_at timestamptz not null default now()
);
create unique index teams_name_lower_key on teams (lower(name));

create table investors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index investors_name_lower_key on investors (lower(name));

create table votes (
  investor_id uuid not null references investors (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (investor_id, team_id)   -- one thumb per investor per team
);
-- So realtime DELETE events carry investor_id + team_id
alter table votes replica identity full;

-- Security is intentionally open (per requirements): anyone with the anon key can read/write.
alter table settings enable row level security;
alter table teams enable row level security;
alter table investors enable row level security;
alter table votes enable row level security;
create policy "open" on settings for all using (true) with check (true);
create policy "open" on teams for all using (true) with check (true);
create policy "open" on investors for all using (true) with check (true);
create policy "open" on votes for all using (true) with check (true);

-- Realtime: clients listen to votes (live counts) and settings (current team + roster reloads).
alter publication supabase_realtime add table votes, settings;

-- Add/update teams and investors from the admin's CSV upload. Nothing is wiped:
--   * team with the same name (case-insensitive) -> its date/slot/description/members are replaced, votes kept
--   * investor with the same name (case-insensitive) -> ignored, so their votes/stats are kept
-- p_teams:     [{ "name": "...", "date": "10/28", "slot": "10:00", "description": "...", "members": "..." }, ...]
-- p_investors: [{ "name": "..." }, ...]
create or replace function import_roster(p_teams jsonb, p_investors jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  nm text;
  existing uuid;
  teams_added int := 0;
  teams_updated int := 0;
  investors_added int := 0;
  investors_skipped int := 0;
begin
  for r in select * from jsonb_array_elements(coalesce(p_teams, '[]'::jsonb)) loop
    nm := trim(r ->> 'name');
    continue when coalesce(nm, '') = '';
    select id into existing from teams where lower(name) = lower(nm);
    if found then
      update teams
      set name = nm,
          slot_date = nullif(trim(r ->> 'date'), ''),
          slot = nullif(trim(r ->> 'slot'), ''),
          description = nullif(trim(r ->> 'description'), ''),
          members = nullif(trim(r ->> 'members'), '')
      where id = existing;
      teams_updated := teams_updated + 1;
    else
      insert into teams (name, slot_date, slot, description, members)
      values (
        nm,
        nullif(trim(r ->> 'date'), ''),
        nullif(trim(r ->> 'slot'), ''),
        nullif(trim(r ->> 'description'), ''),
        nullif(trim(r ->> 'members'), '')
      );
      teams_added := teams_added + 1;
    end if;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_investors, '[]'::jsonb)) loop
    nm := trim(r ->> 'name');
    continue when coalesce(nm, '') = '';
    if exists (select 1 from investors where lower(name) = lower(nm)) then
      investors_skipped := investors_skipped + 1;
    else
      insert into investors (name) values (nm);
      investors_added := investors_added + 1;
    end if;
  end loop;

  -- Tells every open client to reload the roster
  update settings set roster_updated_at = now() where id = 1;

  return jsonb_build_object(
    'teams_added', teams_added, 'teams_updated', teams_updated,
    'investors_added', investors_added, 'investors_skipped', investors_skipped
  );
end;
$$;

-- Delete teams and/or investors (and their votes), e.g. old sections or dummy data.
create or replace function delete_roster(p_team_ids uuid[], p_investor_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  p_team_ids := coalesce(p_team_ids, '{}');
  p_investor_ids := coalesce(p_investor_ids, '{}');
  delete from votes where team_id = any (p_team_ids) or investor_id = any (p_investor_ids);
  delete from teams where id = any (p_team_ids);
  delete from investors where id = any (p_investor_ids);
  update settings
  set current_team_id = case when current_team_id = any (p_team_ids) then null else current_team_id end,
      roster_updated_at = now()
  where id = 1;
end;
$$;

grant execute on function import_roster(jsonb, jsonb) to anon, authenticated;
grant execute on function delete_roster(uuid[], uuid[]) to anon, authenticated;
