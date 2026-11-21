import { notFound, redirect } from "next/navigation";
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q } from "@/lib/ebk-queries";
import { seeds } from "@/lib/server/ebk";
import { CollegeLeagueView } from "./college";
import { LeagueView } from "./view";

const LEAGUES = ["nba", "nfl", "ncaaf", "soccer"];

export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const sport = (await params).sport.toLowerCase();
  if (!LEAGUES.includes(sport)) notFound();  // no page, and a 404 status, for a league the site doesn't cover
  if (sport === "soccer") redirect("/league/soccer/eng.1");  // soccer is one competition per page (./[competition])
  const s = await seeds();
  await Promise.all([s.seed(Q.league(sport)), sport === "ncaaf" ? null : s.seed(Q.leaders(sport))]);  // college boards carry no players
  // college football has its own page, made for 130-odd teams (backlog I28): conferences first
  return <Hydrate state={s.state()}>{sport === "ncaaf" ? <CollegeLeagueView /> : <LeagueView sport={sport} />}</Hydrate>;
}
