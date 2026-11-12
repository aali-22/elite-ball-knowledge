import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sources · PickLab", description: "Where every number and every pick on the site comes from." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
