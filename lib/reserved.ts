/**
 * Investor names that can't be picked on the investor sign-in screen (so nobody can vote as
 * them from /vote). The admin console's "Vote as" can still use them. Matched ignoring case
 * and extra spaces.
 */
const RESERVED_INVESTOR_NAMES = ["Eric Futoran", "Alice Kao"];

const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
const reserved = new Set(RESERVED_INVESTOR_NAMES.map(normalize));

export const isReservedInvestor = (name: string) => reserved.has(normalize(name));

/**
 * Investors (e.g. the professor) whose votes are left out entirely in the view-only admin
 * console: counts, results, participation, vote log and exports. The full admin sees them.
 */
const HIDDEN_FROM_VIEWER_NAMES = ["Eric Futoran"];
const hiddenFromViewer = new Set(HIDDEN_FROM_VIEWER_NAMES.map(normalize));

export const isHiddenFromViewer = (name: string) => hiddenFromViewer.has(normalize(name));
