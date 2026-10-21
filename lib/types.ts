export type Slot = { id: string; label: string; sort_order: number };
export type Team = {
  id: string;
  name: string;
  slot_id: string;
  description: string | null;
  sort_order: number;
};
export type Investor = { id: string; name: string; sort_order: number };
export type Vote = { investor_id: string; team_id: string; created_at: string };
export type Settings = { id: number; current_slot_id: string | null; reset_at: string };

export type Identity =
  | { role: "investor"; id: string; name: string }
  | { role: "team"; id: string; name: string }
  | { role: "admin" };
