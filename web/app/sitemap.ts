import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { Q, slug } from "@/lib/ebk-queries";
import type { Schemas } from "@/lib/http";
import { load } from "@/lib/server/ebk";
import { ACCOUNTS, PICKLAB_OPEN, SITE_URL } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

// The pages that always exist.
const PAGES: [string, Entry["changeFrequency"], number][] = [
  ["/", "daily", 1], ["/games", "daily", 0.9], ["/findings", "daily", 0.9], ["/league/nba", "daily", 0.8], ["/league/nfl", "daily", 0.8],
  ["/compare", "weekly", 0.6], ["/models", "monthly", 0.6], ["/sources", "monthly", 0.4], ["/privacy", "yearly", 0.2],
  // PickLab's pages are listed only where the section is on (lib/site PICKLAB_OPEN)
  ...(PICKLAB_OPEN ? [["/picklab", "daily", 0.6], ["/picklab/experts", "daily", 0.6], ["/picklab/strategies", "daily", 0.5]] as typeof PAGES : []),
  ...(ACCOUNTS ? [["/pricing", "monthly", 0.3]] as typeof PAGES : []),
];
// The leagues the site lists (the league page's picker). Soccer's pages answer by direct link only, so they stay out.
const LEAGUES = ["nba", "nfl"];
const INDEX = "/analytics/index";  // every game, team and player that has a page: what the search box reads

const fixed = (): Entry[] => PAGES.map(([path, changeFrequency, priority]) => ({ url: `${SITE_URL}${path}`, changeFrequency, priority }));
const date = (iso: string | null | undefined) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d : undefined; };

/** The game, team and player pages, read from the API's own lists. A list that can't be had adds nothing. */
async function pages(): Promise<Entry[]> {
  const got = async <T,>(path: string) => load<T>(path).catch(() => null);
  const [index, slate, ...leagues] = await Promise.all([
    got<Schemas["SearchIndex"]>(INDEX), got<Schemas["Slate"]>(Q.slate(undefined, 5).path), ...LEAGUES.map((s) => got<Schemas["League"]>(Q.league(s).path)),
  ]);
  if (!index) return [];
  const now = Date.now();
  const built = new Map((slate?.games ?? []).map((g) => [g.event_id, date(g.built_at)]));       // a coming game: when its breakdown was made
  const asOf = new Map(leagues.flatMap((l) => (l?.teams ?? []).map((t) => [`${l!.sport}:${t.team}`, date(t.as_of)] as const)));  // a team: its newest numbers
  const listed = <T extends { sport: string }>(rows: T[]) => rows.filter((r) => LEAGUES.includes(r.sport));
  // a game that has been played last changed when it started; one still to come, when its breakdown was made
  const played = (start: string | null) => { const d = date(start); return d && d.getTime() <= now ? d : undefined; };
  return [
    ...listed(index.games).map((g): Entry => ({ url: `${SITE_URL}/game/${slug(g.event_id)}`, lastModified: built.get(g.event_id) ?? played(g.start), changeFrequency: built.has(g.event_id) ? "daily" : "yearly", priority: built.has(g.event_id) ? 0.7 : 0.3 })),
    ...listed(index.teams).map((t): Entry => ({ url: `${SITE_URL}/teams/${t.sport}/${t.team}`, lastModified: asOf.get(`${t.sport}:${t.team}`), changeFrequency: "daily", priority: 0.6 })),
    ...listed(index.players).map((p): Entry => ({ url: `${SITE_URL}/players/${slug(p.player_id)}`, lastModified: asOf.get(`${p.sport}:${p.team}`), changeFrequency: "weekly", priority: 0.4 })),
  ];
}

// Asked for per request, never built once: the games change every day. With the API asleep the fixed pages are still
// listed; the sitemap never fails.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return [...fixed(), ...(await pages().catch(() => []))];
}
