import type { Metadata } from "next";

export const metadata: Metadata = { title: "How it works", description: "The method behind every page: one league scale, the schedule taken out, attack against defense." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
