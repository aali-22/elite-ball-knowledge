// Where each piece of the public site's data lives: the key the browser caches it under and the API path it comes
// from (under /api/public in the browser, /public on the API). One list for the browser's hooks (lib/ebk.ts) and for the server's first render (lib/server/ebk.ts), so the
// page the server sends and the page the browser takes over always mean the same data. No "use client": both sides
// import it.

export const slug = (id: string) => id.replace(":", "-");

export type Query = { key: readonly (string | number | null)[]; path: string };

export const Q = {
  slate: (sport?: string | null, days = 4): Query => ({ key: ["ebk", "slate", sport ?? "all", days], path: `/analytics/slate?days=${days}${sport ? `&sport=${sport}` : ""}` }),
  game: (id: string): Query => ({ key: ["ebk", "game", id], path: `/analytics/game/${id}` }),
  history: (id: string): Query => ({ key: ["ebk", "history", id], path: `/analytics/game/${id}/history` }),
  tree: (id: string): Query => ({ key: ["ebk", "tree", id], path: `/analytics/game/${id}/tree` }),
  league: (sport: string): Query => ({ key: ["ebk", "league", sport], path: `/analytics/league/${sport}` }),
  leaders: (sport: string): Query => ({ key: ["ebk", "leaders", sport], path: `/analytics/leaders/${sport}` }),
  team: (sport: string, team: string): Query => ({ key: ["ebk", "team", sport, team], path: `/analytics/team/${sport}/${team}` }),
  player: (id: string): Query => ({ key: ["ebk", "player", id], path: `/analytics/player/${id}` }),
  findings: (sport?: string | null, kind?: string | null): Query => ({ key: ["ebk", "findings", sport ?? "all", kind ?? "all"],
    path: `/analytics/findings?days=5&limit=600${sport ? `&sport=${sport}` : ""}${kind ? `&kind=${kind}` : ""}` }),
  record: (): Query => ({ key: ["ebk", "record"], path: "/analytics/record" }),
  compare: (sport: string, a: string, b: string): Query => ({ key: ["ebk", "compare", sport, a, b], path: `/analytics/compare/${sport}/${slug(a)}/${slug(b)}` }),
  sources: (): Query => ({ key: ["public", "sources"], path: "/sources" }),
};

/** What each kind of route parameter looks like. Checked before any is put in an API path: a parameter that doesn't
 *  fit is a 404 without a request, so made-up addresses cost the API (and the server's stored copies) nothing. */
export const SHAPE = {
  game: /^(nba|nfl|soc)[-:][A-Za-z0-9_.]{3,40}$/,
  sport: /^(nba|nfl|soccer)$/,
  team: /^(soc[-:]\d{1,9}|[A-Za-z]{2,4})$/,
  player: /^(nba|nfl)[-:][A-Za-z0-9-]{1,16}$/,
};
