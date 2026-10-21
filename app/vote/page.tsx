"use client";

import { useEffect, useMemo, useState } from "react";
import { useEventData } from "@/lib/useEventData";
import { useRole } from "@/lib/useRole";
import SlotTabs from "@/components/SlotTabs";
import ThumbButton from "@/components/ThumbButton";
import { Empty, ErrorBox, LiveDot, Loading } from "@/components/Status";

export default function VotePage() {
  const data = useEventData();
  const { slots, teams, investors, counts, settings, loading, error, live, hasVoted, toggleVote } = data;
  const ids = useMemo(() => (loading || error ? null : investors.map((i) => i.id)), [loading, error, investors]);
  const me = useRole("investor", ids);
  const [slotId, setSlotId] = useState<string | null>(null);

  // Follow the admin's "now presenting" slot; fall back to the first slot
  const currentSlotId = settings?.current_slot_id ?? null;
  useEffect(() => {
    if (currentSlotId) setSlotId(currentSlotId);
  }, [currentSlotId]);
  useEffect(() => {
    if (!slots.length) return;
    if (!slotId || !slots.some((s) => s.id === slotId)) setSlotId(currentSlotId ?? slots[0].id);
  }, [slots, slotId, currentSlotId]);

  if (error) return <ErrorBox message={error} />;
  if (loading || !me) return <Loading />;

  const myThumbs = teams.filter((t) => hasVoted(me.id, t.id)).length;
  const slotTeams = teams.filter((t) => t.slot_id === slotId);

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

      <SlotTabs slots={slots} value={slotId} onChange={setSlotId} currentSlotId={currentSlotId} />

      {slotTeams.length === 0 && <Empty>No teams in this slot.</Empty>}

      <ul className="space-y-3">
        {slotTeams.map((t) => {
          const on = hasVoted(me.id, t.id);
          return (
            <li
              key={t.id}
              className={`flex items-center gap-3 rounded-2xl border bg-white p-4 dark:bg-zinc-900 ${
                on ? "border-orange-400" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{t.name}</p>
                {t.description && <p className="text-sm text-zinc-500">{t.description}</p>}
                <p className="mt-1 text-sm font-medium text-orange-600 dark:text-orange-400">
                  👍 {counts.get(t.id) ?? 0}
                </p>
              </div>
              <ThumbButton on={on} onClick={() => toggleVote(me.id, t.id)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
