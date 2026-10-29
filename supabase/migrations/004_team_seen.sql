-- Adds the team_seen view used by the leaderboard's "% of audience" toggle. Keeps all data.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run (after 003).

-- Per-team "seen" count for the public leaderboard's % of audience: investors who had the
-- app open while the team was presenting, plus anyone who voted for it. Counts only, no names.
create or replace view team_seen as
select team_id, count(distinct investor_id)::int as seen
from (
  select team_id, investor_id from audience
  union
  select team_id, investor_id from votes
) s
group by team_id;
grant select on team_seen to anon, authenticated;
