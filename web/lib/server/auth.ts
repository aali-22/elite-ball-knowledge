// Sign-in and billing for the site, all inside the web app (the API stays read-only and holds no secret). Only ever
// imported by server code. Nothing is built at import: getAuth() makes the one instance on first use.
//
// - Email and password always. There is no mail provider yet, so a reset link is written to this machine's log on a
//   local run and never anywhere on a hosted one.
// - Google only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
// - Stripe only when STRIPE_SECRET_KEY is set: hosted Checkout and Customer Portal (plain redirects, no Stripe script
//   on the site), a signed webhook, and the `subscription` table it keeps up to date. Test-mode keys only, unless
//   STRIPE_LIVE=1 says the owner means to take real payments.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { SITE, SITE_URL } from "@/lib/site";
import { getDb, isLocal, localDir } from "./db";
import * as schema from "./schema";

const env = (k: string) => process.env[k]?.trim() || undefined;

/** What signs the session cookie. A hosted site must be given one; a local run makes its own once and keeps it
 *  beside the local database, so a restart doesn't sign everyone out. */
function signingKey(): string {
  const given = env("BETTER_AUTH_SECRET");
  if (given) return given;
  if (!isLocal()) throw new Error("accounts: BETTER_AUTH_SECRET is not set");
  const dir = localDir();
  if (!dir) return randomBytes(32).toString("hex");
  const file = path.join(dir, "signing-key");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  mkdirSync(dir, { recursive: true });
  const made = randomBytes(32).toString("hex");
  writeFileSync(file, made, { mode: 0o600 });
  return made;
}

/** Which Stripe mode the keys in the environment are for, or null when billing is not set up. */
export function billing(): "test" | "live" | null {
  const key = env("STRIPE_SECRET_KEY");
  if (!key || !env("STRIPE_WEBHOOK_SECRET") || !env("STRIPE_PRICE_PRO")) return null;
  return /^(sk|rk)_test_/.test(key) ? "test" : "live";
}
export const googleOn = () => Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));

async function stripePlugin(): Promise<BetterAuthPlugin | null> {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) return null;
  const test = /^(sk|rk)_test_/.test(key);
  if (!test && env("STRIPE_LIVE") !== "1") throw new Error("accounts: STRIPE_SECRET_KEY is not a test-mode key (live keys need STRIPE_LIVE=1)");
  const { default: Stripe } = await import("stripe");
  const { stripe } = await import("@better-auth/stripe");
  // STRIPE_API_BASE points the client at a stand-in for Stripe on this machine (tests/accounts.test.mjs). It is
  // honoured only for a test-mode key and a loopback address.
  const base = test && env("STRIPE_API_BASE") ? new URL(env("STRIPE_API_BASE")!) : null;
  const standIn = base && ["127.0.0.1", "localhost"].includes(base.hostname) ? { host: base.hostname, port: Number(base.port), protocol: "http" as const } : {};
  return stripe({
    stripeClient: new Stripe(key, standIn),
    stripeWebhookSecret: env("STRIPE_WEBHOOK_SECRET") ?? "",
    createCustomerOnSignUp: false,  // a Stripe customer is made when someone first upgrades, not for every account
    subscription: { enabled: true, plans: env("STRIPE_PRICE_PRO") ? [{ name: "pro", priceId: env("STRIPE_PRICE_PRO") }] : [] },
  });
}

async function build() {
  const [db, pay] = await Promise.all([getDb(), stripePlugin()]);
  const local = isLocal();
  return betterAuth({
    appName: SITE.name,
    secret: signingKey(),
    // a hosted site answers on its public address; a local run on whatever loopback address and port it was started on
    baseURL: env("BETTER_AUTH_URL") ?? (local ? { allowedHosts: ["localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*"], protocol: "http" as const } : SITE_URL),
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      sendResetPassword: async ({ user, url }) => {
        if (local) console.log(`[accounts] password reset link for ${user.email}: ${url}`);
        else console.warn("[accounts] a password reset was asked for, but no mail provider is set up to send it");
      },
    },
    socialProviders: googleOn() ? {
      // the profile picture is dropped: the site shows none and its security policy would not load one
      google: { clientId: env("GOOGLE_CLIENT_ID")!, clientSecret: env("GOOGLE_CLIENT_SECRET")!, mapProfileToUser: () => ({ image: undefined }) },
    } : undefined,
    plugins: pay ? [pay] : [],
  });
}

type Auth = Awaited<ReturnType<typeof build>>;
const hold = globalThis as { __ebkAuth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  return (hold.__ebkAuth ??= build().catch((e) => { hold.__ebkAuth = undefined; throw e; }));
}

/** The name of the cookie a signed-in browser carries (with the `__Secure-` prefix over https). */
export const hasSessionCookie = (headers: Headers) => /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(headers.get("cookie") ?? "");
