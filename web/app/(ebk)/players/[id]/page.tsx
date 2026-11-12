import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q, SHAPE } from "@/lib/ebk-queries";
import type { Schemas } from "@/lib/http";
import { load, seeds } from "@/lib/server/ebk";
import { PlayerView } from "./view";

type Player = Schemas["PlayerPage"];
type P = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const p = SHAPE.player.test(id) ? await load<Player>(Q.player(id).path).catch(() => undefined) : null;
  if (!p) return { title: p === null ? "Player not found" : "Player" };
  const description = `${p.name}, ${p.team_name}: production ranked within his position, and the defenses he meets.`;
  return { title: p.name, description, alternates: { canonical: `/players/${id}` }, openGraph: { title: p.name, description } };
}

export default async function Page({ params }: P) {
  const { id } = await params;
  if (!SHAPE.player.test(id)) notFound();
  const s = await seeds();
  if ((await s.seed<Player>(Q.player(id))) === null) notFound();
  return <Hydrate state={s.state()}><PlayerView id={id} /></Hydrate>;
}
