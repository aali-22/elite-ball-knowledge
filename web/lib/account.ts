"use client";

// The browser's side of accounts: who is looking (asked of /api/pro/me, never baked into a page, so shared pages
// stay the same for everyone) and the calls that sign in, sign out and open Stripe's pages.
import { useQuery } from "@tanstack/react-query";
import type { Entitlement } from "./plans";
import { ACCOUNTS } from "./site";

/** Signed in or not, the plan, and which features are open. Never asked on a site without accounts. */
export const useEntitlement = () => useQuery({
  queryKey: ["account", "me"], enabled: ACCOUNTS, staleTime: 5 * 60_000, retry: false,
  queryFn: async (): Promise<Entitlement> => {
    const res = await fetch("/api/pro/me", { cache: "no-store" });
    if (!res.ok) throw new Error(`account ${res.status}`);
    return res.json();
  },
});

/** A POST to the accounts library: its answer, or an Error carrying its message. */
export async function auth<T = unknown>(path: string, body: object = {}): Promise<T> {
  const res = await fetch(`/api/auth${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && typeof data.message === "string" && data.message) || "That didn't work. Try again.");
  return data as T;
}

/** Signing in, signing out and going to Stripe end in a full page load, never a form post or a popup: the site's
 *  security policy allows forms to post only to itself, and a fresh load drops anything the last person left behind. */
export const go = (url: string) => window.location.assign(url);

/** Stripe's hosted Checkout for the Pro plan, then back to /account. */
export const upgrade = async () => go((await auth<{ url: string }>("/subscription/upgrade", { plan: "pro", successUrl: "/account", cancelUrl: "/pricing", disableRedirect: true })).url);
/** Stripe's hosted Customer Portal: change the card, cancel, see invoices. */
export const manageBilling = async () => go((await auth<{ url: string }>("/subscription/billing-portal", { returnUrl: "/account", disableRedirect: true })).url);
