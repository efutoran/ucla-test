"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { recordWatching } from "@/lib/audience";
import { useIdentity } from "@/lib/identity";
import type { Settings } from "@/lib/types";

const RECHECK_MS = 20_000;

/**
 * Mounted once in the root layout. While a signed-in investor has the app open and visible,
 * records (once per team) that they were watching the "now presenting" team. The admin
 * Results tab counts these rows as the approximate audience for each presentation.
 *
 * Phones drop the realtime connection when locked, so the current team is re-fetched
 * (not just remembered) whenever the page becomes visible, the connection comes back,
 * and every 20s while visible.
 */
export default function AudienceTracker() {
  const { identity } = useIdentity();
  const investorId = identity?.role === "investor" ? identity.id : null;

  useEffect(() => {
    if (!investorId) return;

    const recheck = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.from("settings").select("current_team_id").eq("id", 1).single();
      const teamId = (data as Pick<Settings, "current_team_id"> | null)?.current_team_id;
      if (teamId) recordWatching(teamId, investorId);
    };

    recheck();
    const channel = supabase
      .channel("audience-tracker")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, (p) => {
        const teamId = (p.new as Settings).current_team_id;
        if (teamId) recordWatching(teamId, investorId);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") recheck(); // catch up after a dropped connection
      });

    const timer = setInterval(recheck, RECHECK_MS);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", recheck);
      supabase.removeChannel(channel);
    };
  }, [investorId]);

  return null;
}
