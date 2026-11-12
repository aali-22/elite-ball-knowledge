import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AccountPanel } from "@/components/account/AccountPanel";
import { SignIn } from "@/components/account/SignIn";
import { PageHeader } from "@/components/common/PageHeader";
import { ACCOUNTS, PICKLAB } from "@/lib/site";

export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

// The one page that is drawn per person: it reads the session, so it is never shared or stored. A site without
// accounts has no such page.
export default async function Page() {
  if (!ACCOUNTS) notFound();
  const [{ entitlement }, { googleOn }, { isLocal }] = await Promise.all([import("@/lib/server/entitlement"), import("@/lib/server/auth"), import("@/lib/server/db")]);
  const me = await entitlement(await headers());
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-6 sm:py-10">
      <PageHeader title="Account" eyebrow={<span>{me.signedIn ? "Your plan and your exports" : "Optional · nothing on the site needs one to read"}</span>} />
      {me.signedIn ? <AccountPanel me={me} picklab={PICKLAB} /> : <SignIn google={googleOn()} resetLinks={isLocal()} />}
    </main>
  );
}
