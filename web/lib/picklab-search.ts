// PickLab's games for the site's search, for the people PickLab is open to. Its own module, loaded only when asked
// for, so the search every visitor gets carries none of it.
import type { QueryClient } from "@tanstack/react-query";
import { awayName, homeName, kindOf, labGameHref } from "./picklab";
import type { PublicFeed } from "./public";

const FILLER = new Set(["moneyline", "over", "under", "or", "better", "alt", "spread", "team", "total", "points", "to", "win", "yes", "no", "the", "ml"]);

export type LabHit = { id: string; label: string; href: string; sport: string; start: string; keys: string[] };

/** One entry per game PickLab holds. A college team is often named only in what was picked on it, so the words of
 *  each game's sides are searchable too. */
export async function labGames(qc: QueryClient): Promise<LabHit[]> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const feed = await qc.ensureQueryData<PublicFeed>({
    queryKey: ["public", "picks", "all"], staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/public/picks?back=3&days=14&tz=${encodeURIComponent(tz)}`);
      if (!res.ok) throw new Error(`feed ${res.status}`);
      return res.json();
    },
  });
  return feed.games.map((g) => {
    const said = g.picks.filter((p) => kindOf(p) === "sides").flatMap((p) => p.text.split(/[^A-Za-z&']+/)).filter((w) => w.length > 2 && !FILLER.has(w.toLowerCase()));
    return { id: `lab:${g.event_id}`, label: `${awayName(g)} at ${homeName(g)}`, href: labGameHref(g.event_id), sport: g.sport, start: g.start,
      keys: [...new Set([g.away, g.home, g.label, ...said])] };
  });
}
