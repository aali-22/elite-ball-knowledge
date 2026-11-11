import type { Metadata } from "next";

export const metadata: Metadata = { title: "Findings", description: "Everything the numbers noticed across the slate, strongest first." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
