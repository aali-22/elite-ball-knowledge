// One game, filled in on the server: the board, its tree and past meetings, and the league plot behind it are in the
// HTML that arrives. A game the site has no breakdown for is a real 404.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q, SHAPE } from "@/lib/ebk-queries";
import type { Schemas } from "@/lib/http";
import { load, seeds } from "@/lib/server/ebk";
import { GameView } from "./view";

type Board = Schemas["PublicBoard"];
const LAB = process.env.NEXT_PUBLIC_LAB === "1";  // a local workspace keeps the soft "no breakdown" page and its link to the Lab

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const b = SHAPE.game.test(id) ? await load<Board>(Q.game(id).path).catch(() => undefined) : null;
  if (!b) return { title: b === null ? "Game not found" : "Game breakdown" };
  const lead = b.insights.find((f) => f.kind !== "balance");
  const description = lead ? `${lead.title}. ${lead.claim}` : `${b.label}: both teams on one scale, every matchup, and the findings the numbers support.`;
  return { title: b.label, description, alternates: { canonical: `/game/${id}` }, openGraph: { title: b.label, description } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SHAPE.game.test(id)) notFound();
  const s = await seeds();
  const b = await s.seed<Board>(Q.game(id));
  if (b === null && !LAB) notFound();
  if (b) {
    const extras = b.sport === "nba" || b.sport === "nfl";  // the same condition view.tsx asks for them under
    await Promise.all([s.seed(Q.league(b.sport)), extras ? s.seed(Q.tree(id)) : null, extras ? s.seed(Q.history(id)) : null]);
  }
  return <Hydrate state={s.state()}><GameView id={id} /></Hydrate>;
}
