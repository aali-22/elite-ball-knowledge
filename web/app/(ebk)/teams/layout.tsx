import type { Metadata } from "next";

export const metadata: Metadata = { title: "Team", description: "A team's identity, strongest to weakest, with its form and its players." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
