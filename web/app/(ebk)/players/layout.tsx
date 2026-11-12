import type { Metadata } from "next";

// no title here: each page sets its own (the game, the team, the player), and a title set in a layout would drop the
// site-wide "· Elite Ball Knowledge" suffix from it
export const metadata: Metadata = { description: "A player's production ranked at the position, against recent opponents." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
