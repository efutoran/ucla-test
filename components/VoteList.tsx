import { when } from "@/lib/schedule";
import type { Team } from "@/lib/types";
import ThumbButton from "./ThumbButton";
import { Empty } from "./Status";

/** "Now presenting" card on top, then every team, each with a 👍 toggle. */
export default function VoteList({
  teams,
  presentingId,
  counts,
  isOn,
  onToggle,
}: {
  teams: Team[];
  presentingId: string | null | undefined;
  counts: Map<string, number>;
  isOn: (teamId: string) => boolean;
  onToggle: (teamId: string) => void;
}) {
  const presenting = teams.find((t) => t.id === presentingId);

  const card = (t: Team, highlight = false) => {
    const on = isOn(t.id);
    return (
      <li
        key={t.id}
        className={`flex items-center gap-3 rounded-2xl border bg-white p-4 dark:bg-zinc-900 ${
          highlight ? "border-2 border-orange-500 shadow-lg shadow-orange-500/10" : on ? "border-orange-400" : "border-zinc-200 dark:border-zinc-800"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold ${highlight ? "text-xl" : "text-lg"}`}>{t.name}</p>
          {t.description && <p className="text-sm text-zinc-600 dark:text-zinc-300">{t.description}</p>}
          {t.members && (
            <p className="mt-0.5 text-xs text-zinc-500">
              <span aria-hidden>👥 </span>
              <span className="sr-only">Team members: </span>
              {t.members}
            </p>
          )}
          <p className="mt-1 text-sm">
            <span className="font-medium text-orange-600 dark:text-orange-400">👍 {counts.get(t.id) ?? 0}</span>
            {t.slot && <span className="ml-2 text-zinc-400">{when(t)}</span>}
          </p>
        </div>
        <ThumbButton on={on} onClick={() => onToggle(t.id)} />
      </li>
    );
  };

  return (
    <>
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
    </>
  );
}
