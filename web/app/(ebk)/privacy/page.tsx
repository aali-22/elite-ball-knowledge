import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsChoice } from "@/components/common/AnalyticsNotice";
import { PageHeader } from "@/components/common/PageHeader";
import { ACCOUNTS, ANALYTICS, PICKLAB, PICKLAB_OPEN, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy", alternates: { canonical: "/privacy" },
  description: ANALYTICS ? `What ${SITE.name} knows about you, and how to turn its visit counter off.` : `What ${SITE.name} knows about you: almost nothing.`,
};

// Every line here is conditional on what the build actually does. With visit counting on (lib/site ANALYTICS) the page
// says which service, what it sets, what it is for and how to stop it; with it off the page says there is none.
const GA_COOKIES = "Google Analytics sets two of its own (_ga and one starting _ga_) to tell one visit from the next, for up to two years, unless you turn analytics off; turning it off removes them. No advertising cookie.";
const KEPT = ["your light / dark choice", ...(ANALYTICS ? ["your analytics choice"] : []), ...(PICKLAB_OPEN ? ["that you confirmed your age on the PickLab pages"] : [])];
const COUNT = ["One small setting", "Two small settings", "Three small settings"][KEPT.length - 1];

const ROWS: [string, React.ReactNode][] = [
  ...(ACCOUNTS ? [
    ["Accounts", (PICKLAB && !PICKLAB_OPEN ? "Optional: the analytics need none. " : "Optional: nothing on the site needs one to read. ") + "An account keeps your email address and a salted hash of your password, or the address Google confirms if you sign in with Google. No profile picture, nothing else."],
    ["Cookies", ANALYTICS ? `${GA_COOKIES} Signing in adds one more, which keeps you signed in and is sent only to this site.`
      : "None until you sign in. Then one, which keeps you signed in and is sent only to this site. No advertising or tracking cookie, ever."],
    ["Payments", "If you buy a plan, you pay on Stripe's own pages. Card details never reach this site; it keeps Stripe's customer number and whether the plan is active."],
  ] as [string, string][] : [
    ["Accounts", "There are none. Nothing here asks who you are."],
    ["Cookies", ANALYTICS ? GA_COOKIES : "None are set."],
  ] as [string, string][]),
  ["Trackers and analytics", ANALYTICS ? (
    <span id="analytics" className="grid scroll-mt-20 gap-2">
      <span>Google Analytics 4, for every visitor, to count visits and see which pages and features get used. Google receives the page address, your browser and device type, and a rough location from your IP address. Its advertising features are off and there are no ads. It is not loaded once you turn it off, or if your browser sends Global Privacy Control. The site&apos;s security policy allows no other third-party script.</span>
      <AnalyticsChoice className="text-foreground" />
    </span>
  ) : "None. No third-party script is loaded, and the site's security policy forbids loading one."],
  ["What your browser keeps", `${COUNT} in its own storage, never sent anywhere: ${KEPT.length > 2 ? `${KEPT.slice(0, -1).join(", ")}, and ${KEPT.at(-1)}` : KEPT.join(", and ")}.`],
  ["Team logos and player photos", "These load from two image hosts (ESPN's and FotMob's). Like any image on the web, fetching one tells that host your IP address and browser; the request carries no referrer and no cookie from this site."],
  ["Server logs", "The servers keep ordinary request logs (time, address, path, status) to keep the site running and to limit abuse. They are not joined with anything else."],
  ...(PICKLAB_OPEN ? [["Links out", "Picks link to the articles they came from. Those sites have their own policies."] as [string, string]] : []),
  ...(PICKLAB && !PICKLAB_OPEN && ACCOUNTS ? [["The PickLab waitlist", "If you join it, your email address and the date are kept, to send your invitation and for nothing else. It is not shared or used for any other mail."] as [string, string]] : []),
];

export default function Privacy() {
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-6 sm:py-10">
      <PageHeader title="Privacy" eyebrow={<span>{ANALYTICS ? "The short version: visits are counted, and you can turn that off" : "The short version: we don't track you"}</span>}
        lede={ANALYTICS ? `Visits are counted with Google Analytics, with its advertising features off. No ads${ACCOUNTS ? ", and no account unless you choose to sign in" : ", no accounts"}. Here is everything that touches your data.`
          : ACCOUNTS ? "No trackers, and no account or cookie unless you choose to sign in. Here is everything that touches your data."
          : "This site has no accounts, no cookies and no trackers. Here is everything that touches your data."} />
      <dl className="grid gap-px overflow-hidden rounded-3xl border">
        {ROWS.map(([k, v]) => (
          <div key={k} className="grid gap-1 bg-card p-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <dt className="pl-label pt-0.5 text-[11px]">{k}</dt><dd className="text-sm leading-relaxed text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <section className="grid gap-2 text-sm leading-relaxed text-muted-foreground">
        <h2 className="pl-display text-3xl text-foreground">What this site is</h2>
        <p>Analysis, not advice. Numbers are computed from public box scores and play-by-play; findings are written by fixed rules; nothing here is a prediction of record or a recommendation of any kind. Team names and marks belong to their owners and are used to identify the teams.</p>
        <p><Link href="/sources" className="underline decoration-[var(--hot)] decoration-2 underline-offset-4">Sources and method</Link></p>
      </section>
    </main>
  );
}
