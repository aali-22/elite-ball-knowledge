import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { Waitlist } from "@/components/public/Waitlist";
import { ACCOUNTS, PICKLAB, PICKLAB_OPEN } from "@/lib/site";

// PickLab, a section of the public site. Where it is open to everyone its pages describe themselves in full; where it
// is by invitation (the public site today) the section says one line about itself, to people and to link previews
// alike, and is kept out of search results.
const OPEN = "Free expert picks from public articles, graded on results, with every pick linked to its source.";
export const metadata: Metadata = PICKLAB_OPEN ? {
  title: "PickLab: analyst picks, graded", description: OPEN, alternates: { canonical: "/picklab" },
  openGraph: { title: "PickLab: analyst picks, graded", description: OPEN, url: "/picklab" },
} : {
  title: "PickLab", description: "PickLab grades analysts.", alternates: { canonical: "/picklab" }, robots: { index: false, follow: false },
  openGraph: { title: "PickLab", description: "PickLab grades analysts.", url: "/picklab" },
};

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  if (!PICKLAB) notFound();  // a site without PickLab has no such pages (lib/site PICKLAB)
  if (PICKLAB_OPEN) return <PublicShell>{children}</PublicShell>;
  // by invitation: this layout is drawn per person (it reads the session), and only an invited account gets the pages
  const me = await (await import("@/lib/server/picklab")).access(await headers());
  if (me.invited) {
    const owner = await (await import('@/lib/server/owner')).ownerAccess(await headers());
    return <PublicShell invited owner={owner}>{children}</PublicShell>;
  }
  return <Waitlist accounts={ACCOUNTS} signedIn={me.signedIn} email={me.email} listed={me.listed} />;
}
