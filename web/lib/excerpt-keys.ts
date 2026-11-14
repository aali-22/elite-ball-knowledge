// Keys that tie an analyst's excerpt to the line it was written about. Pure functions, no "use client" and no server
// import: the excerpts handler and the browser's hook both use them, so the two sides always agree.

/** A game's id as the site writes it: `<sport>:<id>`. Anything else is not a game. */
export const EVENT_ID = /^[a-z]{2,6}:[A-Za-z0-9_.]{3,40}$/;

/** The text of a line reduced to what names it: lower case, prices like (-110) / +150 and the word "points" dropped,
 *  then only letters, digits and `. + -` kept. The same reduction the API uses to merge two articles' same line. */
export function textKey(text: string | null | undefined): string {
  const t = (text ?? "").toLowerCase().replace(/\(\s*[+-]?\d{3,4}\s*\)|[+-]\d{3,4}\b|\bpoints?\b/g, "");
  return t.replace(/[^a-z0-9.+-]/g, "");
}

type Parts = { market?: string | null; player_name?: string | null; side?: string | null; line?: number | string | null };

/** `market|player|side|line`, lower-cased, or null when there is no market or no side to name. */
export function lineKey(p: Parts | null | undefined): string | null {
  if (!p || !p.market || !p.side) return null;
  const n = p.line == null || p.line === "" ? NaN : Number(p.line);
  const line = Number.isFinite(n) ? String(n) : p.line == null ? "" : String(p.line);
  return [p.market, p.player_name ?? "", p.side, line].map((s) => String(s).toLowerCase()).join("|");
}
