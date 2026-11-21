// One soccer competition's league page (/league/soccer/eng.1): each competition is its own league, so a club's
// Premier League and Champions League ranks are two pages, never one plot. A domestic league's page is its table
// (./soccer); the Champions League's is its league phase in bands (./ucl). Other sports have no competitions.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q, SHAPE, competitionName } from "@/lib/ebk-queries";
import { seeds } from "@/lib/server/ebk";
import { SoccerLeagueView } from "../soccer";
import { UclView } from "../ucl";

type P = { params: Promise<{ sport: string; competition: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { sport, competition } = await params;
  const name = competitionName(competition);
  if (sport.toLowerCase() !== "soccer" || !name) return { title: "League" };
  const title = name, description = competition === "uefa.champions" ? "The Champions League's league phase in its three bands, with each club's league, points and ranks."
    : `The ${name} table with form, goal difference and every club ranked in six parts of the game.`;
  const url = `/league/soccer/${competition}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
}

export default async function Page({ params }: P) {
  const { sport, competition } = await params;
  if (sport.toLowerCase() !== "soccer" || !SHAPE.competition.test(competition)) notFound();
  const s = await seeds();
  const league = await s.seed(Q.league("soccer", competition));
  if (!league) notFound();
  return <Hydrate state={s.state()}>{competition === "uefa.champions" ? <UclView /> : <SoccerLeagueView competition={competition} />}</Hydrate>;
}
