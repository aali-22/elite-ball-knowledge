"use client";

// The analysts' own reasoning beside a line, for the one account allowed to read it. Asked of /api/owner/excerpts only
// when `enabled`; for anyone else that handler does not exist, so a 404 is an answer, never retried.
import { useQueries } from "@tanstack/react-query";
import { useCallback } from "react";
import { lineKey, textKey } from "./excerpt-keys";
import { ApiError } from "./http";
import type { PublicPick } from "./public";

export type Excerpt = { url: string; site: string; author: string | null; paras: string[]; quotes: string[] };
type Keyed = Excerpt & { k: string | null; tk: string };
type Answer = { events: Record<string, Keyed[]> };

const PER_ASK = 40;

async function ask(ids: string[]): Promise<Answer> {
  const res = await fetch(`/api/owner/excerpts?events=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as Answer;
}

// at module level so react-query merges again only when an answer changes, keeping `find` stable between renders
const merge = (rs: { data?: Answer; isPending: boolean }[]) => ({
  events: Object.assign({}, ...rs.map((r) => r.data?.events ?? {})) as Record<string, Keyed[]>,
  ready: rs.every((r) => !r.isPending),
});

const strip = ({ url, site, author, paras, quotes }: Keyed): Excerpt => ({ url, site, author, paras, quotes });

export function useExcerpts(eventIds: string[], enabled: boolean): { find: (eventId: string, pick: PublicPick) => Excerpt[]; ready: boolean } {
  const ids = [...new Set(eventIds)].sort();
  const groups: string[][] = [];
  for (let i = 0; i < ids.length; i += PER_ASK) groups.push(ids.slice(i, i + PER_ASK));
  const { events, ready } = useQueries({
    queries: groups.map((g) => ({
      queryKey: ["owner", "excerpts", g.join(",")], enabled, staleTime: 5 * 60_000, refetchOnWindowFocus: false,
      queryFn: () => ask(g),
      retry: (n: number, e: Error) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
    })),
    combine: merge,
  });
  const find = useCallback((eventId: string, pick: PublicPick): Excerpt[] => {
    if (!enabled) return [];
    const all = events[eventId];
    if (!all?.length) return [];
    const k = lineKey(pick), tk = textKey(pick.text), out: Excerpt[] = [];
    for (const src of pick.sources ?? []) {
      const here = all.filter((x) => x.url === src.url);
      // the same line by its parts first; by its text only where neither side names a different line
      const hit = (k && here.find((x) => x.k === k)) || here.find((x) => x.tk === tk && (!k || !x.k || x.k === k));
      if (hit) out.push(strip(hit));
    }
    return out;
  }, [events, enabled]);
  return { find, ready: enabled ? ready : true };
}
