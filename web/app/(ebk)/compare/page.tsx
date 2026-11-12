// Compare, filled in on the server from the address: the league's teams and, when two are chosen, their what-if board.
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q, SAFE, slug } from "@/lib/ebk-queries";
import type { Schemas } from "@/lib/http";
import { seeds } from "@/lib/server/ebk";
import { CompareView } from "./view";

export const dynamic = "force-dynamic";
const LEAGUES = ["nba", "nfl", "soccer"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sport = LEAGUES.includes(one(sp.sport) ?? "") ? one(sp.sport)! : "nba";
  const s = await seeds();
  const league = await s.seed<Schemas["League"]>(Q.league(sport));
  // the two teams as view.tsx reads them from the address: by code, whatever its case
  const code = (v: string | undefined) => (v && SAFE.test(v) ? league?.teams.find((t) => slug(t.team).toLowerCase() === slug(v).toLowerCase())?.team : undefined);
  const a = code(one(sp.a)), b = code(one(sp.b));
  if (a && b && a !== b) await s.seed(Q.compare(sport, a, b));
  return <Hydrate state={s.state()}><CompareView /></Hydrate>;
}
