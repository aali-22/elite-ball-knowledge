import type { Metadata } from "next";
import { PICKLAB_OPEN } from "@/lib/site";

// Says what the page is only where PickLab is open to everyone. By invitation, the section's one line (the layout
// above) is all a link preview or a visitor who isn't invited is told.
const title = "Analyst records · PickLab", description = "Each public analyst's graded record: won, lost, units and ROI, with the sample behind each.";
export const metadata: Metadata = PICKLAB_OPEN ? { title, description, alternates: { canonical: "/picklab/experts" }, openGraph: { title, description, url: "/picklab/experts" } } : {};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
