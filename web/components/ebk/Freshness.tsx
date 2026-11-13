// How old the site's data is, on every page. The numbers come from a database built about twice a day on the
// owner's machine; if that stops, the site keeps serving the last build, and this line is how a reader can tell.
// The server asks the API when the database was built (a stored answer, a few minutes old at most) so the time is in
// the page it sends; where it can't (the API asleep, or a page built ahead of time) the browser asks instead.
import { load } from "@/lib/server/ebk";
import type { SiteMeta } from "@/lib/ebk";
import { Q } from "@/lib/ebk-queries";
import { FreshLine } from "./FreshLine";

const META_FRESH_S = 900;

export async function Freshness() {
  let meta: SiteMeta | null = null;
  try {
    // asked for at most every 15 minutes: this line is on every page, including the ones that are otherwise built once
    // and never change (privacy, the method), and it must not make those rebuild every few minutes for a time that
    // changes twice a day
    meta = await load<SiteMeta>(Q.meta().path, META_FRESH_S);
  } catch {
    meta = null;
  }
  return <FreshLine meta={meta} />;
}
