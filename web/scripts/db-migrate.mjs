// Bring the accounts database up to date with web/migrations: `DATABASE_URL=postgres://… npm run db:migrate`.
// Run it once before accounts are first switched on at a host, and again after any change to lib/server/schema.ts.
// A local run needs none of this: the embedded database makes its own tables on first use (lib/server/db.ts).
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error("db:migrate needs DATABASE_URL set to a postgres:// address");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  console.log("accounts database is up to date");
} finally {
  await pool.end();
}
