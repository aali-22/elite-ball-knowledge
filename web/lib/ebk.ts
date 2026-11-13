"use client";

import { useQuery } from "@tanstack/react-query";
import { Q, slug, type Query } from "./ebk-queries";
import { ApiError, type Schemas } from "./http";
import { fmtDate, fmtTime } from "./localTime";

// The analytics side of the public site (api/public/analytics.py): saved boards as computed stats only, with the
// rule-written findings of api/insights. Read-only.
export type Slate = Schemas["Slate"];
export type SlateGame = Schemas["SlateGame"];
export type Board = Schemas["PublicBoard"];
export type Insight = Schemas["Insight"];
export type League = Schemas["League"];
export type LeagueTeam = Schemas["LeagueTeam"];
export type TeamPage = Schemas["TeamPage"];
export type PlayerPage = Schemas["PlayerPage"];
export type TraitMeta = Schemas["TraitMeta"];
export type TraitValue = Schemas["TraitValue"];
export type MatchupEdge = Schemas["MatchupEdge"];
export type PlayerEdge = Schemas["PlayerMatchupEdge"];
export type OpponentFaced = Schemas["OpponentFaced"];
export type SearchIndex = Schemas["SearchIndex"];
export type Findings = Schemas["Findings"];
export type Finding = Schemas["Finding"];
export type Leaders = Schemas["Leaders"];
export type GameHistory = Schemas["PublicHistory"];
export type GameTree = Schemas["PublicTree"];
export type TrackRecord = Schemas["TrackRecord"];

/** A GET that waits and tries again when the server says "too many requests", so a burst of taps never reads as "not found". */
export async function patient(url: string, tries = 3): Promise<Response> {
  let res = await fetch(url);
  for (let i = 1; i < tries && res.status === 429; i++) {
    const wait = Math.min(6, Math.max(1, Number(res.headers.get("Retry-After")) || 2));
    await new Promise((r) => setTimeout(r, wait * 1000));
    res = await fetch(url);
  }
  return res;
}

