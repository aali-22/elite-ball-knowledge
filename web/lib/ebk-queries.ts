// Where each piece of the public site's data lives: the key the browser caches it under and the API path it comes
// from. One list for the browser's hooks (lib/ebk.ts) and for the server's first render (lib/server/ebk.ts), so the
// page the server sends and the page the browser takes over always mean the same data. No "use client": both sides
// import it.

export const slug = (id: string) => id.replace(":", "-");

export type Query = { key: readonly (string | number | null)[]; path: string };

export const Q = {
  slate: (sport?: string | null, days = 4): Query => ({ key: ["ebk", "slate", sport ?? "all", days], path: `/slate?days=${days}${sport ? `&sport=${sport}` : ""}` }),
  game: (id: string): Query => ({ key: ["ebk", "game", id], path: `/game/${id}` }),
  history: (id: string): Query => ({ key: ["ebk", "history", id], path: `/game/${id}/history` }),
  tree: (id: string): Query => ({ key: ["ebk", "tree", id], path: `/game/${id}/tree` }),
  league: (sport: string): Query => ({ key: ["ebk", "league", sport], path: `/league/${sport}` }),
  leaders: (sport: string): Query => ({ key: ["ebk", "leaders", sport], path: `/leaders/${sport}` }),
  team: (sport: string, team: string): Query => ({ key: ["ebk", "team", sport, team], path: `/team/${sport}/${team}` }),
  player: (id: string): Query => ({ key: ["ebk", "player", id], path: `/player/${id}` }),
  findings: (sport?: string | null, kind?: string | null): Query => ({ key: ["ebk", "findings", sport ?? "all", kind ?? "all"],
    path: `/findings?days=5&limit=600${sport ? `&sport=${sport}` : ""}${kind ? `&kind=${kind}` : ""}` }),
  record: (): Query => ({ key: ["ebk", "record"], path: "/record" }),
  compare: (sport: string, a: string, b: string): Query => ({ key: ["ebk", "compare", sport, a, b], path: `/compare/${sport}/${slug(a)}/${slug(b)}` }),
};

/** What a route parameter may look like before it is put in an API path: a code or an id, never a path. */
export const SAFE = /^[A-Za-z0-9_.:-]{1,64}$/;
