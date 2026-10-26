"use client";

import { useMemo } from "react";
import { useEventData } from "@/lib/useEventData";
import { useRole } from "@/lib/useRole";
import { when } from "@/lib/schedule";
import type { Team } from "@/lib/types";
import ThumbButton from "@/components/ThumbButton";
import { Empty, ErrorBox, LiveDot, Loading } from "@/components/Status";

export default function VotePage() {
  const { teams, investors, counts, settings, loading, error, live, hasVoted, toggleVote } = useEventData();
  const ids = useMemo(() => (loading || error ? null : investors.map((i) => i.id)), [loading, error, investors]);
  const me = useRole("investor", ids);

  if (error) return <ErrorBox message={error} />;
  if (loading || !me) return <Loading />;

  const myThumbs = teams.filter((t) => hasVoted(me.id, t.id)).length;
  const presenting = teams.find((t) => t.id === settings?.current_team_id);

  const card = (t: Team, highlight = false) => {
    const on = hasVoted(me.id, t.id);
    return (
      <li
        key={t.id}
        className={`flex items-center gap-3 rounded-2xl border bg-white p-4 dark:bg-zinc-900 ${
          highlight ? "border-2 border-orange-500 shadow-lg shadow-orange-500/10" : on ? "border-orange-400" : "border-zinc-200 dark:border-zinc-800"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold ${highlight ? "text-xl" : "text-lg"}`}>{t.name}</p>
          {t.description && <p className="text-sm text-zinc-500">{t.description}</p>}
          <p className="mt-1 text-sm">
            <span className="font-medium text-orange-600 dark:text-orange-400">👍 {counts.get(t.id) ?? 0}</span>
            {t.slot && <span className="ml-2 text-zinc-400">{when(t)}</span>}
          </p>
        </div>
        <ThumbButton on={on} onClick={() => toggleVote(me.id, t.id)} />
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-zinc-500">Voting as</p>
          <h1 className="text-xl font-bold">{me.name}</h1>
        </div>
        <div className="text-right">
          <LiveDot live={live} />
          <p className="text-sm text-zinc-500">
            {myThumbs} thumb{myThumbs === 1 ? "" : "s"} given
          </p>
        </div>
      </div>

      {presenting && (
        <section>
          <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" /> Now presenting
          </h2>
          <ul>{card(presenting, true)}</ul>
        </section>
      )}

      <section>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">All teams</h2>
        {teams.length === 0 && <Empty>No teams yet.</Empty>}
        <ul className="space-y-3">{teams.filter((t) => t.id !== presenting?.id).map((t) => card(t))}</ul>
      </section>
    </div>
  );
}
