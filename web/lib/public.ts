"use client";

import { useQuery } from "@tanstack/react-query";
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
export const usePublicPicks = (sport?: string) =>
  useQuery({
    queryKey: ["public", "picks", sport ?? "all"], staleTime: 60_000,
    queryFn: () => json<PublicFeed>(`/picks?back=3&days=14&tz=${encodeURIComponent(tz())}${sport ? `&sport=${sport}` : ""}`),
  });

export const usePublicRecords = (days: number, sport?: string) =>
  useQuery({
    queryKey: ["public", "records", days, sport ?? "all"], staleTime: 5 * 60_000,
    queryFn: () => json<PickRecords>(`/records?days=${days}${sport ? `&sport=${sport}` : ""}`),
  });

export const usePublicStrategies = () =>
  useQuery({ queryKey: ["public", "strategies"], staleTime: 5 * 60_000, queryFn: () => json<PublicStrategy[]>("/strategies") });

export const usePublicSources = () =>
  useQuery({ queryKey: ["public", "sources"], staleTime: Infinity, queryFn: () => json<PublicSources>("/sources") });

export const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;
export const american = (n: number | null | undefined) => (n == null ? null : n > 0 ? `+${n}` : `${n}`);
export const pct = (x: number | null | undefined, digits = 0) => (x == null ? "—" : `${(x * 100).toFixed(digits)}%`);
