"use client";

// The games someone follows (the star on a game). With accounts on they are kept with the account
// (/api/pro/following), so a phone and a laptop signed in to it agree; a site without accounts keeps them in this
// browser only.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { ApiError } from "./http";
import { ACCOUNTS } from "./site";

type Followed = { id: string; start: string | null };
type Answer = { events: Followed[] };
export type Following = { ids: Set<string>; has: (id: string) => boolean; toggle: (id: string, start: string) => void; ready: boolean };

const KEY = ["account", "following"];
const STORE = "picklab-following";
const WEEK = 7 * 86_400_000;

async function call(init?: RequestInit): Promise<Answer> {
  const res = await fetch("/api/pro/following", { cache: "no-store", ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as Answer;
}

const flip = (list: Followed[], id: string, on: boolean, start: string | null) =>
  on ? [...list.filter((x) => x.id !== id), { id, start }] : list.filter((x) => x.id !== id);

function useAccountFollowing(enabled: boolean): Following {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: KEY, enabled, staleTime: 60_000, refetchOnWindowFocus: true,
    queryFn: () => call(),
    retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
  });
  const m = useMutation({
    mutationFn: (v: { id: string; on: boolean; start: string | null }) =>
      call({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_id: v.id, on: v.on, ...(v.start ? { start: v.start } : {}) }) }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: KEY });
      const before = qc.getQueryData<Answer>(KEY);
      qc.setQueryData<Answer>(KEY, { events: flip(before?.events ?? [], v.id, v.on, v.start) });
      return { before };
    },
    onError: (_e, _v, ctx) => { if (ctx) qc.setQueryData(KEY, ctx.before); },
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
  const ids = useMemo(() => new Set((q.data?.events ?? []).map((x) => x.id)), [q.data]);
  const { mutate } = m;
  const toggle = useCallback((id: string, start: string) => {
    if (enabled) mutate({ id, on: !ids.has(id), start: start || null });
  }, [enabled, ids, mutate]);
  const has = useCallback((id: string) => ids.has(id), [ids]);
  return { ids, has, toggle, ready: enabled ? q.isSuccess || q.isError : true };
}

// ---- this browser only (no accounts) -----------------------------------------------------------------------------------
const listeners = new Set<() => void>();
const readRaw = () => { try { return window.localStorage.getItem(STORE) ?? "[]"; } catch { return "[]"; } };
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => { if (e.key === STORE) fn(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
};
const parse = (raw: string): Followed[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is Followed => x && typeof x.id === "string").map((x) => ({ id: x.id, start: typeof x.start === "string" ? x.start : null })) : [];
  } catch { return []; }
};
const fresh = (list: Followed[]) => list.filter((x) => !x.start || !(Date.parse(x.start) < Date.now() - WEEK));
const noop = () => () => {};

function useLocalFollowing(enabled: boolean): Following {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const list = useMemo(() => (enabled ? fresh(parse(raw)) : []), [raw, enabled]);
  const ids = useMemo(() => new Set(list.map((x) => x.id)), [list]);
  const toggle = useCallback((id: string, start: string) => {
    if (!enabled) return;
    const next = flip(fresh(parse(readRaw())), id, !ids.has(id), start || null);
    try { window.localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* storage refused: nothing kept */ }
    for (const fn of listeners) fn();
  }, [enabled, ids]);
  const has = useCallback((id: string) => ids.has(id), [ids]);
  return { ids, has, toggle, ready: hydrated };
}

/** The games this person follows, and a toggle for one. `enabled` false: nothing is asked and nothing changes. */
export function useFollowing(enabled = true): Following {
  // ACCOUNTS is fixed when the site is built, so the same branch runs on every render
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return ACCOUNTS ? useAccountFollowing(enabled) : useLocalFollowing(enabled);
}
