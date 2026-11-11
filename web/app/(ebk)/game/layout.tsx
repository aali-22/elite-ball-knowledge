import type { Metadata } from "next";

export const metadata: Metadata = { title: "Game breakdown", description: "One game told as a scroll: what decides it, where it tilts, who they are, how it can go." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
