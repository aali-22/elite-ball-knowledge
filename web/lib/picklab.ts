// PickLab's reading rules, shared by its pages: which family a pick belongs to, where a game is in its day (up next,
// started, finished), which day it falls on in the reader's own zone, who is on which side, and the address of a
// game's own page. Pure functions: no requests, nothing drawn.
import type { PublicGame, PublicPick } from "./public";

export type Kind = "sides" | "totals" | "props" | "other";
export const KINDS: Kind[] = ["sides", "totals", "props", "other"];
export const KIND_LABEL: Record<Kind, string> = { sides: "Sides", totals: "Totals", props: "Players", other: "Other" };

/** Which family a pick belongs to: a named player makes it a player pick whatever the market is called. */
export function kindOf(p: PublicPick): Kind {
  const m = (p.market ?? "").toLowerCase();
  if (p.player_name) return "props";
  if (/total|rounds|over_under/.test(m) || /\bteam total\b/i.test(p.text)) return "totals";
  if (/spread|moneyline|puck_line|run_line|_ml$|winner/.test(m)) return "sides";
  return "other";
}

export const byKind = (picks: PublicPick[]) => KINDS.map((k) => [k, picks.filter((p) => kindOf(p) === k)] as const).filter(([, ps]) => ps.length > 0);
export const byPlayer = (picks: PublicPick[]) => {
  const out = new Map<string, PublicPick[]>();
  for (const p of picks) if (p.player_name) out.set(p.player_name, [...(out.get(p.player_name) ?? []), p]);
  return [...out].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
};
export const awayName = (g: PublicGame) => g.away_name ?? g.away;
export const homeName = (g: PublicGame) => g.home_name ?? g.home;

const unnamed = (a?: string | null) => !a || /\bstaff\b/i.test(a);
/** One line per analyst at an outlet. The same person repeating a pick is one voice, and an outlet's staff byline is
 * dropped when a named analyst at that outlet made the same pick (it is usually the same article, republished). */
export function voices(p: PublicPick) {
  const seen = new Set<string>();
  const named = new Set(p.sources.filter((s) => !unnamed(s.author)).map((s) => s.site_id));
  return p.sources.filter((s) => {
    if (unnamed(s.author) && named.has(s.site_id)) return false;
    const k = `${s.site_id}|${unnamed(s.author) ? "" : s.author!.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Most-cited first, game lines before player picks: the order a card shows its first few in. */
export const ranked = (picks: PublicPick[]) => [...picks].sort((a, b) => voices(b).length - voices(a).length || Number(!!a.player_name) - Number(!!b.player_name) || KINDS.indexOf(kindOf(a)) - KINDS.indexOf(kindOf(b)));

// ---- where a game is in its day ----
const DONE_AFTER = 5 * 3600_000;  // a game with no final flag yet is treated as over five hours after its start
export type Phase = "next" | "live" | "done";
export function phaseOf(g: PublicGame, now = Date.now()): Phase {
  const t = new Date(g.start).getTime();
  if (g.final || g.picks.some((p) => p.result) || t + DONE_AFTER <= now) return "done";
  return t <= now ? "live" : "next";
}

const pad = (n: number) => String(n).padStart(2, "0");
/** The calendar day a moment falls on in the reader's own time zone, as YYYY-MM-DD. */
export function dayKey(at: string | number | Date) {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** "Today" / "Tomorrow" / "Yesterday" / the weekday, with the date beside it. */
export function dayLabel(key: string, today = dayKey(Date.now())) {
  const d = new Date(`${key}T12:00:00`);
  const diff = Math.round((d.getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
  const title = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : d.toLocaleDateString([], { weekday: "long" });
  return { title, date: d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }) };
}
/** Games grouped by local day, each day's games in start order. */
export function byDay(games: PublicGame[]) {
  const out = new Map<string, PublicGame[]>();
  for (const g of [...games].sort((a, b) => a.start.localeCompare(b.start))) out.set(dayKey(g.start), [...(out.get(dayKey(g.start)) ?? []), g]);
  return out;
}

// ---- a game's own page ----
export const SLUG = /^[a-z]{2,6}-[A-Za-z0-9_.]{3,40}$/;
export const gameSlug = (eventId: string) => eventId.replace(":", "-");
export const fromSlug = (s: string) => s.replace("-", ":");
export const labGameHref = (eventId: string) => `/picklab/game/${gameSlug(eventId)}`;
/** The sports the site's own game breakdowns cover. */
export const hasNumbers = (sport: string) => sport === "nba" || sport === "nfl" || sport === "soccer";

// ---- who is on which side ----
export type Split = { away: string[]; home: string[] };
/** The analysts who took each team on the spread or to win, each counted once per game. */
export function sideSplit(g: PublicGame): Split {
  const away = new Set<string>(), home = new Set<string>();
  const sideOf = (side?: string | null) => {
    if (!side) return null;
    const s = side.toLowerCase();
    if (s === g.away.toLowerCase() || s === awayName(g).toLowerCase()) return away;
    if (s === g.home.toLowerCase() || s === homeName(g).toLowerCase()) return home;
    return null;
  };
  for (const p of g.picks) {
    if (kindOf(p) !== "sides") continue;
    const into = sideOf(p.side);
    if (into) for (const s of voices(p)) into.add(s.author && !unnamed(s.author) ? s.author : `${s.site} staff`);
  }
  // someone listed on both sides (a spread one way, a hedge the other) is not a vote for either
  const both = [...away].filter((n) => home.has(n));
  for (const n of both) { away.delete(n); home.delete(n); }
  return { away: [...away], home: [...home] };
}

/** The final score, read from a graded side or total ("TB 24, CHI 27"); null when no graded pick states it. */
export function finalScore(g: PublicGame): { away: number; home: number } | null {
  for (const p of g.picks) {
    const m = p.result_detail?.match(/^([A-Za-z]+) (\d+), ([A-Za-z]+) (\d+)$/);
    if (!m) continue;
    if (m[1] === g.away && m[3] === g.home) return { away: Number(m[2]), home: Number(m[4]) };
    if (m[1] === g.home && m[3] === g.away) return { away: Number(m[4]), home: Number(m[2]) };
  }
  return null;
}
export const tally = (g: PublicGame) => ({ won: g.picks.filter((p) => p.result === "won").length, lost: g.picks.filter((p) => p.result === "lost").length });
/** A league in three or four letters, for a tight line. */
const SHORT: Record<string, string> = { ncaaf: "CFB", soccer: "SOC" };
export const shortSport = (k: string) => SHORT[k] ?? k.toUpperCase();
/** A pick as written, without the coloured dots one outlet ends its lines with (its own confidence mark, which means nothing here). */
export const pickText = (text: string) => text.replace(/[\u{1F7E0}-\u{1F7EB}\u{1F534}\u{1F535}\u26AA\u26AB]\uFE0F?/gu, "").replace(/\s+$/, "");
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
