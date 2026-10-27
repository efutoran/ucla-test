-- Adds team members (shown on the investor vote screen). Keeps all data.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run (after 001).

begin;

alter table teams add column if not exists members text;

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

commit;
