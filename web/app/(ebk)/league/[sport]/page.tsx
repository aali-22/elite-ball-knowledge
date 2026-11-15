import { notFound } from "next/navigation";
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q } from "@/lib/ebk-queries";
import { seeds } from "@/lib/server/ebk";
import { LeagueView } from "./view";

const LEAGUES = ["nba", "nfl", "ncaaf", "soccer"];  // soccer keeps its page by direct link; it is off the picker

export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const sport = (await params).sport.toLowerCase();
  if (!LEAGUES.includes(sport)) notFound();  // no page, and a 404 status, for a league the site doesn't cover
  const s = await seeds();
  await Promise.all([s.seed(Q.league(sport)), sport === "ncaaf" ? null : s.seed(Q.leaders(sport))]);  // college boards carry no players
  return <Hydrate state={s.state()}><LeagueView sport={sport} /></Hydrate>;
}
