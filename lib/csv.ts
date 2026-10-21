import Papa from "papaparse";

export type TeamRow = { name: string; slot: string; description: string };
export type InvestorRow = { name: string };

function parse(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, " "),
      complete: (r) => resolve(r.data),
      error: reject,
    });
  });
}

const pick = (row: Record<string, string>, keys: string[]) => {
  for (const k of keys) if (row[k]?.trim()) return row[k].trim();
  return "";
};

/** Columns: team (or name), slot (or time slot / time), description (optional). */
export async function parseTeams(file: File): Promise<TeamRow[]> {
  const rows = await parse(file);
  return rows
    .map((r) => ({
      name: pick(r, ["team", "team name", "name"]),
      slot: pick(r, ["slot", "time slot", "time", "session"]),
      description: pick(r, ["description", "desc", "tagline"]),
    }))
    .filter((r) => r.name);
}

/** Columns: name (or investor). */
export async function parseInvestors(file: File): Promise<InvestorRow[]> {
  const rows = await parse(file);
  return rows.map((r) => ({ name: pick(r, ["name", "investor", "investor name"]) })).filter((r) => r.name);
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
