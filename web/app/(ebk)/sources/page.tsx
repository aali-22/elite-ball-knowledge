// Where the numbers come from and what the site leaves out. Its own page, outside PickLab: provenance covers the
// analytics too, and it is there whether or not the site carries PickLab.
import type { Metadata } from "next";
import { Hydrate } from "@/components/ebk/Hydrate";
import { Q } from "@/lib/ebk-queries";
import { seeds } from "@/lib/server/ebk";
import { SourcesView } from "./view";

export const metadata: Metadata = { title: "Sources and method", description: "Where every number on the site comes from, and what the site leaves out and why." };

export default async function Page() {
  const s = await seeds();
  await s.seed(Q.sources());
  return <Hydrate state={s.state()}><SourcesView /></Hydrate>;
}
