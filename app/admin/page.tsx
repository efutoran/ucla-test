"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useEventData } from "@/lib/useEventData";
import { useRole } from "@/lib/useRole";
import { useAdminAccess } from "@/lib/adminAccess";
import { isHiddenFromViewer } from "@/lib/reserved";
import { rankTeams } from "@/lib/rank";
import { when } from "@/lib/schedule";
import { downloadCsv, parseInvestors, parseTeams, type InvestorRow, type TeamRow } from "@/lib/csv";
import type { Investor, Team, Vote } from "@/lib/types";
import { ErrorBox, LiveDot, Loading } from "@/components/Status";
import ThumbButton from "@/components/ThumbButton";

type Section = "results" | "participation" | "log" | "upload" | "manage";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

export default function AdminPage() {
  const me = useRole("admin", null);
  const data = useEventData();
  const { teams, settings, loading, error, live, reload, setCurrentTeam, hasVoted, toggleVote } = data;
  const [section, setSection] = useState<Section>("results");
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const audience = useAudienceCounts();
  const canEdit = useAdminAccess() === "full";

  // The view-only console leaves out some investors (the professor) and their votes entirely
  const { investors, votes, counts } = useMemo(() => {
    if (canEdit) return { investors: data.investors, votes: data.votes, counts: data.counts };
    const hidden = new Set(data.investors.filter((i) => isHiddenFromViewer(i.name)).map((i) => i.id));
    const visibleVotes = data.votes.filter((v) => !hidden.has(v.investor_id));
    const c = new Map<string, number>();
    for (const v of visibleVotes) c.set(v.team_id, (c.get(v.team_id) ?? 0) + 1);
    return { investors: data.investors.filter((i) => !hidden.has(i.id)), votes: visibleVotes, counts: c };
  }, [canEdit, data.investors, data.votes, data.counts]);

  const investorName = useMemo(() => new Map(investors.map((i) => [i.id, i.name])), [investors]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

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
  // teams is already in presentation order (date, then slot)
  const currentIndex = teams.findIndex((t) => t.id === settings?.current_team_id);
  const presentingTeam = teams[currentIndex];
  const nextTeam = currentIndex === -1 ? teams[0] : teams[currentIndex + 1];
  const prevTeam = currentIndex > 0 ? teams[currentIndex - 1] : undefined;
  const participated = participation.filter((p) => p.teamIds.length > 0).length;

  const exportResults = () =>
    downloadCsv("results.csv", [
      ["rank", "team", "date", "slot", "thumbs", "approx_watching", "voters"],
      ...ranked.map((r) => [
        r.rank,
        r.team.name,
        r.team.slot_date ?? "",
        r.team.slot ?? "",
        r.count,
        audience.get(r.team.id) ?? 0,
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
      ["timestamp", "investor", "team", "date", "slot"],
      ...log.map((v) => {
        const t = teamById.get(v.team_id);
        return [v.created_at, investorName.get(v.investor_id) ?? "", t?.name ?? "", t?.slot_date ?? "", t?.slot ?? ""];
      }),
    ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Admin
          {!canEdit && (
            <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 align-middle text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              View only
            </span>
          )}
        </h1>
        <LiveDot live={live} />
      </div>
      {!canEdit && (
        <p className="-mt-3 text-sm text-zinc-500">
          You can look around everything, but buttons that change the event are turned off.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Teams" value={teams.length} />
        <Stat label="Investors" value={investors.length} />
        <Stat label="Participated" value={`${participated}/${investors.length}`} />
        <Stat label="Total thumbs" value={votes.length} />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label htmlFor="now-presenting" className="text-sm font-semibold">
          Now presenting
        </label>
        <span className="block text-xs text-zinc-500">Pinned to the top of investors&apos; screens; its votes trigger the celebration.</span>
        <select
          id="now-presenting"
          value={settings?.current_team_id ?? ""}
          onChange={(e) => canEdit && setCurrentTeam(e.target.value || null)}
          disabled={!canEdit}
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">— None —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {[when(t, true), t.name].filter(Boolean).join(" — ")}
            </option>
          ))}
        </select>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => canEdit && prevTeam && setCurrentTeam(prevTeam.id)}
            disabled={!canEdit || !prevTeam}
            className="rounded-xl border border-zinc-300 px-4 py-3 font-semibold disabled:opacity-40 dark:border-zinc-700"
            aria-label="Previous team"
          >
            ◀
          </button>
          <button
            onClick={() => canEdit && nextTeam && setCurrentTeam(nextTeam.id)}
            disabled={!canEdit || !nextTeam}
            className="min-w-0 flex-1 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white active:bg-orange-600 disabled:opacity-40"
          >
            <span className="block truncate">{nextTeam ? `Next team: ${nextTeam.name} ▶` : "Last team"}</span>
          </button>
        </div>
        <AdminThumb
          team={presentingTeam}
          investors={investors}
          count={counts.get(settings?.current_team_id ?? "") ?? 0}
          hasVoted={hasVoted}
          toggleVote={toggleVote}
          onAdded={reload}
          readOnly={!canEdit}
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {(
          [
            ["results", "Results"],
            ["participation", "Participation"],
            ["log", "Vote log"],
            ["upload", "Upload"],
            ["manage", "Delete"],
          ] as [Section, string][]
        )
          .map(([key, label]) => (
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
          <p className="border-b border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
            👀 ≈ unique signed-in investors who had the app open while that team was &ldquo;Now presenting&rdquo;.
          </p>
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
                      <span className="block text-xs text-zinc-500">{when(r.team, true)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-bold tabular-nums">👍 {r.count}</span>
                      <AudienceLine watching={audience.get(r.team.id) ?? 0} thumbs={r.count} />
                    </span>
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

      {section === "upload" && <Upload onDone={reload} readOnly={!canEdit} />}
      {section === "manage" && (
        <Manage teams={teams} investors={investors} votes={votes} onDone={reload} readOnly={!canEdit} />
      )}
    </div>
  );
}

/** Approximate audience per team (rows in `audience`), refreshed every 15s while open. */
function useAudienceCounts() {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("audience").select("team_id").limit(100000);
      if (!data) return;
      const c = new Map<string, number>();
      for (const row of data as { team_id: string }[]) c.set(row.team_id, (c.get(row.team_id) ?? 0) + 1);
      setCounts(c);
    };
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  return counts;
}

function AudienceLine({ watching, thumbs }: { watching: number; thumbs: number }) {
  if (!watching) return <span className="block text-xs text-zinc-400">👀 —</span>;
  const pct = Math.min(100, Math.round((thumbs / watching) * 100));
  return (
    <span className="block whitespace-nowrap text-xs text-zinc-500 tabular-nums">
      👀 ~{watching} · {pct}%
    </span>
  );
}

const VOTER_KEY = "demo-day-admin-voter";

const ADD_NEW = "__add__";

/** The admin's own 👍 for the presenting team, cast as one of the investors (normally themselves). */
function AdminThumb({
  team,
  investors,
  count,
  hasVoted,
  toggleVote,
  onAdded,
  readOnly,
}: {
  team: Team | undefined;
  investors: Investor[];
  count: number;
  hasVoted: (investorId: string, teamId: string) => boolean;
  toggleVote: (investorId: string, teamId: string) => void;
  onAdded: () => void;
  readOnly: boolean;
}) {
  const [voterId, setVoterIdState] = useState("");

  useEffect(() => {
    try {
      setVoterIdState(localStorage.getItem(VOTER_KEY) ?? "");
    } catch {}
  }, []);
  const setVoterId = (id: string) => {
    setVoterIdState(id);
    try {
      localStorage.setItem(VOTER_KEY, id);
    } catch {}
  };

  const addName = async () => {
    const name = prompt("Your name (added to the investor list):")?.trim();
    if (!name) return;
    const { error } = await supabase.rpc("import_roster", { p_teams: [], p_investors: [{ name }] });
    const { data } = error
      ? { data: null }
      : await supabase.from("investors").select("id").ilike("name", name).limit(1).maybeSingle();
    if (error || !data) {
      alert(`Couldn't add investor: ${error?.message ?? "not found"}`);
      return;
    }
    setVoterId(data.id);
    onAdded();
  };

  const voter = investors.find((i) => i.id === voterId);
  const on = !!voter && !!team && hasVoted(voter.id, team.id);

  return (
    <div className="mt-3 flex items-center gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <div className="min-w-0 flex-1">
        <label htmlFor="admin-voter" className="block text-xs font-semibold text-zinc-500">
          Your vote{team ? ` for ${team.name}` : ""} · 👍 {count}
        </label>
        <select
          id="admin-voter"
          value={voter ? voter.id : ""}
          onChange={(e) => (e.target.value === ADD_NEW ? addName() : setVoterId(e.target.value))}
          disabled={readOnly}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">— Vote as… —</option>
          {investors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
          <option value={ADD_NEW}>+ Add my name…</option>
        </select>
      </div>
      <ThumbButton
        on={on}
        disabled={readOnly || !voter || !team}
        onClick={() => !readOnly && voter && team && toggleVote(voter.id, team.id)}
      />
    </div>
  );
}

function Upload({ onDone, readOnly }: { onDone: () => void; readOnly: boolean }) {
  const [teamRows, setTeamRows] = useState<TeamRow[] | null>(null);
  const [investorRows, setInvestorRows] = useState<InvestorRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const submit = async () => {
    if (readOnly) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("import_roster", {
      p_teams: teamRows ?? [],
      p_investors: investorRows ?? [],
    });
    setBusy(false);
    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }
    const r = data as { teams_added: number; teams_updated: number; investors_added: number; investors_skipped: number };
    setMessage(
      `Teams: ${r.teams_added} added, ${r.teams_updated} updated. ` +
        `Investors: ${r.investors_added} added, ${r.investors_skipped} already existed (kept).`,
    );
    setTeamRows(null);
    setInvestorRows(null);
    setFormKey((k) => k + 1); // clear the file inputs
    onDone();
  };

  return (
    <Card title="Upload teams & investors">
      <div key={formKey} className="space-y-4 p-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>New names are added. Nothing is deleted. Use the Delete tab for that.</li>
          <li>A team with the same name gets its date, slot, description and members replaced. Its votes are kept.</li>
          <li>An investor with the same name is skipped, so their votes are kept.</li>
          <li>Names match regardless of upper/lower case. You can upload just one of the files.</li>
        </ul>

        <FilePicker
          label="Teams CSV"
          hint="Columns: team, date, slot, description (one-liner), members. Date is admin-only, e.g. 10/28. Quote the members list if it has commas."
          onFile={async (f) => setTeamRows(await parseTeams(f))}
          summary={teamRows && `${teamRows.length} teams`}
        />
        <FilePicker
          label="Investors CSV"
          hint="Column: name"
          onFile={async (f) => setInvestorRows(await parseInvestors(f))}
          summary={investorRows && `${investorRows.length} investors`}
        />

        <button
          disabled={readOnly || (!teamRows?.length && !investorRows?.length) || busy}
          onClick={submit}
          className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white disabled:opacity-40"
        >
          {readOnly ? "Upload (view only)" : busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      {message && <p className="px-4 pb-4 text-sm">{message}</p>}
    </Card>
  );
}

function Manage({
  teams,
  investors,
  votes,
  onDone,
  readOnly,
}: {
  teams: Team[];
  investors: Investor[];
  votes: Vote[];
  onDone: () => void;
  readOnly: boolean;
}) {
  const [teamIds, setTeamIds] = useState<Set<string>>(new Set());
  const [investorIds, setInvestorIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  // Teams grouped by date so a whole old section can be selected at once
  const byDate = useMemo(() => {
    const groups = new Map<string, Team[]>();
    for (const t of teams) {
      const d = t.slot_date ?? "No date";
      groups.set(d, [...(groups.get(d) ?? []), t]);
    }
    return [...groups.entries()];
  }, [teams]);

  const votesPerInvestor = useMemo(() => {
    const c = new Map<string, number>();
    for (const v of votes) c.set(v.investor_id, (c.get(v.investor_id) ?? 0) + 1);
    return c;
  }, [votes]);

  const shownInvestors = investors.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()));
  const affectedVotes = votes.filter((v) => teamIds.has(v.team_id) || investorIds.has(v.investor_id)).length;

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, ids: string[], on: boolean) => {
    const next = new Set(set);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    setter(next);
  };

  const submit = async () => {
    if (readOnly) return;
    const msg =
      `Permanently delete ${teamIds.size} team(s) and ${investorIds.size} investor(s)` +
      (affectedVotes ? `, plus ${affectedVotes} vote(s) involving them?` : "?");
    if (!confirm(msg)) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_roster", {
      p_team_ids: [...teamIds],
      p_investor_ids: [...investorIds],
    });
    setBusy(false);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    setTeamIds(new Set());
    setInvestorIds(new Set());
    onDone();
  };

  const checkbox = "h-5 w-5 shrink-0 accent-red-600";

  return (
    <div className="space-y-4">
      <Card title={`Teams (${teamIds.size} selected)`}>
        {byDate.map(([date, group]) => {
          const ids = group.map((t) => t.id);
          const all = ids.every((id) => teamIds.has(id));
          return (
            <div key={date} className="border-b border-zinc-200 last:border-0 dark:border-zinc-800">
              <label className="flex items-center gap-3 bg-zinc-50 px-4 py-2 text-sm font-semibold dark:bg-zinc-950">
                <input
                  type="checkbox"
                  className={checkbox}
                  checked={all}
                  onChange={(e) => toggle(teamIds, setTeamIds, ids, e.target.checked)}
                />
                {date} <span className="font-normal text-zinc-500">· all {group.length}</span>
              </label>
              {group.map((t) => (
                <label key={t.id} className="flex items-center gap-3 px-4 py-2">
                  <input
                    type="checkbox"
                    className={checkbox}
                    checked={teamIds.has(t.id)}
                    onChange={(e) => toggle(teamIds, setTeamIds, [t.id], e.target.checked)}
                  />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="text-xs text-zinc-500">{t.slot}</span>
                </label>
              ))}
            </div>
          );
        })}
        {teams.length === 0 && <p className="px-4 py-3 text-zinc-500">No teams.</p>}
      </Card>

      <Card title={`Investors (${investorIds.size} selected)`}>
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <input
            type="checkbox"
            className={checkbox}
            checked={shownInvestors.length > 0 && shownInvestors.every((i) => investorIds.has(i.id))}
            onChange={(e) => toggle(investorIds, setInvestorIds, shownInvestors.map((i) => i.id), e.target.checked)}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {shownInvestors.map((i) => (
            <label key={i.id} className="flex items-center gap-3 px-4 py-2">
              <input
                type="checkbox"
                className={checkbox}
                checked={investorIds.has(i.id)}
                onChange={(e) => toggle(investorIds, setInvestorIds, [i.id], e.target.checked)}
              />
              <span className="min-w-0 flex-1 truncate">{i.name}</span>
              <span className="text-xs text-zinc-500">
                {votesPerInvestor.get(i.id) ?? 0} vote{votesPerInvestor.get(i.id) === 1 ? "" : "s"} · added {new Date(i.created_at).toLocaleDateString([], { month: "numeric", day: "numeric" })}
              </span>
            </label>
          ))}
          {shownInvestors.length === 0 && <p className="px-4 py-3 text-zinc-500">No investors.</p>}
        </div>
      </Card>

      <button
        disabled={readOnly || (!teamIds.size && !investorIds.size) || busy}
        onClick={submit}
        className="sticky bottom-4 w-full rounded-xl bg-red-600 py-3 font-semibold text-white shadow-lg disabled:opacity-40"
      >
        {readOnly
          ? `Delete selected (${teamIds.size + investorIds.size}) — view only`
          : busy
            ? "Deleting…"
            : `Delete selected (${teamIds.size + investorIds.size})`}
      </button>
    </div>
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
