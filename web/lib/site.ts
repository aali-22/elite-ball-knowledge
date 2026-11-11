// The site's name, sections and zones in one place. The public site (Elite Ball Knowledge) is sports analytics first;
// PickLab (graded analyst records, picks, paper strategies) is one section of it. The Lab (app/lab) is the owner's
// private research app: it exists only in a checkout that has app/lab, which next.config.ts reports as NEXT_PUBLIC_LAB.
export const SITE = {
  name: "Elite Ball Knowledge",
  short: "EBK",
  tagline: "The game, measured.",
  description: "Sports analytics you can check: every team's identity, every matchup's edge and what the numbers say decides the game.",
};

export const LAB = process.env.NEXT_PUBLIC_LAB === "1";
export const isLab = (path: string) => path === "/lab" || path.startsWith("/lab/");
export const isPickLab = (path: string) => path === "/picklab" || path.startsWith("/picklab/");

export const NAV = [
  { href: "/games", label: "Games", also: ["/game"] },
  { href: "/league/nba", label: "League", also: ["/league", "/teams", "/players"] },
  { href: "/models", label: "Models", also: [] },
  { href: "/picklab", label: "PickLab", also: [] },
];

// Home and away wear the chart kit's two categorical slots everywhere (never a team's own colours or marks): the same
// side is the same colour on every chart of a page. Hex, because the field scenes compute contrast from them.
export const HOME = { ink: "var(--side-a)", hex: "#3987e5" };
export const AWAY = { ink: "var(--side-b)", hex: "#d95926" };
