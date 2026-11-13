import type { Metadata } from "next";
import { PICKLAB_OPEN } from "@/lib/site";

// Says what the page is only where PickLab is open to everyone. By invitation, the section's one line (the layout
// above) is all a link preview or a visitor who isn't invited is told.
const title = "Our record · PickLab", description = "The site's own paper strategies, graded like everyone else's, beside control strategies.";
export const metadata: Metadata = PICKLAB_OPEN ? { title, description, alternates: { canonical: "/picklab/strategies" }, openGraph: { title, description, url: "/picklab/strategies" } } : {};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
