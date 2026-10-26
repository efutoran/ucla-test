-- Upgrade an existing install (created from the original schema.sql) to the
-- add/update roster model. Keeps all teams, investors and votes.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

begin;

-- Teams carry their own date + slot; the separate time_slots table goes away
alter table teams add column if not exists slot_date text;
alter table teams add column if not exists slot text;
alter table teams add column if not exists created_at timestamptz not null default now();
update teams t set slot = s.label from time_slots s where s.id = t.slot_id and t.slot is null;
alter table teams drop column if exists slot_id;
alter table teams drop column if exists sort_order;
drop table if exists time_slots;
create unique index if not exists teams_name_lower_key on teams (lower(name));

alter table investors add column if not exists created_at timestamptz not null default now();
alter table investors drop column if exists sort_order;
alter table investors drop constraint if exists investors_name_key;
create unique index if not exists investors_name_lower_key on investors (lower(name));

alter table votes drop constraint if exists votes_investor_id_fkey;
alter table votes drop constraint if exists votes_team_id_fkey;
alter table votes add constraint votes_investor_id_fkey foreign key (investor_id) references investors (id) on delete cascade;
alter table votes add constraint votes_team_id_fkey foreign key (team_id) references teams (id) on delete cascade;

-- "Now presenting" is a team, not a slot
alter table settings add column if not exists current_team_id uuid;
alter table settings drop column if exists current_slot_id;
alter table settings rename column reset_at to roster_updated_at;

drop function if exists reset_event(jsonb, jsonb);

-- Add/update teams and investors from the admin's CSV upload. Nothing is wiped:
--   * team with the same name (case-insensitive) -> its date/slot/description are replaced, votes kept
--   * investor with the same name (case-insensitive) -> ignored, so their votes/stats are kept
-- p_teams:     [{ "name": "...", "date": "10/28", "slot": "10:00", "description": "..." }, ...]
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
          description = nullif(trim(r ->> 'description'), '')
      where id = existing;
      teams_updated := teams_updated + 1;
    else
      insert into teams (name, slot_date, slot, description)
      values (nm, nullif(trim(r ->> 'date'), ''), nullif(trim(r ->> 'slot'), ''), nullif(trim(r ->> 'description'), ''));
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

commit;
