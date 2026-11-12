// The home page, filled in on the server: the slate and the league plot are in the HTML that arrives (lib/server/ebk),
// and view.tsx takes it over in the browser.
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q } from "@/lib/ebk-queries";
import type { Schemas } from "@/lib/http";
import { seeds } from "@/lib/server/ebk";
import { HomeView } from "./view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await seeds();
  const slate = await s.seed<Schemas["Slate"]>(Q.slate(undefined, 5));
  const sports = slate?.sports ?? [];
  const league = sports.includes("nba") ? "nba" : sports.includes("nfl") ? "nfl" : sports[0] ?? "nba";  // the plot's first league, as view.tsx picks it
  await Promise.all([s.seed(Q.league(league)), league === "nba" ? null : s.seed(Q.league("nba"))]);
  return <Hydrate state={s.state()}><HomeView /></Hydrate>;
}
