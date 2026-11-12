import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analyst records · PickLab", description: "Each public analyst's graded record: won, lost, units and ROI, with the sample behind each." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
