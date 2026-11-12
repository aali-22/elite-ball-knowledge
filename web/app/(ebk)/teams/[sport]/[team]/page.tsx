import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q, SHAPE } from "@/lib/ebk-queries";
import type { Schemas } from "@/lib/http";
import { load, seeds } from "@/lib/server/ebk";
import { TeamView } from "./view";

type Team = Schemas["TeamPage"];
type P = { params: Promise<{ sport: string; team: string }> };
const ok = (sport: string, team: string) => SHAPE.sport.test(sport.toLowerCase()) && SHAPE.team.test(team);

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { sport, team } = await params;
  const t = ok(sport, team) ? await load<Team>(Q.team(sport, team).path).catch(() => undefined) : null;
  if (!t) return { title: t === null ? "Team not found" : "Team" };
  const description = `${t.name}: every trait ranked within the league, with the schedule taken out, plus results, players and what stands out.`;
  return { title: t.name, description, alternates: { canonical: `/teams/${sport}/${team}` }, openGraph: { title: t.name, description } };
}

export default async function Page({ params }: P) {
  const { sport, team } = await params;
  if (!ok(sport, team)) notFound();
  const s = await seeds();
  if ((await s.seed<Team>(Q.team(sport, team))) === null) notFound();
  return <Hydrate state={s.state()}><TeamView sport={sport} team={team} /></Hydrate>;
}
