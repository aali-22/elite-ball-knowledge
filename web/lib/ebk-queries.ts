// Where each piece of the public site's data lives: the key the browser caches it under and the API path it comes
// from (under /api/public in the browser, /public on the API). One list for the browser's hooks (lib/ebk.ts) and for the server's first render (lib/server/ebk.ts), so the
// page the server sends and the page the browser takes over always mean the same data. No "use client": both sides
// import it.

export const slug = (id: string) => id.replace(":", "-");
/** A team's address (api/ebk/teams.team_slug): college codes in lower case with "&" as "-and-" and a space as "-"
 *  ("TA&M" → "ta-and-m", "M-OH" → "m-oh"); every other league's code (and soccer's "soc:" id) as `slug` writes it.
 *  The API reads an address back by looking it up among the league's codes, so the two never have to be undone. */
export const COLLEGE = ["ncaaf", "ncaab"];
export const teamSlug = (sport: string, team: string) =>
  COLLEGE.includes(sport) ? team.toLowerCase().replace(/&/g, "-and-").replace(/ /g, "-") : slug(team);

export type Query = { key: readonly (string | number | null)[]; path: string };

/** Soccer competitions (api/ebk/soccer.py): each is its own league, so a soccer league, stat, team or comparison is
 *  always asked for within one ("eng.1" when none is named). Other sports have one league and ignore it. */
export const COMPETITIONS: { code: string; name: string; country?: string; tag?: string }[] = [
  { code: "eng.1", name: "Premier League", country: "England", tag: "ENG" }, { code: "uefa.champions", name: "Champions League" },
  { code: "esp.1", name: "LaLiga", country: "Spain", tag: "ESP" }, { code: "ita.1", name: "Serie A", country: "Italy", tag: "ITA" },
  { code: "ger.1", name: "Bundesliga", country: "Germany", tag: "GER" }, { code: "fra.1", name: "Ligue 1", country: "France", tag: "FRA" },
];
export const competitionName = (code?: string | null) => COMPETITIONS.find((c) => c.code === code)?.name ?? null;
const comp = (sport: string, c?: string | null) => (sport === "soccer" ? c || COMPETITIONS[0].code : null);
const cq = (sport: string, c?: string | null, sep = "?") => (comp(sport, c) ? `${sep}competition=${comp(sport, c)}` : "");

export const Q = {
  slate: (sport?: string | null, days = 4): Query => ({ key: ["ebk", "slate", sport ?? "all", days], path: `/analytics/slate?days=${days}${sport ? `&sport=${sport}` : ""}` }),
  game: (id: string): Query => ({ key: ["ebk", "game", id], path: `/analytics/game/${id}` }),
  history: (id: string): Query => ({ key: ["ebk", "history", id], path: `/analytics/game/${id}/history` }),
  tree: (id: string): Query => ({ key: ["ebk", "tree", id], path: `/analytics/game/${id}/tree` }),
  league: (sport: string, c?: string | null): Query => ({ key: ["ebk", "league", sport, comp(sport, c)], path: `/analytics/league/${sport}${cq(sport, c)}` }),
  leaders: (sport: string): Query => ({ key: ["ebk", "leaders", sport], path: `/analytics/leaders/${sport}` }),
  // a soccer club's page names its competition only when asked for one that isn't its own league (the API's default)
  team: (sport: string, team: string, c?: string | null): Query => ({ key: ["ebk", "team", sport, team, sport === "soccer" ? c ?? null : null],
    path: `/analytics/team/${sport}/${encodeURIComponent(team)}${sport === "soccer" && c ? `?competition=${c}` : ""}` }),
  player: (id: string): Query => ({ key: ["ebk", "player", id], path: `/analytics/player/${id}` }),
  findings: (sport?: string | null, kind?: string | null): Query => ({ key: ["ebk", "findings", sport ?? "all", kind ?? "all"],
    path: `/analytics/findings?days=5&limit=600${sport ? `&sport=${sport}` : ""}${kind ? `&kind=${kind}` : ""}` }),
  record: (): Query => ({ key: ["ebk", "record"], path: "/analytics/record" }),
  compare: (sport: string, a: string, b: string, c?: string | null): Query => ({ key: ["ebk", "compare", sport, a, b, comp(sport, c)], path: `/analytics/compare/${sport}/${teamSlug(sport, a)}/${teamSlug(sport, b)}${cq(sport, c)}` }),
  sources: (): Query => ({ key: ["public", "sources"], path: "/sources" }),
  // how fresh the site's data is: when the database was built and each league's newest board
  meta: (): Query => ({ key: ["ebk", "meta"], path: "/meta" }),
  // the findings on games from now to two days out, strongest first: the home page's edges and each board row's reasons
  // one team stat across the whole league: the field a finding's chart is drawn on
  trait: (sport: string, trait: string, c?: string | null): Query => ({ key: ["ebk", "trait", sport, trait, comp(sport, c)], path: `/analytics/trait/${sport}/${trait}${cq(sport, c)}` }),
  edges: (): Query => ({ key: ["ebk", "edges"], path: "/analytics/findings?days=2&limit=300" }),
};

/** What each kind of route parameter looks like. Checked before any is put in an API path: a parameter that doesn't
 *  fit is a 404 without a request, so made-up addresses cost the API (and the server's stored copies) nothing. */
export const SHAPE = {
  game: /^(nba|nfl|soc|ncaaf)[-:][A-Za-z0-9_.]{3,40}$/,
  sport: /^(nba|nfl|soccer|ncaaf)$/,
  // a code ("GS"), a soccer id, or a college address ("ta-and-m", "m-oh", "usc")
  competition: /^(eng\.1|uefa\.champions|esp\.1|ita\.1|ger\.1|fra\.1)$/,
  team: /^(soc[-:]\d{1,9}|[A-Za-z]{2,4}|[a-z0-9]{1,6}(?:-[a-z0-9]{1,6}){0,4})$/,
  player: /^(nba|nfl)[-:][A-Za-z0-9-]{1,16}$/,
};
