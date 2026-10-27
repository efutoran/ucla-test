"use client";

import { useMemo } from "react";
import { useEventData } from "@/lib/useEventData";
import { useRole } from "@/lib/useRole";
import { isReservedInvestor } from "@/lib/reserved";
import VoteList from "@/components/VoteList";
import { ErrorBox, LiveDot, Loading } from "@/components/Status";

export default function VotePage() {
  const { teams, investors, counts, settings, loading, error, live, hasVoted, toggleVote } = useEventData();
  // Reserved names are excluded, so anyone already signed in as one is sent back to sign-in
  const ids = useMemo(
    () => (loading || error ? null : investors.filter((i) => !isReservedInvestor(i.name)).map((i) => i.id)),
    [loading, error, investors],
  );
  const me = useRole("investor", ids);

  if (error) return <ErrorBox message={error} />;
  if (loading || !me) return <Loading />;

  const myThumbs = teams.filter((t) => hasVoted(me.id, t.id)).length;

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

      <VoteList
        teams={teams}
        presentingId={settings?.current_team_id}
        counts={counts}
        isOn={(teamId) => hasVoted(me.id, teamId)}
        onToggle={(teamId) => toggleVote(me.id, teamId)}
      />
    </div>
  );
}
