"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { AUDIENCE_RECORDED } from "./audience";

type AudienceRow = { team_id: string; investor_id: string };

/** Admin only: every audience row (who watched which presentation), refreshed every 5s. */
export function useAudienceRows() {
  const [rows, setRows] = useState<AudienceRow[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("audience").select("team_id, investor_id").limit(100000);
      if (data) setRows(data as AudienceRow[]);
    };
    load();
    const timer = setInterval(load, 5000);
    window.addEventListener(AUDIENCE_RECORDED, load);
    return () => {
      clearInterval(timer);
      window.removeEventListener(AUDIENCE_RECORDED, load);
    };
  }, []);
  return rows;
}

/**
 * Public: per-team "seen" counts from the team_seen view (counts only, small payload),
 * refreshed every 15s while the page is visible. Empty map if the view isn't installed yet.
 */
export function useSeenCounts() {
  const [seen, setSeen] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.from("team_seen").select("team_id, seen");
      if (data) setSeen(new Map((data as { team_id: string; seen: number }[]).map((r) => [r.team_id, r.seen])));
    };
    load();
    const timer = setInterval(load, 15000);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  return seen;
}
