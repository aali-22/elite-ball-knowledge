import type { Metadata } from "next";

// no title here: each page sets its own (the game, the team, the player), and a title set in a layout would drop the
// site-wide "· Elite Ball Knowledge" suffix from it
export const metadata: Metadata = { description: "One game told as a scroll: what decides it, where it tilts, who they are, how it can go." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
