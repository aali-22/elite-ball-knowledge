import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";

// PickLab, a section of the public site: public analysts' picks graded on results (api/public/policy.py decides what reaches it).
export const metadata: Metadata = {
  title: "PickLab: analyst picks, graded",
  description: "Free expert picks from public articles, graded on results, with every pick linked to its source.",
  robots: { index: false, follow: false }, // a rehearsal: no search engine sees it until a real release
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
