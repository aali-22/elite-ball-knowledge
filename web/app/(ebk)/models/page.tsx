import { Hydrate } from "@/components/ebk/Hydrate";
import { Q } from "@/lib/ebk-queries";
import { seeds } from "@/lib/server/ebk";
import { ModelsView } from "./view";

export default async function Page() {
  const s = await seeds();
  await s.seed(Q.record());
  return <Hydrate state={s.state()}><ModelsView /></Hydrate>;
}
