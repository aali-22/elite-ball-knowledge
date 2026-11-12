"use client";

import { useQuery } from "@tanstack/react-query";
import { Q } from "./ebk-queries";
import { ApiError, type Schemas } from "./http";

// The PickLab section's data: picks, graded records, paper strategies and the sources page. Read-only: nothing here writes.
export type PublicFeed = Schemas["PublicFeed"];
export type PublicGame = Schemas["PublicGame"];
export type PublicPick = Schemas["PublicPick"];
export type PublicStrategy = Schemas["PublicStrategy"];
export type PublicStrategyPick = Schemas["PublicStrategyPick"];
export type PublicSources = Schemas["PublicSources"];
export type PickRecords = Schemas["PickRecords"];

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`/api/public${path}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Games from three days back (finished, with graded picks) through two weeks ahead. */
export const usePublicPicks = (sport?: string, enabled = true) =>
  useQuery({
    queryKey: ["public", "picks", sport ?? "all"], staleTime: 60_000, enabled,
    queryFn: () => json<PublicFeed>(`/picks?back=3&days=14&tz=${encodeURIComponent(tz())}${sport ? `&sport=${sport}` : ""}`),
  });

export const usePublicRecords = (days: number, sport?: string, enabled = true) =>
  useQuery({
    queryKey: ["public", "records", days, sport ?? "all"], staleTime: 5 * 60_000, enabled,
    queryFn: () => json<PickRecords>(`/records?days=${days}${sport ? `&sport=${sport}` : ""}`),
  });

export const usePublicStrategies = (enabled = true) =>
  useQuery({ queryKey: ["public", "strategies"], staleTime: 5 * 60_000, enabled, queryFn: () => json<PublicStrategy[]>("/strategies") });

export const usePublicSources = () =>
  useQuery({ queryKey: Q.sources().key, staleTime: Infinity, queryFn: () => json<PublicSources>(Q.sources().path) });

export const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;
export const american = (n: number | null | undefined) => (n == null ? null : n > 0 ? `+${n}` : `${n}`);
export const pct = (x: number | null | undefined, digits = 0) => (x == null ? "—" : `${(x * 100).toFixed(digits)}%`);

// Shared reading rules for analyst records (the analysts page, the home page's door and a game's card use the same ones).
export const MIN_GRADED = 10;  // graded picks before a record is more than a small sample
export const MIN_PRICED = 10;  // priced picks before units and ROI are more than noise
export const OUTLETS: Record<string, string> = { covers: "Covers", bettingpros: "BettingPros", actionnetwork: "Action Network" };
export const outlet = (id?: string | null) => (id && OUTLETS[id]) || id || "";
/** An outlet's staff byline, not a named person. */
export const isDesk = (label: string) => /\bstaff\b/i.test(label);
type Rec = PickRecords["experts"][number];
/** Named analysts with enough priced picks to rank by money, most units first. */
export const topAnalysts = (r?: PickRecords | null, n = 3): Rec[] =>
  (r?.experts ?? []).filter((x) => !isDesk(x.label) && x.priced >= MIN_PRICED).sort((a, b) => b.units - a.units).slice(0, n);
