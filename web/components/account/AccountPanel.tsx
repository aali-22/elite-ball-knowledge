"use client";

// What a signed-in person sees on /account, and the plan buttons the pricing page shares: the plan, what it opens,
// Stripe's pages for paying and for managing a payment, and the way out.
import { Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Gate } from "@/components/account/Gate";
import { auth, go, manageBilling, upgrade, useEntitlement } from "@/lib/account";
import { fmtDate, useLocalTime } from "@/lib/localTime";
import { PLANS, type Entitlement } from "@/lib/plans";

const PRIMARY = "pl-label inline-flex min-h-11 items-center rounded-full bg-[var(--hot)] px-5 text-[var(--hot-ink)] disabled:opacity-50";
const QUIET = "pl-label inline-flex min-h-11 items-center rounded-full border px-5 hover:bg-muted disabled:opacity-50";

/** A button that runs one of the calls above and shows why if it fails. */
function Act({ run, primary, children }: { run: () => Promise<void>; primary?: boolean; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" disabled={busy} className={primary ? PRIMARY : QUIET}
        onClick={() => { setBusy(true); setError(null); run().catch((e) => { setError(e instanceof Error ? e.message : "That didn't work."); setBusy(false); }); }}>
        {children}
      </button>
      {error && <span role="alert" className="basis-full text-sm text-[var(--hot)]">{error}</span>}
    </>
  );
}

/** The one thing to do about the Pro plan for whoever is looking: make an account, upgrade, or manage the payment. */
export function PlanAction({ me }: { me?: Entitlement }) {
  const asked = useEntitlement();
  const who = me ?? asked.data;
  if (!who) return null;
  if (!who.signedIn) return <Link href="/account" className={QUIET}>Sign in or create an account</Link>;
  if (who.plan === "pro") return who.billing ? <Act run={manageBilling}>Manage billing</Act> : null;
  if (!who.billing) return null;
  return (
    <>
      <Act run={upgrade} primary>Upgrade to Pro</Act>
      {who.billing === "test" && <span className="pl-label basis-full text-[10px] text-muted-foreground">Stripe test mode · no real charge</span>}
    </>
  );
}

const EXPORTS = [
  { href: "/api/pro/export?table=power&sport=nba", label: "NBA power table" },
  { href: "/api/pro/export?table=power&sport=nfl", label: "NFL power table" },
];

export function AccountPanel({ me, picklab, lab = null }: { me: Entitlement; picklab: boolean; lab?: { invited: boolean; listed: boolean } | null }) {
  const local = useLocalTime();
  const until = me.renews ? fmtDate(me.renews, { month: "short", day: "numeric", year: "numeric" }, local) : null;
  const files = picklab ? [...EXPORTS, { href: "/api/pro/export?table=picks", label: "Strategy picks" }] : EXPORTS;
  return (
    <div className="grid gap-px overflow-hidden rounded-3xl border">
      <section className="grid gap-3 bg-card p-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
        <h2 className="pl-label pt-0.5 text-[11px]">Signed in</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 break-all text-sm">{me.email}</span>
          <Act run={async () => { await auth("/sign-out"); go("/"); }}>Sign out</Act>
        </div>
      </section>
      {lab && (
        <section data-picklab-access={lab.invited ? "invited" : lab.listed ? "listed" : "none"} className="grid gap-3 bg-card p-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
          <h2 className="pl-label pt-0.5 text-[11px]">PickLab</h2>
          <div className="flex flex-wrap items-center gap-3">
            {lab.invited ? (
              <>
                <Link href="/picklab" className={PRIMARY}>Open PickLab</Link>
                <a href="/api/pro/waitlist?format=csv" download className={QUIET}><Download aria-hidden className="mr-2 size-3.5" />Waitlist</a>
              </>
            ) : lab.listed ? <span className="text-sm text-muted-foreground">By invitation. You&apos;re on the waitlist.</span>
              : <Link href="/picklab" className={QUIET}>By invitation · join the waitlist</Link>}
          </div>
        </section>
      )}
      <section className="grid gap-3 bg-card p-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
        <h2 className="pl-label pt-0.5 text-[11px]">Plan</h2>
        <div className="grid gap-3">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="pl-display text-4xl">{PLANS[me.plan].name}</span>
            {!me.paywall && <span className="pl-label text-[10px] text-[var(--hot)]">Free during beta · everything is open</span>}
            {me.plan === "pro" && until && <span className="text-sm text-muted-foreground">{me.ending ? "Ends" : "Renews"} {until}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2"><PlanAction me={me} /></div>
        </div>
      </section>
      <section className="grid gap-3 bg-card p-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
        <h2 className="pl-label pt-0.5 text-[11px]">CSV export</h2>
        <Gate feature="export.csv">
          <ul className="flex flex-wrap gap-2">
            {files.map((f) => <li key={f.href}><a href={f.href} download className={QUIET}><Download aria-hidden className="mr-2 size-3.5" />{f.label}</a></li>)}
          </ul>
        </Gate>
      </section>
    </div>
  );
}
