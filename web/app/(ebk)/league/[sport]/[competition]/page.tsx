// One soccer competition's league page (/league/soccer/eng.1): each competition is its own league, so a club's
// Premier League and Champions League ranks are two pages, never one plot. Other sports have no competitions.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q, SHAPE, competitionName } from "@/lib/ebk-queries";
import { seeds } from "@/lib/server/ebk";
import { LeagueView } from "../view";

type P = { params: Promise<{ sport: string; competition: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { sport, competition } = await params;
  const name = competitionName(competition);
  if (sport.toLowerCase() !== "soccer" || !name) return { title: "League" };
  const title = name, description = `Every ${name} club on one plot, the full table and any stat ranked across the competition.`;
  const url = `/league/soccer/${competition}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
}

export default async function Page({ params }: P) {
  const { sport, competition } = await params;
  if (sport.toLowerCase() !== "soccer" || !SHAPE.competition.test(competition)) notFound();
  const s = await seeds();
  const league = await s.seed(Q.league("soccer", competition));
  if (!league) notFound();
  return <Hydrate state={s.state()}><LeagueView sport="soccer" competition={competition} /></Hydrate>;
}
