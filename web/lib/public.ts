"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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

// An analyst's record "this season" is the longest stored window, league by league: it reaches back past the start
// of the NFL and NBA seasons, so it is the season so far.
export const SEASON_DAYS = 120;
/** "site|analyst" → their record in each league asked for. */
export type Tally = Pick<PickRecords["experts"][number], "picks" | "won" | "lost" | "push" | "priced" | "units">
  & Partial<Pick<PickRecords["experts"][number], "priced_all" | "units_all" | "priced_close" | "unpriced">>;
export type SeasonRecords = Map<string, Record<string, Tally>>;
/** Each analyst's line per league. A record that carries season lines (every game since the league's opening day)
 *  is read from them; an older one is asked for league by league over the longest window instead. */
export function useSeasonRecords(sports: string[], enabled = true): SeasonRecords {
  const all = useQuery({
    queryKey: ["public", "records", SEASON_DAYS, "all"], staleTime: 5 * 60_000, enabled,
    queryFn: () => json<PickRecords>(`/records?days=${SEASON_DAYS}`),
  });
  const seasonal = !!all.data?.experts.some((r) => r.season?.length);
  const qs = useQueries({
    queries: sports.map((s) => ({
      queryKey: ["public", "records", SEASON_DAYS, s], staleTime: 5 * 60_000, enabled: enabled && all.isSuccess && !seasonal,
      queryFn: () => json<PickRecords>(`/records?days=${SEASON_DAYS}&sport=${s}`),
    })),
  });
  const stamp = `${all.dataUpdatedAt}|${qs.map((q) => q.dataUpdatedAt).join(",")}`;
  return useMemo(() => {
    const out: SeasonRecords = new Map();
    const key = (r: { site_id?: string | null; label: string }) => `${r.site_id}|${r.label.toLowerCase()}`;
    if (seasonal) {
      for (const r of all.data!.experts) if (r.season?.length) out.set(key(r), Object.fromEntries(r.season.map((l) => [l.sport, l])));
    } else {
      qs.forEach((q, i) => q.data?.experts.forEach((r) => out.set(key(r), { ...(out.get(key(r)) ?? {}), [sports[i]]: r })));
    }
    return out;
  }, [stamp, seasonal, sports.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps -- the results are read when any of them changes
}

// What a record's picks would have returned at a flat stake. A pick is priced at the odds its analyst listed, else at
// the closing price for the same side and line; one with neither is left out and counted. A record from before
// closing prices were kept carries listed odds alone.
export const STAKE = 10;
export type Money = { units: number; priced: number; listed: number; close: number; unpriced: number };
export function moneyOf(r: Tally): Money {
  const whole = (r.priced_all ?? 0) > 0 && (r.priced_all ?? 0) >= r.priced;
  return whole ? { units: r.units_all ?? 0, priced: r.priced_all!, listed: r.priced, close: r.priced_close ?? 0, unpriced: r.unpriced ?? 0 }
    : { units: r.units, priced: r.priced, listed: r.priced, close: 0, unpriced: Math.max(0, r.picks - r.priced) };
}
/** "+$68" / "−$110": units as dollars at the flat stake. */
export const usd = (units: number) => `${units < 0 ? "−" : "+"}$${Math.abs(units * STAKE).toFixed(0)}`;

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
export const OUTLETS: Record<string, string> = { covers: "Covers", bettingpros: "BettingPros", actionnetwork: "Action Network", pickswise: "Pickswise", vsin: "VSiN", docsports: "Doc's Sports" };
export const outlet = (id?: string | null) => (id && OUTLETS[id]) || id || "";
/** An outlet's staff byline, not a named person. */
export const isDesk = (label: string) => /\bstaff\b/i.test(label);
type Rec = PickRecords["experts"][number];
/** Named analysts with enough priced picks to rank by money, most units first. */
export const topAnalysts = (r?: PickRecords | null, n = 3): Rec[] =>
  (r?.experts ?? []).filter((x) => !isDesk(x.label) && moneyOf(x).priced >= MIN_PRICED).sort((a, b) => moneyOf(b).units - moneyOf(a).units).slice(0, n);
