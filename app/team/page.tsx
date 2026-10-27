"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useEventData } from "@/lib/useEventData";
import { useRole } from "@/lib/useRole";
import { rankTeams } from "@/lib/rank";
import { when } from "@/lib/schedule";
import { ErrorBox, LiveDot, Loading } from "@/components/Status";

export default function TeamPage() {
  const { teams, investors, votes, counts, loading, error, live } = useEventData();
  const ids = useMemo(() => (loading || error ? null : teams.map((t) => t.id)), [loading, error, teams]);
  const me = useRole("team", ids);

  const team = teams.find((t) => t.id === me?.id);
  const voters = useMemo(() => {
    const names = new Map(investors.map((i) => [i.id, i.name]));
    return votes
      .filter((v) => v.team_id === me?.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((v) => ({ ...v, name: names.get(v.investor_id) ?? "Unknown" }));
  }, [votes, investors, me?.id]);

  if (error) return <ErrorBox message={error} />;
  if (loading || !me || !team) return <Loading />;

  const overall = rankTeams(teams, counts).find((r) => r.team.id === team.id);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          {team.description && <p className="text-zinc-600 dark:text-zinc-300">{team.description}</p>}
          {team.members && (
            <p className="mt-0.5 text-sm text-zinc-500">
              <span aria-hidden>👥 </span>
              <span className="sr-only">Team members: </span>
              {team.members}
            </p>
          )}
          {team.slot && <p className="mt-0.5 text-sm text-zinc-500">Presenting at {when(team)}</p>}
        </div>
        <LiveDot live={live} />
      </div>

      <div className="rounded-3xl bg-orange-500 p-8 text-center text-white shadow-xl shadow-orange-500/20">
        <p className="text-7xl font-black tabular-nums">{voters.length}</p>
        <p className="mt-1 text-lg font-medium">👍 thumbs up</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-3xl font-bold">#{overall?.rank}</p>
        <p className="text-sm text-zinc-500">of {teams.length} teams</p>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Who gave you a thumbs up</h2>
        {voters.length === 0 ? (
          <p className="text-sm text-zinc-500">No thumbs yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {voters.map((v) => (
              <li key={v.investor_id} className="flex justify-between px-4 py-2.5">
                <span>{v.name}</span>
                <span className="text-sm text-zinc-500">
                  {new Date(v.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/leaderboard" className="block text-center text-sm font-medium text-orange-600 dark:text-orange-400">
        View full leaderboard →
      </Link>
    </div>
  );
}
