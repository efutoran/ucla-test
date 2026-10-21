"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { Investor, Settings, Slot, Team, Vote } from "./types";

const voteKey = (v: { investor_id: string; team_id: string }) => `${v.investor_id}:${v.team_id}`;

/**
 * Loads slots, teams, investors, votes and settings, and keeps votes/settings live via
 * Supabase Realtime. A change to settings.reset_at (CSV re-upload) triggers a full reload.
 */
export function useEventData() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [votes, setVotes] = useState<Map<string, Vote>>(new Map());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const resetAt = useRef<string | null>(null);

  const reload = useCallback(async () => {
    const [s, t, i, v, st] = await Promise.all([
      supabase.from("time_slots").select("*").order("sort_order"),
      supabase.from("teams").select("*").order("sort_order"),
      supabase.from("investors").select("*").order("sort_order"),
      supabase.from("votes").select("*").limit(100000),
      supabase.from("settings").select("*").eq("id", 1).single(),
    ]);
    const err = s.error ?? t.error ?? i.error ?? v.error ?? st.error;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setSlots(s.data as Slot[]);
    setTeams(t.data as Team[]);
    setInvestors(i.data as Investor[]);
    setVotes(new Map((v.data as Vote[]).map((x) => [voteKey(x), x])));
    setSettings(st.data as Settings);
    resetAt.current = (st.data as Settings).reset_at;
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
        if (st.reset_at !== resetAt.current) reload();
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

  const setCurrentSlot = useCallback(async (slotId: string | null) => {
    setSettings((s) => (s ? { ...s, current_slot_id: slotId } : s));
    await supabase.from("settings").update({ current_slot_id: slotId }).eq("id", 1);
  }, []);

  return {
    slots,
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
    setCurrentSlot,
  };
}
