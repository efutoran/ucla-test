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
