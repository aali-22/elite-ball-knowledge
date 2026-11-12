// The site's name, sections and zones in one place. The public site (Elite Ball Knowledge) is sports analytics first;
// PickLab (graded analyst records, picks, paper strategies) is one section of it. LAB is true only in a checkout that
// carries a local workspace in app/lab, which next.config.ts reports as NEXT_PUBLIC_LAB.
export const SITE = {
  name: "Elite Ball Knowledge",
  short: "EBK",
  tagline: "The game, measured.",
  description: "Sports analytics you can check: every team's identity, every matchup's edge and what the numbers say decides the game.",
};

// Where the site lives and whether search engines may index it. Both come from the environment at build time, so a
// preview or a local run is never indexed by accident: set NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_INDEXABLE=1 to launch.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const INDEXABLE = process.env.NEXT_PUBLIC_INDEXABLE === "1";

export const LAB = process.env.NEXT_PUBLIC_LAB === "1";
export const isLab = (path: string) => path === "/lab" || path.startsWith("/lab/");
export const isPickLab = (path: string) => path === "/picklab" || path.startsWith("/picklab/");
// PickLab (analyst picks, records, paper strategies) is part of the site only where it is switched on: always in a
// local workspace, and in a public build only with NEXT_PUBLIC_PICKLAB=1. Off is the default, so a build that forgets
// the setting publishes the analytics alone: no link to the section, and its pages answer 404.
export const PICKLAB = LAB || process.env.NEXT_PUBLIC_PICKLAB === "1";

export const NAV = [
  { href: "/games", label: "Games", also: ["/game"] },
  { href: "/findings", label: "Findings", also: [] },
  { href: "/league/nba", label: "League", also: ["/league", "/teams", "/players"] },
  { href: "/compare", label: "Compare", also: [] },
  ...(PICKLAB ? [{ href: "/picklab", label: "PickLab", also: [] as string[] }] : []),
];

// Home and away wear the chart kit's two categorical slots everywhere (never a team's own colours or marks): the same
// side is the same colour on every chart of a page. Hex, because the field scenes compute contrast from them.
export const HOME = { ink: "var(--side-a)", hex: "#3987e5" };
export const AWAY = { ink: "var(--side-b)", hex: "#d95926" };
