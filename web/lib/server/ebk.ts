// The server's side of the public pages: the same documents the browser's hooks read (lib/ebk-queries), fetched here
// so a page arrives with its content in the HTML. Only ever imported by server components.
//
// Read-only and bounded: one GET per document with a short timeout. Each answer is kept in the framework's data cache
// and served from there, refreshed in the background once it is a few minutes old, so many visitors cost the API one
// request and a page still renders, from the stored copy, while the API is asleep or restarting (the refresh is what
// wakes it). The data itself changes about once a day. With nothing stored and no API, the page is still sent, empty,
// and the browser loads the data itself.
import { QueryClient, dehydrate, type DehydratedState } from "@tanstack/react-query";
import { connection } from "next/server";
import type { Query } from "@/lib/ebk-queries";

const API = (process.env.API_BASE ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const FRESH_S = Number(process.env.EBK_FRESH_SECONDS) || 300;  // how long a stored answer is served before it is refreshed
const TIMEOUT_MS = 4_000;

/** One document from the API: its JSON, or null when the API has none (a 404). Throws if it can't be had.
 *  `fresh`: seconds a stored answer is served before it is refreshed (a page is rebuilt no more often than its
 *  shortest one). */
export async function load<T>(path: string, fresh = FRESH_S): Promise<T | null> {
  const res = await fetch(`${API}/public${path}`, {
    next: { revalidate: fresh }, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`api ${res.status}`);
  return (await res.json()) as T;
}

/** What one request gathers for its page: documents put under the keys the browser's hooks will look them up by. */
export class Seeds {
  private qc = new QueryClient();

  /** The document, null when there is none, undefined when it couldn't be loaded (the browser will try). */
  async seed<T>(q: Query): Promise<T | null | undefined> {
    try {
      const value = await load<T>(q.path);
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

/** Starts a page's gathering. Awaiting the connection makes the page render per request, never once at build time
 *  (when there is no API to ask), without switching the data cache off the way `force-dynamic` would. */
export async function seeds(): Promise<Seeds> {
  await connection();
  return new Seeds();
}
