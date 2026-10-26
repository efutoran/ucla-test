import type { Team } from "./types";

/** "10/28", "10/28/26", "2026-10-28" → sortable number. Unknown/blank dates sort last. */
function dateKey(d: string | null): number {
  if (!d) return Number.MAX_SAFE_INTEGER;
  let m = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return +m[1] * 10000 + +m[2] * 100 + +m[3];
  m = d.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : 0;
    return year * 10000 + +m[1] * 100 + +m[2];
  }
  return Number.MAX_SAFE_INTEGER - 1;
}

/** "9:30", "10:00 - 10:30", "2pm" → minutes after midnight. Unknown/blank slots sort last. */
function timeKey(s: string | null): number {
  const m = s?.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let h = +m[1];
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 60 + +(m[2] ?? 0);
}

/** Presentation order: date, then time slot, then name. */
export function bySchedule(a: Team, b: Team) {
  return (
    dateKey(a.slot_date) - dateKey(b.slot_date) ||
    timeKey(a.slot) - timeKey(b.slot) ||
    a.name.localeCompare(b.name)
  );
}

/** "10/28 · 10:00" for admin, "10:00" for everyone else. */
export function when(team: Team, withDate = false) {
  return [withDate ? team.slot_date : null, team.slot].filter(Boolean).join(" · ");
}
