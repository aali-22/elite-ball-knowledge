"use client";

// A filter that lives in the address, so a filtered view can be shared, bookmarked and kept on reload. Read once on
// mount (no Suspense boundary needed) and written back with replaceState, so filtering never adds history entries.
import { useCallback, useEffect, useState } from "react";

export function useUrlState<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(key) as T | null;
    if (raw && (!allowed || allowed.includes(raw))) setValue(raw);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((v: T) => {
    setValue(v);
    const url = new URL(window.location.href);
    if (v === fallback) url.searchParams.delete(key);
    else url.searchParams.set(key, v);
    window.history.replaceState(window.history.state, "", url);
  }, [key, fallback]);
  return [value, set];
}

/** The same for a nullable choice such as a sport ("" = none). */
export function useUrlChoice(key: string): [string | null, (v: string | null) => void] {
  const [v, set] = useUrlState<string>(key, "");
  return [v || null, useCallback((x: string | null) => set(x ?? ""), [set])];
}
