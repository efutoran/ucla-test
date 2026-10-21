"use client";

import { useState } from "react";
import { useEventData } from "@/lib/useEventData";
import { useIdentity } from "@/lib/identity";
import { rankTeams } from "@/lib/rank";
import SlotTabs from "@/components/SlotTabs";
import { Empty, ErrorBox, LiveDot, Loading } from "@/components/Status";

// Aggregated counts only — no voter names on this page.
export default function LeaderboardPage() {
  const { slots, teams, counts, settings, loading, error, live } = useEventData();
  const { identity } = useIdentity();
  const [slotId, setSlotId] = useState<string | null>(null);

  if (error) return <ErrorBox message={error} />;
  if (loading) return <Loading />;

  const ranked = rankTeams(slotId ? teams.filter((t) => t.slot_id === slotId) : teams, counts);
  const max = Math.max(1, ...ranked.map((r) => r.count));
  const slotLabel = new Map(slots.map((s) => [s.id, s.label]));
  const highlight = identity?.role === "team" ? identity.id : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Leaderboard</h1>
        <LiveDot live={live} />
      </div>

      <SlotTabs
        slots={slots}
        value={slotId}
        onChange={setSlotId}
        currentSlotId={settings?.current_slot_id}
        allLabel="All teams"
      />

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
              style={{ width: `${(r.count / max) * 100}%` }}
            />
            <div className="relative flex items-center gap-3 px-4 py-3">
              <span className="w-8 text-lg font-bold tabular-nums text-zinc-400">{r.rank}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.team.name}</p>
                {!slotId && <p className="text-xs text-zinc-500">{slotLabel.get(r.team.slot_id)}</p>}
              </div>
              <span className="text-lg font-bold tabular-nums">👍 {r.count}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
