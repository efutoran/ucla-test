import type { Team } from "./types";

export type Ranked = { team: Team; count: number; rank: number };

/** Sort by thumbs (desc), ties share a rank (1, 1, 3, ...). */
export function rankTeams(teams: Team[], counts: Map<string, number>): Ranked[] {
  const sorted = teams
    .map((team) => ({ team, count: counts.get(team.id) ?? 0, rank: 0 }))
    .sort((a, b) => b.count - a.count || a.team.name.localeCompare(b.team.name));
  sorted.forEach((r, i) => {
    r.rank = i > 0 && r.count === sorted[i - 1].count ? sorted[i - 1].rank : i + 1;
  });
  return sorted;
}

export type RankedBy = { team: Team; count: number; value: number | null; rank: number | null };

/**
 * Sort by `value` (desc), teams with no value last and unranked; ties share a rank.
 * Ties are judged on `tieKey` (e.g. the rounded percentage shown), then broken by count and name.
 */
export function rankBy(
  teams: Team[],
  counts: Map<string, number>,
  value: (team: Team) => number | null,
  tieKey: (v: number) => number = (v) => v,
): RankedBy[] {
  const rows = teams.map((team) => ({ team, count: counts.get(team.id) ?? 0, value: value(team), rank: null as number | null }));
  rows.sort(
    (a, b) =>
      (a.value === null ? 1 : 0) - (b.value === null ? 1 : 0) ||
      (b.value ?? 0) - (a.value ?? 0) ||
      b.count - a.count ||
      a.team.name.localeCompare(b.team.name),
  );
  rows.forEach((r, i) => {
    if (r.value === null) return;
    const prev = rows[i - 1];
    r.rank = prev && prev.value !== null && tieKey(prev.value) === tieKey(r.value) ? prev.rank : i + 1;
  });
  return rows;
}
