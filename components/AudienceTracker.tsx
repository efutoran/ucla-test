"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { recordWatching } from "@/lib/audience";
import { useIdentity } from "@/lib/identity";
import type { Settings } from "@/lib/types";

/**
 * Mounted once in the root layout. While a signed-in investor has the app open and visible,
 * records (once per team) that they were watching the "now presenting" team. The admin
 * Results tab counts these rows as the approximate audience for each presentation.
 */
export default function AudienceTracker() {
  const { identity } = useIdentity();
  const investorId = identity?.role === "investor" ? identity.id : null;

  useEffect(() => {
    if (!investorId) return;
    let currentTeam: string | null = null;
    const record = () => currentTeam && recordWatching(currentTeam, investorId);

    supabase
      .from("settings")
      .select("current_team_id")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        currentTeam = (data as Pick<Settings, "current_team_id"> | null)?.current_team_id ?? null;
        record();
      });

    const channel = supabase
      .channel("audience-tracker")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, (p) => {
        currentTeam = (p.new as Settings).current_team_id;
        record();
      })
      .subscribe();

    const onVisible = () => record();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [investorId]);

  return null;
}
