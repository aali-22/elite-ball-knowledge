// The site's plans and what each one unlocks, in one place. No "use client" and no server import: the pages, the
// browser's hook and the server's check all read this list.
//
// What Pro finally contains and costs is not decided: these entries are placeholders, and the price lives in Stripe
// (STRIPE_PRICE_PRO), never here.
export type Plan = "free" | "pro";

export const PLANS: Record<Plan, { name: string; line: string; includes: string[] }> = {
  free: { name: "Free", line: "Everything on the site today.", includes: ["Every game, team and player page", "Findings and the league tables", "Compare any two teams"] },
  pro: { name: "Pro", line: "For people who take the numbers elsewhere.", includes: ["Everything in Free", "CSV export of the league tables"] },
};

// A feature names the lowest plan that includes it. Adding a paid feature is one line here plus a check where it is
// served (lib/server/entitlement.ts `can`) and, in a page, a <Gate feature="…">.
export const FEATURES = {
  "export.csv": { plan: "pro", label: "CSV export" },
} as const satisfies Record<string, { plan: Plan; label: string }>;
export type Feature = keyof typeof FEATURES;

const RANK: Record<Plan, number> = { free: 0, pro: 1 };
export const allows = (plan: Plan, feature: Feature) => RANK[plan] >= RANK[FEATURES[feature].plan];

/** What GET /api/pro/me tells the browser about the person looking. */
export type Entitlement = {
  paywall: boolean;                  // false = every feature is open to everyone (the beta)
  signedIn: boolean;
  email: string | null;
  plan: Plan;
  features: Record<Feature, boolean>;
  billing: "test" | "live" | null;   // which Stripe mode can take an upgrade here, if any
  renews: string | null;             // when the paid period ends or renews
  ending: boolean;                   // the plan was cancelled and runs out at `renews`
};

/** GET /api/pro/me's whole answer: the entitlement, and whether PickLab is open to this person (an invited account, or
 *  a section open to everyone). */
export type Me = Entitlement & { picklab: boolean };
