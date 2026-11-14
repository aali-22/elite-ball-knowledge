// PickLab's waitlist: an email address and when it was added, nothing else. Part of the site only with accounts on
// (the list lives in the accounts database).
//   POST {email}  adds an address (a signed-in visitor's own when none is given). Always the same answer, whether or
//                 not the address was already there, so the list can't be probed for who is on it.
//   GET           the list, for an invited account only (the owner): JSON, or CSV with ?format=csv.
import { count } from "drizzle-orm";
import { sameSite } from "@/lib/server/picklab";
import { ACCOUNTS, PICKLAB } from "@/lib/site";

const PRIVATE = { "Cache-Control": "private, no-store" };
const MAX_ROWS = 50_000;  // a public form must not be a way to fill the database
const PER_HOUR = 8;       // per address it is asked from, per server instance: a brake, not a wall
const seen = new Map<string, number[]>();

function tooMany(req: Request): boolean {
  const from = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now(), recent = (seen.get(from) ?? []).filter((t) => now - t < 3_600_000);
  recent.push(now);
  seen.set(from, recent);
  if (seen.size > 5_000) seen.clear();
  return recent.length > PER_HOUR;
}

export async function POST(req: Request): Promise<Response> {
  if (!ACCOUNTS || !PICKLAB) return new Response("Not found", { status: 404 });
  if (!sameSite(req)) return Response.json({ ok: false }, { status: 403, headers: PRIVATE });
  if (tooMany(req)) return Response.json({ ok: false, error: "Too many tries. Try again in an hour." }, { status: 429, headers: PRIVATE });
  const [{ access, cleanEmail }, { getDb }, { waitlist }] = await Promise.all([import("@/lib/server/picklab"), import("@/lib/server/db"), import("@/lib/server/schema")]);
  const body = (await req.json().catch(() => null)) as { email?: unknown; website?: unknown } | null;
  if (body?.website) return Response.json({ ok: true }, { headers: PRIVATE });  // a field people never see or fill: a script did
  const email = cleanEmail(body?.email) ?? (await access(req.headers)).email;
  if (!email) return Response.json({ ok: false, error: "That doesn't look like an email address." }, { status: 400, headers: PRIVATE });
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(waitlist);
  if (n < MAX_ROWS) await db.insert(waitlist).values({ email }).onConflictDoNothing();
  return Response.json({ ok: true }, { headers: PRIVATE });
}

export async function GET(req: Request): Promise<Response> {
  if (!ACCOUNTS || !PICKLAB) return new Response("Not found", { status: 404 });
  const [{ access }, { getDb }, { waitlist }] = await Promise.all([import("@/lib/server/picklab"), import("@/lib/server/db"), import("@/lib/server/schema")]);
  const me = await access(req.headers);
  if (!me.invited || !me.signedIn) return new Response("Not found", { status: 404, headers: PRIVATE });
  const rows = await (await getDb()).select().from(waitlist).orderBy(waitlist.createdAt);
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const csv = ["email,joined", ...rows.map((r) => `${r.email},${r.createdAt.toISOString()}`)].join("\r\n") + "\r\n";
    return new Response(csv, { headers: { ...PRIVATE, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="waitlist.csv"' } });
  }
  return Response.json({ count: rows.length, people: rows.map((r) => ({ email: r.email, joined: r.createdAt.toISOString() })) }, { headers: PRIVATE });
}
