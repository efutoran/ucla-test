"use client";

import { useEffect, useState } from "react";
import { useEventData } from "@/lib/useEventData";
import { useIdentity } from "@/lib/identity";
import { useSeenCounts } from "@/lib/useAudience";
import { rankBy } from "@/lib/rank";
import { Empty, ErrorBox, LiveDot, Loading } from "@/components/Status";

type Mode = "total" | "percent";
const MODE_KEY = "demo-day-leaderboard-mode";

// Aggregated counts only — no voter names on this page.
export default function LeaderboardPage() {
  const { teams, counts, loading, error, live } = useEventData();
  const { identity } = useIdentity();
  const seen = useSeenCounts();
  const [mode, setModeState] = useState<Mode>("total");

  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === "percent") setModeState("percent");
    } catch {}
  }, []);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };

  if (error) return <ErrorBox message={error} />;
  if (loading) return <Loading />;

  // Share of the team's audience who gave a thumbs-up; null until anyone has seen the pitch
  const pctOf = (teamId: string) => {
    const s = seen.get(teamId) ?? 0;
    return s > 0 ? Math.min(1, (counts.get(teamId) ?? 0) / s) : null;
  };
  const ranked =
    mode === "total"
      ? rankBy(teams, counts, (t) => counts.get(t.id) ?? 0)
      : rankBy(teams, counts, (t) => pctOf(t.id), (v) => Math.round(v * 100));
  const max = Math.max(mode === "total" ? 1 : 0.01, ...ranked.map((r) => r.value ?? 0));
  const highlight = identity?.role === "team" ? identity.id : null;
  const pctLabel = (teamId: string) => {
    const p = pctOf(teamId);
    return p === null ? "—" : `${Math.round(p * 100)}%`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Leaderboard</h1>
        <LiveDot live={live} />
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-200 p-1 dark:bg-zinc-800" role="tablist">
        {(
          [
            ["total", "Total 👍"],
            ["percent", "% of audience"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 text-sm font-semibold ${
              mode === m ? "bg-white shadow dark:bg-zinc-950" : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "percent" && (
        <p className="-mt-2 text-xs text-zinc-500">
          Thumbs-ups ÷ people who saw the pitch (had the app open while it was presenting, or voted for it).
        </p>
      )}

      {ranked.length === 0 && <Empty>No teams yet.</Empty>}

      <ol className="space-y-2">
        {ranked.map((r) => (
          <li
            key={r.team.id}
            className={`relative overflow-hidden rounded-xl border bg-white dark:bg-zinc-900 ${
              r.team.id === highlight ? "border-orange-500" : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 bg-orange-100 transition-all duration-500 dark:bg-orange-500/15"
              style={{ width: `${((r.value ?? 0) / max) * 100}%` }}
            />
            <div className="relative flex items-center gap-3 px-4 py-3">
              <span className="w-8 text-lg font-bold tabular-nums text-zinc-400">{r.rank ?? "–"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.team.name}</p>
                {r.team.description && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{r.team.description}</p>
                )}
              </div>
              <span className="shrink-0 text-right tabular-nums">
                {mode === "total" ? (
                  <>
                    <span className="block text-lg font-bold">👍 {r.count}</span>
                    <span className="block text-xs text-zinc-500">{pctLabel(r.team.id)} of audience</span>
                  </>
                ) : (
                  <>
                    <span className="block text-lg font-bold">{pctLabel(r.team.id)}</span>
                    <span className="block text-xs text-zinc-500">
                      👍 {r.count} of {seen.get(r.team.id) ?? 0}
                    </span>
                  </>
                )}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
