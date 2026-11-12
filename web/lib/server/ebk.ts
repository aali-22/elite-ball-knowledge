// The server's side of the public pages: the same documents the browser's hooks read (lib/ebk-queries), fetched here
// so a page arrives with its content in the HTML. Only ever imported by server components.
//
// Read-only and bounded: one GET per document, a short timeout, and a small in-memory cache so many visitors to one
// page cost the API one request a minute. If the API can't be reached the page is still sent, empty, and the browser
// loads the data itself exactly as it did before this file existed.
import { QueryClient, dehydrate, type DehydratedState } from "@tanstack/react-query";
import { headers } from "next/headers";
import type { Query } from "@/lib/ebk-queries";

const API = (process.env.API_BASE ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const TTL_MS = 60_000;
const MAX_ENTRIES = 600;
const TIMEOUT_MS = 4_000;

const cache = new Map<string, { at: number; value: unknown }>();
const flights = new Map<string, Promise<unknown>>();

/** One document from the analytics API: its JSON, or null when the API has none (a 404). Throws if it can't be had. */
export async function load<T>(path: string, forwardedFor?: string | null): Promise<T | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T | null;
  let flight = flights.get(path);
  if (!flight) {
    flight = (async () => {
      const res = await fetch(`${API}/public/analytics${path}`, {
        cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
        // the visitor's address travels with the request, so the API's per-visitor rate limit still means per visitor
        headers: { accept: "application/json", ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}) },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`analytics ${res.status}`);
      return (await res.json()) as unknown;
    })();
    flights.set(path, flight);
    flight.then((value) => {
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);  // oldest out
      cache.set(path, { at: Date.now(), value });
    }, () => {}).finally(() => flights.delete(path));
  }
  return flight as Promise<T | null>;
}

/** What one request gathers for its page: documents put under the keys the browser's hooks will look them up by. */
export class Seeds {
  private qc = new QueryClient();
  constructor(private forwardedFor: string | null) {}

  /** The document, null when there is none, undefined when it couldn't be loaded (the browser will try). */
  async seed<T>(q: Query): Promise<T | null | undefined> {
    try {
      const value = await load<T>(q.path, this.forwardedFor);
      this.qc.setQueryData(q.key, value);
      return value;
    } catch {
      return undefined;
    }
  }

  state(): DehydratedState {
    return dehydrate(this.qc);
  }
}

export async function seeds(): Promise<Seeds> {
  return new Seeds((await headers()).get("x-forwarded-for"));
}
