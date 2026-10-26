"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { bySchedule } from "./schedule";
import type { Investor, Settings, Team, Vote } from "./types";

const voteKey = (v: { investor_id: string; team_id: string }) => `${v.investor_id}:${v.team_id}`;

/**
 * Loads teams, investors, votes and settings, and keeps votes/settings live via Supabase
 * Realtime. A change to settings.roster_updated_at (CSV import or delete) triggers a full reload.
 */
export function useEventData() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [votes, setVotes] = useState<Map<string, Vote>>(new Map());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const rosterVersion = useRef<string | null>(null);

  const reload = useCallback(async () => {
    const [t, i, v, st] = await Promise.all([
      supabase.from("teams").select("*"),
      supabase.from("investors").select("*").order("name"),
      supabase.from("votes").select("*").limit(100000),
      supabase.from("settings").select("*").eq("id", 1).single(),
    ]);
    const err = t.error ?? i.error ?? v.error ?? st.error;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setTeams((t.data as Team[]).sort(bySchedule));
    setInvestors(i.data as Investor[]);
    setVotes(new Map((v.data as Vote[]).map((x) => [voteKey(x), x])));
    setSettings(st.data as Settings);
    rosterVersion.current = (st.data as Settings).roster_updated_at;
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();

    const channel = supabase
      .channel("event-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes" }, (p) => {
        const v = p.new as Vote;
        setVotes((prev) => {
          if (prev.has(voteKey(v))) return prev;
          const next = new Map(prev);
          next.set(voteKey(v), v);
          return next;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "votes" }, (p) => {
        const v = p.old as Vote;
        setVotes((prev) => {
          if (!prev.has(voteKey(v))) return prev;
          const next = new Map(prev);
          next.delete(voteKey(v));
          return next;
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, (p) => {
        const st = p.new as Settings;
        if (st.roster_updated_at !== rosterVersion.current) reload();
        else setSettings(st);
      })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        // Catch up on anything missed while disconnected
        if (status === "SUBSCRIBED") reload();
      });

    // Phones suspend background tabs; resync when the user comes back
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const v of votes.values()) c.set(v.team_id, (c.get(v.team_id) ?? 0) + 1);
    return c;
  }, [votes]);

  /** Optimistically toggle a thumb; reverts if the write fails. */
  const toggleVote = useCallback(
    async (investorId: string, teamId: string) => {
      const key = voteKey({ investor_id: investorId, team_id: teamId });
      const existing = votes.get(key);
      setVotes((prev) => {
        const next = new Map(prev);
        if (existing) next.delete(key);
        else next.set(key, { investor_id: investorId, team_id: teamId, created_at: new Date().toISOString() });
        return next;
      });
      const { error } = existing
        ? await supabase.from("votes").delete().match({ investor_id: investorId, team_id: teamId })
        : await supabase.from("votes").upsert(
            { investor_id: investorId, team_id: teamId },
            { onConflict: "investor_id,team_id", ignoreDuplicates: true },
          );
      if (error) {
        setVotes((prev) => {
          const next = new Map(prev);
          if (existing) next.set(key, existing);
          else next.delete(key);
          return next;
        });
        alert(`Vote didn't save: ${error.message}`);
      }
    },
    [votes],
  );

  const setCurrentTeam = useCallback(async (teamId: string | null) => {
    setSettings((s) => (s ? { ...s, current_team_id: teamId } : s));
    await supabase.from("settings").update({ current_team_id: teamId }).eq("id", 1);
  }, []);

  return {
    teams,
    investors,
    votes: useMemo(() => [...votes.values()], [votes]),
    hasVoted: (investorId: string, teamId: string) =>
      votes.has(voteKey({ investor_id: investorId, team_id: teamId })),
    counts,
    settings,
    loading,
    error,
    live,
    reload,
    toggleVote,
    setCurrentTeam,
  };
}
