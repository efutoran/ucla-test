export type Team = {
  id: string;
  name: string;
  slot_date: string | null; // e.g. "10/28" — admin only
  slot: string | null; // e.g. "10:00"
  description: string | null; // one-liner
  members: string | null; // as entered in the CSV, e.g. "Alice Wu, Ben Ortiz"
  created_at: string;
};
export type Investor = { id: string; name: string; created_at: string };
export type Vote = { investor_id: string; team_id: string; created_at: string };
export type Settings = { id: number; current_team_id: string | null; roster_updated_at: string };

export type Identity =
  | { role: "investor"; id: string; name: string }
  | { role: "team"; id: string; name: string }
  | { role: "admin" };
