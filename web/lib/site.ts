// The site's name, sections and zones in one place. The public site (Elite Ball Knowledge) is sports analytics first;
// PickLab is one section of it, by invitation on the public site. LAB is true only in a checkout that
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
// PickLab is part of the site only where it is switched on. Off is the default, so a build that forgets the setting
// publishes the analytics alone: no link to the section, and its pages answer 404.
//   NEXT_PUBLIC_PICKLAB=1     by invitation: the section has one page that says what it is in a line and takes a
//                             waitlist sign-up; only a signed-in account on the owner's list (PICKLAB_ALLOW_EMAILS, a
//                             server setting) sees anything more. Nothing of PickLab appears anywhere else on the site.
//   NEXT_PUBLIC_PICKLAB=open  open to every visitor, and shown on the home page, game pages and in search.
// A local workspace is open unless it is built with NEXT_PUBLIC_PICKLAB=1 (to check the invitation mode there).
export const PICKLAB_OPEN = (LAB && process.env.NEXT_PUBLIC_PICKLAB !== "1") || process.env.NEXT_PUBLIC_PICKLAB === "open";
export const PICKLAB = PICKLAB_OPEN || process.env.NEXT_PUBLIC_PICKLAB === "1";

// Accounts (sign-in, /account, /pricing, the handlers under /api/auth and /api/pro) are part of the site only with
// NEXT_PUBLIC_ACCOUNTS=1. They do not come on with the Lab. Off is the default: no link, and all of those answer 404.
export const ACCOUNTS = process.env.NEXT_PUBLIC_ACCOUNTS === "1";

// Visit counting (lib/analytics.ts) is part of the site only when NEXT_PUBLIC_GA_ID holds a Google Analytics 4
// measurement id. Unset is the default: nothing is loaded, no cookie is set, and every page says so.
export const GA_ID = /^G-[A-Z0-9]{4,20}$/.test(process.env.NEXT_PUBLIC_GA_ID ?? "") ? process.env.NEXT_PUBLIC_GA_ID! : "";
export const ANALYTICS = GA_ID !== "";
// Google Search Console's ownership code (the content of its meta tag), when the owner has one
export const GSC_VERIFICATION = process.env.NEXT_PUBLIC_GSC_VERIFICATION || "";

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
