"use client";

// Hands the documents the server gathered to the browser's query cache, so the page components render filled in on the
// server and are taken over in the browser without asking for the same data again.
import { HydrationBoundary, type DehydratedState } from "@tanstack/react-query";

export function Hydrate({ state, children }: { state: DehydratedState; children: React.ReactNode }) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
