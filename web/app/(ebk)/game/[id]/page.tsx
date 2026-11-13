// One game, filled in on the server: the board, its tree and past meetings, and the league plot behind it are in the
// HTML that arrives. A game the site has no breakdown for is a real 404.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, crumbs } from "@/components/common/JsonLd";
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q, SHAPE } from "@/lib/ebk-queries";
import { insightTraits } from "@/lib/edges";
import type { Schemas } from "@/lib/http";
import { load, seeds } from "@/lib/server/ebk";
import { SITE_URL } from "@/lib/site";
import { GameView } from "./view";

type Board = Schemas["PublicBoard"];
type P = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const LAB = process.env.NEXT_PUBLIC_LAB === "1";  // a local workspace keeps the soft "no breakdown" page and its link to the Lab
const SPORT_NAME: Record<string, string> = { nba: "Basketball", nfl: "American football", soccer: "Soccer" };

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { id } = await params;
  const b = SHAPE.game.test(id) ? await load<Board>(Q.game(id).path).catch(() => undefined) : null;
  if (!b) return { title: b === null ? "Game not found" : "Game breakdown" };
  // a link to one finding (?f=<its id>) describes that finding, in the preview's words and in its picture
  const f = [(await searchParams).f].flat()[0];
  const shared = f ? b.insights.find((i) => i.id === f) : undefined;
  const lead = shared ?? b.insights.find((i) => i.kind !== "balance");
  const description = lead ? `${lead.title}. ${lead.claim}` : `${b.label}: both teams on one scale, every matchup, and the findings the numbers support.`;
  const title = shared ? `${b.label}: ${shared.title}` : b.label;
  // without a finding in the address the picture is the file beside this page (opengraph-image.tsx)
  const images = shared ? { images: [{ url: `/game/${id}/og?f=${encodeURIComponent(shared.id)}`, width: 1200, height: 630, alt: `${b.label}: ${shared.title}` }] } : {};
  return {
    title: b.label, description, alternates: { canonical: `/game/${id}` },
    openGraph: { title, description, type: "article", url: `/game/${id}`, ...images },
    twitter: { card: "summary_large_image", title, description, ...images },
  };
}

/** What the page is, for search engines: a game between two named teams and where the page sits. The start is given
 *  only when it is the real one (the API marks a placeholder time); no score, no forecast, no price. */
function gameLd(b: Board, id: string) {
  return {
    "@context": "https://schema.org", "@type": "SportsEvent", name: b.label, url: `${SITE_URL}/game/${id}`,
    ...(SPORT_NAME[b.sport] ? { sport: SPORT_NAME[b.sport] } : {}),
    ...(b.start && !b.time_tbd ? { startDate: b.start } : {}),
    homeTeam: { "@type": "SportsTeam", name: b.home.name || b.home.team },
    awayTeam: { "@type": "SportsTeam", name: b.away.name || b.away.team },
  };
}

export default async function Page({ params }: P) {
  const { id } = await params;
  if (!SHAPE.game.test(id)) notFound();
  const s = await seeds();
  const b = await s.seed<Board>(Q.game(id));
  if (b === null && !LAB) notFound();
  if (b) {
    const extras = b.sport === "nba" || b.sport === "nfl";  // the same condition view.tsx asks for them under
    // the first findings' charts are drawn on their stats across the league: those arrive with the page too
    const lead = b.insights.filter((f) => f.kind !== "balance").slice(0, 3).flatMap(insightTraits);
    await Promise.all([s.seed(Q.league(b.sport)), extras ? s.seed(Q.tree(id)) : null, extras ? s.seed(Q.history(id)) : null,
      ...[...new Set(lead)].map((t) => s.seed(Q.trait(b.sport, t)))]);
  }
  return (
    <>
      {b && <JsonLd data={gameLd(b, id)} />}
      {b && <JsonLd data={crumbs(SITE_URL, [["Games", "/games"], [b.label, `/game/${id}`]])} />}
      <Hydrate state={s.state()}><GameView id={id} /></Hydrate>
    </>
  );
}
