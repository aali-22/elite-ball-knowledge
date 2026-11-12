import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { SITE } from "@/lib/site";
import { PICKLAB } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", description: `What ${SITE.name} knows about you: almost nothing.`, alternates: { canonical: "/privacy" } };

const ROWS: [string, string][] = [
  ["Accounts", "There are none. Nothing here asks who you are."],
  ["Cookies", "None are set."],
  ["Trackers and analytics", "None. No third-party script is loaded, and the site's security policy forbids loading one."],
  ["What your browser keeps", PICKLAB ? "Two small settings in its own storage, never sent anywhere: your light / dark choice, and that you confirmed your age on the PickLab pages."
    : "One small setting in its own storage, never sent anywhere: your light / dark choice."],
  ["Team logos and player photos", "These load from two image hosts (ESPN's and FotMob's). Like any image on the web, fetching one tells that host your IP address and browser; the request carries no referrer and no cookie from this site."],
  ["Server logs", "The servers keep ordinary request logs (time, address, path, status) to keep the site running and to limit abuse. They are not joined with anything else."],
  ...(PICKLAB ? [["Links out", "Picks link to the articles they came from. Those sites have their own policies."] as [string, string]] : []),
];

export default function Privacy() {
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-6 sm:py-10">
      <PageHeader title="Privacy" eyebrow={<span>The short version: we don&apos;t track you</span>}
        lede="This site has no accounts, no cookies and no trackers. Here is everything that touches your data." />
      <dl className="grid gap-px overflow-hidden rounded-3xl border">
        {ROWS.map(([k, v]) => (
          <div key={k} className="grid gap-1 bg-card p-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <dt className="pl-label pt-0.5 text-[11px]">{k}</dt><dd className="text-sm leading-relaxed text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <section className="grid gap-2 text-sm leading-relaxed text-muted-foreground">
        <h2 className="pl-display text-3xl text-foreground">What this site is</h2>
        <p>Analysis, not advice. Numbers are computed from public box scores and play-by-play; findings are written by fixed rules; nothing here is a prediction of record or a recommendation to bet. Team names and marks belong to their owners and are used to identify the teams.</p>
        <p><Link href="/sources" className="underline decoration-[var(--hot)] decoration-2 underline-offset-4">Sources and method</Link></p>
      </section>
    </main>
  );
}
