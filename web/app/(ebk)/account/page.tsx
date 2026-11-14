/* eslint-disable @next/next/no-html-link-for-pages -- Owner workspace needs a fresh document and its restrictive security policy. */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AccountPanel } from "@/components/account/AccountPanel";
import { SignIn } from "@/components/account/SignIn";
import { PageHeader } from "@/components/common/PageHeader";
import { ACCOUNTS, PICKLAB, PICKLAB_OPEN } from "@/lib/site";

export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

// The one page that is drawn per person: it reads the session, so it is never shared or stored. A site without
// accounts has no such page.
export default async function Page() {
  if (!ACCOUNTS) notFound();
  const [{ entitlement }, { googleOn }, { isLocal }] = await Promise.all([import("@/lib/server/entitlement"), import("@/lib/server/auth"), import("@/lib/server/db")]);
  const asked = await headers();
  const me = await entitlement(asked);
  // by invitation: what this account may do with PickLab (open it, or join its waitlist)
  const lab = PICKLAB && !PICKLAB_OPEN && me.signedIn ? await (await import("@/lib/server/picklab")).access(asked) : null;
  const owner = me.signedIn && await (await import('@/lib/server/owner')).ownerAccess(asked);
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-6 sm:py-10">
      <PageHeader title="Account" eyebrow={<span>{me.signedIn ? "Your plan and your exports" : PICKLAB && !PICKLAB_OPEN ? "Optional · the analytics need no account" : "Optional · nothing on the site needs one to read"}</span>} />
      {owner && <a href="/account/workspace" className="pl-label flex min-h-16 items-center justify-between rounded-2xl bg-[var(--hot)] px-6 text-[var(--hot-ink)]">Your private workspace <span aria-hidden>↗</span></a>}
      {me.signedIn ? <AccountPanel me={me} picklab={PICKLAB_OPEN} lab={lab ? { invited: lab.invited, listed: lab.listed } : null} /> : <SignIn google={googleOn()} resetLinks={isLocal()} />}
    </main>
  );
}
