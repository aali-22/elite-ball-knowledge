// The accounts database. Only ever imported by server code, and only reached when accounts are on (lib/site
// ACCOUNTS): importing this file opens nothing; the first getDb() does.
//
// Two homes. With DATABASE_URL it is that Postgres (a hosted site). Without it, on this machine only, it is PGlite:
// Postgres compiled to run inside this process, its files under web/.data (git-ignored), its tables made on first
// use from web/migrations. A hosted site never falls back to PGlite: a host's disk does not last, so accounts kept
// there would vanish on the next deploy. It refuses to start instead.
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { SITE_URL } from "@/lib/site";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const HOST_MARKS = ["VERCEL", "RENDER", "NETLIFY", "FLY_APP_NAME", "RAILWAY_ENVIRONMENT", "K_SERVICE", "AWS_LAMBDA_FUNCTION_NAME", "DYNO"];
/** True on the owner's own machine: no hosting platform's mark in the environment, and the site's address is this machine. */
export const isLocal = () => !HOST_MARKS.some((k) => process.env[k]) && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(SITE_URL);

/** Where the local database keeps its files, or null for one that lives in memory (ACCOUNTS_DB_DIR=memory: tests). */
export function localDir(): string | null {
  const dir = process.env.ACCOUNTS_DB_DIR;
  return dir === "memory" ? null : path.resolve(dir || path.join(process.cwd(), ".data", "accounts"));
}

export const MIGRATIONS = path.join(process.cwd(), "migrations");

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("accounts: DATABASE_URL must be a postgres:// address");
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    return drizzle(new Pool({ connectionString: url, max: 5 }), { schema });  // its tables come from `npm run db:migrate`
  }
  if (!isLocal()) throw new Error("accounts: no DATABASE_URL on this host. The built-in database is for local runs only.");
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = localDir();
  if (dir) mkdirSync(dir, { recursive: true });
  const db = drizzle(new PGlite(dir ?? undefined), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}

// One connection per process, kept on globalThis so a dev server's hot reloads (and the separate bundles a build makes
// for pages and route handlers) share it: two PGlite instances on one folder would corrupt it.
const hold = globalThis as { __ebkAccountsDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  return (hold.__ebkAccountsDb ??= open().catch((e) => { hold.__ebkAccountsDb = undefined; throw e; }));
}
