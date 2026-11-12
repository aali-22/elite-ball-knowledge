import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { PICKLAB } from "@/lib/site";

// PickLab, a section of the public site: public analysts' picks graded on results (api/public/policy.py decides what reaches it).
export const metadata: Metadata = {
  title: "PickLab: analyst picks, graded",
  description: "Free expert picks from public articles, graded on results, with every pick linked to its source.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  if (!PICKLAB) notFound();  // a site without PickLab has no such pages (lib/site PICKLAB)
  return <PublicShell>{children}</PublicShell>;
}
