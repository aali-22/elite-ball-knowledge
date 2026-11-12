// The home page, filled in on the server: the slate, tonight's edges and the league plot are in the HTML that arrives (lib/server/ebk),
// and view.tsx takes it over in the browser.
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q } from "@/lib/ebk-queries";
import { boardDay, pickEdges, teamTraits } from "@/lib/edges";
import type { Schemas } from "@/lib/http";
import { seeds } from "@/lib/server/ebk";
import { HomeView } from "./view";

export default async function Page() {
  const s = await seeds();
  const slate = await s.seed<Schemas["Slate"]>(Q.slate(undefined, 5));
  const sports = slate?.sports ?? [];
  const league = sports.includes("nba") ? "nba" : sports.includes("nfl") ? "nfl" : sports[0] ?? "nba";  // the plot's first league, as view.tsx picks it
  const [, , edges] = await Promise.all([s.seed(Q.league(league)), league === "nba" ? null : s.seed(Q.league("nba")), s.seed<Schemas["Findings"]>(Q.edges())]);
  // each opening card's chart is drawn on its stat across the league: load those too, so the cards arrive drawn
  const deck = pickEdges(edges?.findings ?? [], boardDay((slate?.games ?? []).map((g) => g.start)));
  await Promise.all(deck.flatMap((f) => teamTraits(f).map((t) => s.seed(Q.trait(f.sport, t)))));
  return <Hydrate state={s.state()}><HomeView /></Hydrate>;
}
