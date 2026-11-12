import type { Metadata } from "next";

const NAMES: Record<string, string> = { nba: "NBA", nfl: "NFL", soccer: "Soccer" };

// each league's page carries its own name in the tab and in a shared link, not a bare "League"
export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }): Promise<Metadata> {
  const name = NAMES[(await params).sport.toLowerCase()];
  return { title: name ? `${name} league` : "League", description: "Every team on one plot, a power table, player leaders and any trait ranked." };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
