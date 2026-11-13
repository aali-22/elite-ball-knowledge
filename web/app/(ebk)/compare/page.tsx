// Compare, filled in on the server from the address: the league's teams and, when two are chosen, their what-if board.
import type { Metadata } from "next";
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q, SHAPE, slug } from "@/lib/ebk-queries";
import type { Schemas } from "@/lib/http";
import { load, seeds } from "@/lib/server/ebk";
import { CompareView } from "./view";

type SP = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const LEAGUES = ["nba", "nfl", "soccer"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// A comparison's link names its two teams in the tab and in a preview (the same title view.tsx sets in the browser),
// and is its own canonical address. Without two known teams it is the plain page (the layout's title).
export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  const sp = await searchParams;
  const sport = LEAGUES.includes(one(sp.sport) ?? "") ? one(sp.sport)! : "nba";
  const plain: Metadata = { alternates: { canonical: "/compare" }, openGraph: { title: "Compare two teams", description: "Any two teams set against each other as if they met today.", url: "/compare" } };
  const [qa, qb] = [one(sp.a), one(sp.b)];
  if (!qa || !qb || !SHAPE.team.test(qa) || !SHAPE.team.test(qb)) return plain;
  const league = await load<Schemas["League"]>(Q.league(sport).path).catch(() => null);
  const team = (v: string) => league?.teams.find((t) => slug(t.team).toLowerCase() === slug(v).toLowerCase());
  const a = team(qa), b = team(qb);
  if (!a || !b || a.team === b.team) return plain;
  const title = `${b.name} at ${a.name} · Compare`, url = `/compare?sport=${sport}&a=${slug(a.team)}&b=${slug(b.team)}`;
  const description = `${b.name} and ${a.name} set against each other as if they met today: both identities on one scale, every matchup, and the findings the numbers support.`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
}

export default async function Page({ searchParams }: SP) {
  const sp = await searchParams;
  const sport = LEAGUES.includes(one(sp.sport) ?? "") ? one(sp.sport)! : "nba";
  const s = await seeds();
  const league = await s.seed<Schemas["League"]>(Q.league(sport));
  // the two teams as view.tsx reads them from the address: by code, whatever its case
  const code = (v: string | undefined) => (v && SHAPE.team.test(v) ? league?.teams.find((t) => slug(t.team).toLowerCase() === slug(v).toLowerCase())?.team : undefined);
  const a = code(one(sp.a)), b = code(one(sp.b));
  if (a && b && a !== b) await s.seed(Q.compare(sport, a, b));
  return <Hydrate state={s.state()}><CompareView /></Hydrate>;
}
