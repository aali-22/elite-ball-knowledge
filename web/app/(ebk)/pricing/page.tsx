import { Check } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PlanAction } from "@/components/account/AccountPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { PLANS, type Plan } from "@/lib/plans";
import { paywallOn } from "@/lib/server/paywall";
import { ACCOUNTS } from "@/lib/site";

export const metadata: Metadata = { title: "Plans", description: "What is free and what Pro adds.", alternates: { canonical: "/pricing" } };

// The same page for everyone: it reads the paywall switch, never a session. What the visitor can do about a plan
// (sign in, upgrade, manage) is drawn in the browser by PlanAction. What Pro contains and costs is still a placeholder.
export default async function Page() {
  if (!ACCOUNTS) notFound();
  await connection();  // PAYWALL is read when the page is asked for, not when the site is built
  const beta = !paywallOn();
  const price: Record<Plan, string> = { free: "$0", pro: beta ? "Free during beta" : "Price to be announced" };
  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-6 sm:py-10">
      <PageHeader title="Plans" eyebrow={<span className={beta ? "text-[var(--hot)]" : ""}>{beta ? "Free during beta" : "Free and Pro"}</span>}
        lede={beta ? "Everything is open to everyone while the site is in beta. Nothing is for sale yet." : "Reading the site is free. Pro adds the tools for taking the numbers elsewhere."} />
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(PLANS) as Plan[]).map((id) => (
          <section key={id} className={`pl-reading grid content-start gap-4 rounded-3xl border p-5 sm:p-6 ${id === "pro" ? "border-[var(--hot)]/50" : ""}`}>
            <header className="grid gap-1">
              <h2 className="pl-display text-5xl">{PLANS[id].name}</h2>
              <p className="pl-label text-[11px] text-muted-foreground">{price[id]}</p>
            </header>
            <p className="text-sm text-muted-foreground">{PLANS[id].line}</p>
            <ul className="grid gap-2 text-sm">
              {PLANS[id].includes.map((x) => <li key={x} className="flex items-start gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0" />{x}</li>)}
            </ul>
            {id === "pro" && <div className="flex flex-wrap items-center gap-2 pt-1"><PlanAction /></div>}
          </section>
        ))}
      </div>
    </main>
  );
}
