import { Hydrate } from "@/components/ebk/Hydrate";
import { Q } from "@/lib/ebk-queries";
import { seeds } from "@/lib/server/ebk";
import { FindingsView } from "./view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await seeds();
  await Promise.all([s.seed(Q.findings(null, null)), s.seed(Q.slate(undefined, 5)), s.seed(Q.league("nba"))]);
  return <Hydrate state={s.state()}><FindingsView /></Hydrate>;
}
