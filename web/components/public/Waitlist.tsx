"use client";

// What PickLab shows a visitor who has not been invited: its name, one line on what it is, and a way to ask for an
// invitation. Deliberately nothing else: no preview, no numbers, no description beyond the line.
import Link from "next/link";
import { useState } from "react";

const FIELD = "h-12 w-full rounded-full border bg-transparent px-5 text-base outline-none focus-visible:border-foreground";
const PRIMARY = "pl-label inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[var(--hot)] px-6 text-[var(--hot-ink)] disabled:opacity-50";

type Props = {
  accounts: boolean;       // the site has accounts (and so somewhere to keep the list)
  signedIn: boolean;
  email: string | null;    // the signed-in visitor's own address
  listed: boolean;         // they are already on the list
};

export function Waitlist({ accounts, signedIn, email, listed }: Props) {
  const [typed, setTyped] = useState(""), [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">(listed ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const join = async (address: string | null) => {
    setState("busy"); setError(null);
    try {
      const res = await fetch("/api/pro/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: address ?? undefined, website: trap }) });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) { setError(body?.error ?? "That didn't work. Try again in a minute."); setState("idle"); return; }
      setState("done");
    } catch {
      setError("That didn't work. Try again in a minute."); setState("idle");
    }
  };
  return (
    <main data-waitlist className="mx-auto grid min-h-[70dvh] w-full max-w-3xl content-center gap-8 px-4 py-16">
      <div className="grid gap-4">
        <span className="pl-label text-[11px] text-[var(--hot)]">By invitation</span>
        <h1 className="pl-display text-[clamp(4rem,16vw,9rem)] leading-[0.85]">Pick<span className="text-[var(--hot)]">Lab</span></h1>
        <p className="pl-matchup text-3xl sm:text-4xl">PickLab grades analysts.</p>
      </div>
      {!accounts ? <p className="text-sm text-muted-foreground">The waitlist opens soon.</p>
        : state === "done" ? (
          <p role="status" className="rounded-3xl border p-5 text-base">You&apos;re on the waitlist{signedIn && email ? <> as <b className="font-medium">{email}</b></> : ""}. We&apos;ll email you when your invitation is ready.</p>
        ) : signedIn && email ? (
          <div className="grid justify-items-start gap-3">
            <button type="button" disabled={state === "busy"} onClick={() => join(null)} className={PRIMARY}>Join the waitlist</button>
            <p className="text-sm text-muted-foreground">You&apos;re signed in as {email}. That address goes on the list.</p>
          </div>
        ) : (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (state !== "busy") void join(typed); }}>
            <label htmlFor="waitlist-email" className="pl-label text-[10px] text-muted-foreground">Join the waitlist</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="waitlist-email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" maxLength={254}
                value={typed} onChange={(e) => setTyped(e.target.value)} className={FIELD} />
              {/* a field no person sees: whatever fills it in is a script, and is quietly ignored */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" />
              <button type="submit" disabled={state === "busy"} className={PRIMARY}>Join the waitlist</button>
            </div>
            <p className="text-xs text-muted-foreground">Your address is used for the invitation and nothing else. <Link href="/privacy" className="underline underline-offset-2">Privacy</Link></p>
          </form>
        )}
      {error && <p role="alert" className="text-sm text-[var(--hot)]">{error}</p>}
      {accounts && !signedIn && <p className="text-sm text-muted-foreground">Already invited? <Link href="/account" className="underline decoration-[var(--hot)] decoration-2 underline-offset-4">Sign in</Link></p>}
    </main>
  );
}
