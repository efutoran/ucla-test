import { supabase } from "./supabase";

const recorded = new Set<string>();

/**
 * Records (once per page load) that this investor had the app open while `teamId` was
 * "Now presenting". Only counts while the page is visible. Rows feed the admin 👀 count.
 */
export async function recordWatching(teamId: string, investorId: string) {
  const key = `${teamId}:${investorId}`;
  if (recorded.has(key) || document.visibilityState !== "visible") return;
  recorded.add(key);
  const { error } = await supabase
    .from("audience")
    .upsert({ team_id: teamId, investor_id: investorId }, { onConflict: "team_id,investor_id", ignoreDuplicates: true });
  if (error) recorded.delete(key); // retry on the next trigger
}
