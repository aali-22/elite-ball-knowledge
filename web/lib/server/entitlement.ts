// The free / paid check, on the server. Only ever imported by /account and the handlers under /api/pro: no shared
// page reads a session, so shared pages stay the same for everyone and cacheable.
//
// PAYWALL decides whether plans matter at all. Off (the default) every feature is open to everyone and `can` answers
// before a cookie is looked at. On, a feature needs a signed-in account whose plan includes it, and the plan is
// whatever the `subscription` table says: Stripe's webhook writes it, nothing in the browser can.
import { and, eq, inArray } from "drizzle-orm";
import { FEATURES, PLANS, allows, type Entitlement, type Feature, type Plan } from "@/lib/plans";
import { billing, getAuth, hasSessionCookie } from "./auth";
import { getDb } from "./db";
import { paywallOn } from "./paywall";
import { subscription } from "./schema";

export { paywallOn };

/** Headers for anything about one person: never stored by a browser, a proxy or the host's cache. */
export const PRIVATE = { "Cache-Control": "private, no-store" };

type Who = { user: { id: string; email: string; name: string } | null; plan: Plan; renews: Date | null; ending: boolean };
const NOBODY: Who = { user: null, plan: "free", renews: null, ending: false };

/** Who is asking and what plan they are on. No session cookie means no database is opened. */
export async function who(headers: Headers): Promise<Who> {
  if (!hasSessionCookie(headers)) return NOBODY;
  const session = await (await getAuth()).api.getSession({ headers });
  if (!session) return NOBODY;
  const { id, email, name } = session.user;
  const [paid] = await (await getDb()).select().from(subscription)
    .where(and(eq(subscription.referenceId, id), inArray(subscription.status, ["active", "trialing"]))).limit(1);
  const plan: Plan = paid && paid.plan in PLANS ? (paid.plan as Plan) : "free";
  return { user: { id, email, name }, plan, renews: paid?.periodEnd ?? null, ending: Boolean(paid?.cancelAtPeriodEnd || paid?.cancelAt) };
}

/** May this request use the feature? */
export async function can(feature: Feature, headers: Headers): Promise<boolean> {
  if (!paywallOn()) return true;  // the beta: decided before any cookie is read
  return allows((await who(headers)).plan, feature);
}

export async function entitlement(headers: Headers): Promise<Entitlement> {
  const paywall = paywallOn(), me = await who(headers);
  const features = Object.fromEntries((Object.keys(FEATURES) as Feature[]).map((f) => [f, !paywall || allows(me.plan, f)])) as Record<Feature, boolean>;
  return { paywall, signedIn: Boolean(me.user), email: me.user?.email ?? null, plan: me.plan, features, billing: billing(),
    renews: me.renews ? me.renews.toISOString() : null, ending: me.ending };
}
