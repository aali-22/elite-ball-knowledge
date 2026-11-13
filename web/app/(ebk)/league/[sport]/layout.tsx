import type { Metadata } from "next";

const NAMES: Record<string, string> = { nba: "NBA", nfl: "NFL", soccer: "Soccer" };

// each league's page carries its own name in the tab and in a shared link, not a bare "League"
export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }): Promise<Metadata> {
  const sport = (await params).sport.toLowerCase(), name = NAMES[sport];
  if (!name) return { title: "League", description: "Every team on one plot, a power table, player leaders and any trait ranked." };
  const title = `${name} league`, description = `Every ${name} team on one plot, a power table, player leaders and any stat ranked across the league.`;
  return { title, description, alternates: { canonical: `/league/${sport}` }, openGraph: { title, description, url: `/league/${sport}` } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