async function json<T>(path: string): Promise<T | null> {
  const res = await patient(`/api/public${path}`);
  if (res.status === 404) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export { slug };
/** The name two pages share for one game's crest so it glides between them (a CSS identifier: no dots or colons). */
export const crestName = (eventId: string, i: number) => `crest-${eventId.replace(/[^A-Za-z0-9_-]/g, "-")}-${i}`;
export const gameHref = (eventId: string) => `/game/${slug(eventId)}`;
export const teamHref = (sport: string, team: string) => `/teams/${sport}/${slug(team)}`;
export const playerHref = (id: string) => `/players/${slug(id)}`;

// Every hook reads its key and path from lib/ebk-queries, the same list the server renders from, so a page that
// arrives already filled in is taken over without a second request.
const one = <T,>(q: Query) => () => json<T>(q.path);
export const useSlate = (sport?: string, days = 4) =>
  useQuery({ queryKey: Q.slate(sport, days).key, staleTime: 2 * 60_000, queryFn: async () => (await json<Slate>(Q.slate(sport, days).path))! });
export const useBoard = (id: string) => useQuery({ queryKey: Q.game(id).key, staleTime: 5 * 60_000, queryFn: one<Board>(Q.game(id)) });
export const useLeague = (sport: string) => useQuery({ queryKey: Q.league(sport).key, staleTime: 10 * 60_000, queryFn: one<League>(Q.league(sport)) });
export const useTeam = (sport: string, team: string) =>
  useQuery({ queryKey: Q.team(sport, team).key, staleTime: 10 * 60_000, queryFn: one<TeamPage>(Q.team(sport, team)) });
export const usePlayer = (id: string) => useQuery({ queryKey: Q.player(id).key, staleTime: 10 * 60_000, queryFn: one<PlayerPage>(Q.player(id)) });

export const useGameHistory = (id: string, enabled = true) =>
  useQuery({ queryKey: Q.history(id).key, staleTime: 30 * 60_000, enabled, queryFn: one<GameHistory>(Q.history(id)) });
export const useGameTree = (id: string, enabled = true) =>
  useQuery({ queryKey: Q.tree(id).key, staleTime: 30 * 60_000, enabled, queryFn: one<GameTree>(Q.tree(id)) });
export const useIndex = (enabled = true) =>
  useQuery({ queryKey: ["ebk", "index"], staleTime: 10 * 60_000, enabled, queryFn: () => json<SearchIndex>("/analytics/index") });
export const useFindings = (sport?: string | null, kind?: string | null) =>
  useQuery({ queryKey: Q.findings(sport, kind).key, staleTime: 2 * 60_000, queryFn: one<Findings>(Q.findings(sport, kind)) });
export type TraitLeague = Schemas["TraitLeague"];
export const useTrait = (sport: string, trait: string | null | undefined) =>
  useQuery({ queryKey: Q.trait(sport, trait ?? "").key, staleTime: 10 * 60_000, enabled: !!trait, queryFn: one<TraitLeague>(Q.trait(sport, trait ?? "")) });
export const useEdges = () => useQuery({ queryKey: Q.edges().key, staleTime: 2 * 60_000, queryFn: one<Findings>(Q.edges()) });
export const useTrackRecord = () => useQuery({ queryKey: Q.record().key, staleTime: 10 * 60_000, queryFn: one<TrackRecord>(Q.record()) });
/** How fresh the site's data is (the API's /public/meta). Null from an API that doesn't say. */
export type SiteMeta = { built_at: string | null; boards: Record<string, string> };
export const useSiteMeta = (enabled = true) => useQuery({ queryKey: Q.meta().key, staleTime: 10 * 60_000, enabled, retry: false, queryFn: one<SiteMeta>(Q.meta()) });
export const useLeaders = (sport: string) => useQuery({ queryKey: Q.leaders(sport).key, staleTime: 10 * 60_000, queryFn: one<Leaders>(Q.leaders(sport)) });
export const useCompare = (sport: string, a?: string | null, b?: string | null) =>
  useQuery({ queryKey: a && b ? Q.compare(sport, a, b).key : ["ebk", "compare", sport, a ?? null, b ?? null], staleTime: 10 * 60_000, enabled: !!a && !!b && a !== b,
    queryFn: () => json<Board>(Q.compare(sport, a!, b!).path) });

export const SPORT: Record<string, string> = { nba: "NBA", nfl: "NFL", soccer: "Soccer", mlb: "MLB", nhl: "NHL", ncaaf: "College football", ufc: "UFC", tennis: "Tennis" };
/** What "offense" and "defense" as one number mean in each league: its points measure (api/ebk/analytics HEADLINE). */
export const SIDE_BASIS: Record<string, string> = { nba: "points per 100 possessions", nfl: "points per drive" };
export const SPORT_ORDER = ["mlb", "nfl", "ncaaf", "nhl", "nba", "soccer", "ufc", "tennis"];
export const sportLabel = (k?: string | null) => (k ? SPORT[k] ?? k.toUpperCase() : "");
export { ord } from "./ordinal";
export const pctOf = (t: { adj_percentile?: number | null; percentile?: number | null } | null | undefined) =>
  t == null ? null : t.adj_percentile ?? t.percentile ?? null;
export const rankOf = (t: { adj_rank?: number | null; rank?: number | null }) => t.adj_rank ?? t.rank ?? null;

/** A trait's raw value in its own unit ("54.1%", "+0.08", "112.4"). */
export function fmtValue(v: number | null | undefined, measure?: string) {
  if (v == null) return "—";
  if (measure === "rate" || measure === "share") return `${(v * 100).toFixed(1)}%`;
  if (measure?.startsWith("EPA")) return `${v > 0 ? "+" : ""}${v.toFixed(3)}`;
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/** `tbd`: the day is set but the time isn't, so the time reads "time to be confirmed". */
export function when(start: string | null | undefined, tbd = false, local = false) {
  if (!start) return null;
  const d = new Date(start);
  // lib/localTime: US Eastern until the page is live in the browser (`local` false), then the visitor's own zone.
  // A component that shows this passes useLocalTime() as `local`.
  const day = fmtDate(d, { weekday: "short", month: "short", day: "numeric" }, local);
  if (tbd) return { day, time: "time to be confirmed", date: d, started: false };
  return { day, time: fmtTime(d, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }, local), date: d, started: d.getTime() < Date.now() };
}

export const KIND: Record<Insight["kind"], string> = {
  mismatch: "Mismatch", mirage: "Schedule mirage", hidden: "Better than it looks", real: "The real thing", star: "Player edge",
  clash: "Opposite ends", balance: "The whole board", form: "Form", sim: "Simulation",
};
