import type { Metadata } from "next";

export const metadata: Metadata = { title: "League", description: "Every team on one plot, a power table, player leaders and any trait ranked." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
