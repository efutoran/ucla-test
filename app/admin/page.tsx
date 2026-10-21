"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useEventData } from "@/lib/useEventData";
import { useRole } from "@/lib/useRole";
import { rankTeams } from "@/lib/rank";
import { downloadCsv, parseInvestors, parseTeams, type InvestorRow, type TeamRow } from "@/lib/csv";
import { ErrorBox, LiveDot, Loading } from "@/components/Status";

type Section = "results" | "participation" | "log" | "setup";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

export default function AdminPage() {
  const me = useRole("admin", null);
  const { slots, teams, investors, votes, counts, settings, loading, error, live, reload, setCurrentSlot } =
    useEventData();
  const [section, setSection] = useState<Section>("results");
  const [openTeam, setOpenTeam] = useState<string | null>(null);

  const investorName = useMemo(() => new Map(investors.map((i) => [i.id, i.name])), [investors]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const slotLabel = useMemo(() => new Map(slots.map((s) => [s.id, s.label])), [slots]);

  const participation = useMemo(() => {
    const byInvestor = new Map<string, string[]>();
    for (const v of votes) byInvestor.set(v.investor_id, [...(byInvestor.get(v.investor_id) ?? []), v.team_id]);
    return investors
      .map((i) => ({ investor: i, teamIds: byInvestor.get(i.id) ?? [] }))
      .sort((a, b) => b.teamIds.length - a.teamIds.length || a.investor.name.localeCompare(b.investor.name));
  }, [investors, votes]);

  const log = useMemo(() => [...votes].sort((a, b) => b.created_at.localeCompare(a.created_at)), [votes]);

  if (error) return <ErrorBox message={error} />;
  if (loading || !me) return <Loading />;

  const ranked = rankTeams(teams, counts);
  const participated = participation.filter((p) => p.teamIds.length > 0).length;

  const exportResults = () =>
    downloadCsv("results.csv", [
      ["rank", "team", "slot", "thumbs", "voters"],
      ...ranked.map((r) => [
        r.rank,
        r.team.name,
        slotLabel.get(r.team.slot_id) ?? "",
        r.count,
        votes
          .filter((v) => v.team_id === r.team.id)
          .map((v) => investorName.get(v.investor_id))
          .join("; "),
      ]),
    ]);
  const exportParticipation = () =>
    downloadCsv("participation.csv", [
      ["investor", "thumbs_given", "teams"],
      ...participation.map((p) => [
        p.investor.name,
        p.teamIds.length,
        p.teamIds.map((id) => teamById.get(id)?.name).join("; "),
      ]),
    ]);
  const exportLog = () =>
    downloadCsv("votes.csv", [
      ["timestamp", "investor", "team", "slot"],
      ...log.map((v) => {
        const t = teamById.get(v.team_id);
        return [v.created_at, investorName.get(v.investor_id) ?? "", t?.name ?? "", t ? slotLabel.get(t.slot_id) ?? "" : ""];
      }),
    ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Admin</h1>
        <LiveDot live={live} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Teams" value={teams.length} />
        <Stat label="Investors" value={investors.length} />
        <Stat label="Participated" value={`${participated}/${investors.length}`} />
        <Stat label="Total thumbs" value={votes.length} />
      </div>

      <label className="block rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-sm font-semibold">Now presenting</span>
        <span className="block text-xs text-zinc-500">Investor screens jump to this slot.</span>
        <select
          value={settings?.current_slot_id ?? ""}
          onChange={(e) => setCurrentSlot(e.target.value || null)}
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">— None —</option>
          {slots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {(
          [
            ["results", "Results"],
            ["participation", "Participation"],
            ["log", "Vote log"],
            ["setup", "Upload / reset"],
          ] as [Section, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              section === key ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "results" && (
        <Card title="Results by team" action={<ExportButton onClick={exportResults} />}>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {ranked.map((r) => {
              const voters = votes.filter((v) => v.team_id === r.team.id);
              const open = openTeam === r.team.id;
              return (
                <li key={r.team.id}>
                  <button
                    onClick={() => setOpenTeam(open ? null : r.team.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="w-6 text-sm font-bold text-zinc-400">{r.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.team.name}</span>
                      <span className="block text-xs text-zinc-500">{slotLabel.get(r.team.slot_id)}</span>
                    </span>
                    <span className="font-bold tabular-nums">👍 {r.count}</span>
                    <span className="text-zinc-400">{open ? "▾" : "▸"}</span>
                  </button>
                  {open && (
                    <p className="px-4 pb-3 pl-13 text-sm text-zinc-600 dark:text-zinc-400">
                      {voters.length
                        ? voters.map((v) => investorName.get(v.investor_id)).join(", ")
                        : "No votes yet"}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {section === "participation" && (
        <Card
          title={`Participation — ${participated} of ${investors.length} voted`}
          action={<ExportButton onClick={exportParticipation} />}
        >
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {participation.map((p) => (
              <li key={p.investor.id} className="px-4 py-2.5">
                <div className="flex justify-between">
                  <span className={p.teamIds.length ? "" : "text-zinc-400"}>{p.investor.name}</span>
                  <span className="font-semibold tabular-nums">{p.teamIds.length}</span>
                </div>
                {p.teamIds.length > 0 && (
                  <p className="text-xs text-zinc-500">{p.teamIds.map((id) => teamById.get(id)?.name).join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {section === "log" && (
        <Card title={`Vote log (${log.length})`} action={<ExportButton onClick={exportLog} />}>
          <ul className="max-h-[60vh] divide-y divide-zinc-200 overflow-y-auto text-sm dark:divide-zinc-800">
            {log.map((v) => (
              <li key={`${v.investor_id}:${v.team_id}`} className="flex gap-3 px-4 py-2">
                <span className="w-24 shrink-0 tabular-nums text-zinc-500">{time(v.created_at)}</span>
                <span className="min-w-0 flex-1 truncate">
                  <b>{investorName.get(v.investor_id)}</b> → {teamById.get(v.team_id)?.name}
                </span>
              </li>
            ))}
            {log.length === 0 && <li className="px-4 py-3 text-zinc-500">No votes yet.</li>}
          </ul>
        </Card>
      )}

      {section === "setup" && <Setup onDone={reload} />}
    </div>
  );
}

function Setup({ onDone }: { onDone: () => void }) {
  const [teamRows, setTeamRows] = useState<TeamRow[] | null>(null);
  const [investorRows, setInvestorRows] = useState<InvestorRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const slotCount = teamRows ? new Set(teamRows.map((r) => r.slot || "Unscheduled")).size : 0;

  const submit = async () => {
    if (!teamRows || !investorRows) return;
    if (!confirm("This deletes ALL teams, investors and votes and loads the new CSVs. Continue?")) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("reset_event", { p_teams: teamRows, p_investors: investorRows });
    setBusy(false);
    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }
    setMessage(`Loaded ${teamRows.length} teams in ${slotCount} slots and ${investorRows.length} investors. Votes cleared.`);
    onDone();
  };

  return (
    <Card title="Upload roster & reset">
      <div className="space-y-4 p-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Uploading replaces everything: all teams, investors and votes are wiped. Everyone currently signed in is sent
          back to the sign-in screen.
        </p>

        <FilePicker
          label="Teams CSV"
          hint="Columns: team, slot, description (optional). Slots appear in the order they first show up."
          onFile={async (f) => setTeamRows(await parseTeams(f))}
          summary={teamRows && `${teamRows.length} teams in ${slotCount} slots`}
        />
        <FilePicker
          label="Investors CSV"
          hint="Column: name"
          onFile={async (f) => setInvestorRows(await parseInvestors(f))}
          summary={investorRows && `${investorRows.length} investors`}
        />

        <button
          disabled={!teamRows?.length || !investorRows?.length || busy}
          onClick={submit}
          className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Resetting…" : "Reset & load"}
        </button>
        {message && <p className="text-sm">{message}</p>}
      </div>
    </Card>
  );
}

function FilePicker({
  label,
  hint,
  onFile,
  summary,
}: {
  label: string;
  hint: string;
  onFile: (f: File) => void;
  summary: string | null;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <span className="block text-xs text-zinc-500">{hint}</span>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-3 file:py-2 file:font-medium dark:file:bg-zinc-800"
      />
      {summary && <span className="mt-1 block text-sm text-green-700 dark:text-green-400">✓ {summary}</span>}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800">
      Export CSV
    </button>
  );
}
