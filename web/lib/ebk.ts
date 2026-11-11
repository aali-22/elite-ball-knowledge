"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, type Schemas } from "./http";

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

async function json<T>(path: string): Promise<T | null> {
  const res = await fetch(`/api/public/analytics${path}`);
  if (res.status === 404) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const slug = (id: string) => id.replace(":", "-");
export const gameHref = (eventId: string) => `/game/${slug(eventId)}`;
export const teamHref = (sport: string, team: string) => `/teams/${sport}/${slug(team)}`;
export const playerHref = (id: string) => `/players/${slug(id)}`;

export const useSlate = (sport?: string, days = 4) =>
  useQuery({ queryKey: ["ebk", "slate", sport ?? "all", days], staleTime: 2 * 60_000,
    queryFn: async () => (await json<Slate>(`/slate?days=${days}${sport ? `&sport=${sport}` : ""}`))! });
export const useBoard = (id: string) =>
  useQuery({ queryKey: ["ebk", "game", id], staleTime: 5 * 60_000, queryFn: () => json<Board>(`/game/${id}`) });
export const useLeague = (sport: string) =>
  useQuery({ queryKey: ["ebk", "league", sport], staleTime: 10 * 60_000, queryFn: () => json<League>(`/league/${sport}`) });
export const useTeam = (sport: string, team: string) =>
  useQuery({ queryKey: ["ebk", "team", sport, team], staleTime: 10 * 60_000, queryFn: () => json<TeamPage>(`/team/${sport}/${team}`) });
export const usePlayer = (id: string) =>
  useQuery({ queryKey: ["ebk", "player", id], staleTime: 10 * 60_000, queryFn: () => json<PlayerPage>(`/player/${id}`) });

export const useIndex = (enabled = true) =>
  useQuery({ queryKey: ["ebk", "index"], staleTime: 10 * 60_000, enabled, queryFn: () => json<SearchIndex>("/index") });
export const useFindings = (sport?: string | null, kind?: string | null) =>
  useQuery({ queryKey: ["ebk", "findings", sport ?? "all", kind ?? "all"], staleTime: 2 * 60_000,
    queryFn: () => json<Findings>(`/findings?days=5&limit=90${sport ? `&sport=${sport}` : ""}${kind ? `&kind=${kind}` : ""}`) });
export const useLeaders = (sport: string) =>
  useQuery({ queryKey: ["ebk", "leaders", sport], staleTime: 10 * 60_000, queryFn: () => json<Leaders>(`/leaders/${sport}`) });
export const useCompare = (sport: string, a?: string | null, b?: string | null) =>
  useQuery({ queryKey: ["ebk", "compare", sport, a, b], staleTime: 10 * 60_000, enabled: !!a && !!b && a !== b,
    queryFn: () => json<Board>(`/compare/${sport}/${slug(a!)}/${slug(b!)}`) });

export const SPORT: Record<string, string> = { nba: "NBA", nfl: "NFL", soccer: "Soccer", mlb: "MLB", nhl: "NHL", ncaaf: "College football", ufc: "UFC", tennis: "Tennis" };
export const SPORT_ORDER = ["mlb", "nfl", "ncaaf", "nhl", "nba", "soccer", "ufc", "tennis"];
export const sportLabel = (k?: string | null) => (k ? SPORT[k] ?? k.toUpperCase() : "");
export const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
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

export function when(start: string | null | undefined) {
  if (!start) return null;
  const d = new Date(start);
  return { day: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), date: d };
}

export const KIND: Record<Insight["kind"], string> = {
  mismatch: "Mismatch", mirage: "Schedule mirage", hidden: "Better than it looks", real: "The real thing", star: "Player edge",
  clash: "Opposite ends", balance: "The whole board", form: "Form", sim: "Simulation",
};
