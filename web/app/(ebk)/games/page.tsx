import { Hydrate } from "@/components/ebk/Hydrate";
import { Q } from "@/lib/ebk-queries";
import { seeds } from "@/lib/server/ebk";
import { GamesView } from "./view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await seeds();
  await Promise.all([s.seed(Q.slate(undefined, 10)), s.seed(Q.league("nba"))]);
  return <Hydrate state={s.state()}><GamesView /></Hydrate>;
}
