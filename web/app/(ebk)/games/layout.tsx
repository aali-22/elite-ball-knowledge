import type { Metadata } from "next";

export const metadata: Metadata = { title: "Games", description: "Every game with a breakdown: both identities, every matchup and the findings the numbers support." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
