// Which findings open the home page, shared by the server render and the browser (no "use client": both import it).
import type { Schemas } from "./http";

type Finding = Schemas["Finding"];

const EASTERN = "America/New_York";  // the leagues' own calendar: "tonight" is an Eastern date for every visitor
export const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: EASTERN });
const STARTED_MS = 5 * 3600_000;  // a game counts as tonight's until five hours after its start, like the slate

/** The day the home page is about: the Eastern date of the first game that hasn't finished. */
export function boardDay(starts: (string | null | undefined)[]): string | null {
  const now = Date.now();
  const next = starts.filter((s): s is string => !!s && new Date(s).getTime() > now - STARTED_MS).sort()[0];
  return next ? dayKey(next) : null;
}

/** "Tonight" for today's date, else the weekday. */
export function dayName(key: string): string {
  if (key === dayKey(new Date().toISOString())) return "Tonight";
  return new Date(`${key}T16:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: EASTERN });
}

const PLAYABLE = new Set(["mismatch", "star", "hidden", "mirage", "real", "clash"]);

/** The night's strongest findings, one per game, different kinds first, at most `n`. */
export function pickEdges(all: Finding[], day: string | null, n = 5): Finding[] {
  const tonight = all.filter((f) => PLAYABLE.has(f.insight.kind) && f.start && dayKey(f.start) === day).sort((a, b) => b.insight.score - a.insight.score);
  const out: Finding[] = [], games = new Set<string>(), kinds = new Set<string>();
  for (const pass of [true, false]) {
    for (const f of tonight) {
      if (out.length >= n || games.has(f.event_id) || (pass && kinds.has(f.insight.kind))) continue;
      out.push(f); games.add(f.event_id); kinds.add(f.insight.kind);
    }
  }
  return out.sort((a, b) => b.insight.score - a.insight.score);
}

/** The team stats a finding's chart draws across the league (players are ranked within a position, so not these). */
export const insightTraits = (i: Finding["insight"]): string[] =>
  [...new Set(i.numbers.map((x) => x.trait).filter((t): t is string => !!t && !t.includes(".player.")))];
export const teamTraits = (f: Finding): string[] => insightTraits(f.insight);
