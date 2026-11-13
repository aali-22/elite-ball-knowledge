// Bring the accounts database up to date with web/migrations: `DATABASE_URL=postgres://… npm run db:migrate`.
// `npm run build` runs it first where DATABASE_URL is set (a host), so a deploy brings its own tables up to date; by
// hand it is needed only for a database the build can't reach.
// A local run needs none of this: the embedded database makes its own tables on first use (lib/server/db.ts).
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
// `--if-set` (the build runs it this way): with no database address there is nothing to do, and that is not an error
if (!url && process.argv.includes("--if-set")) {
  console.log("db:migrate: no DATABASE_URL, nothing to do");
  process.exit(0);
}
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
