// The games an invited account follows, kept with the account so every device it signs in on sees the same ones.
//   GET                               { events: [{ id, start }] }, soonest first; games over a week old are cleared
//   PUT { event_id, on, start? }      follows (on) or stops following one game; answers with the new list
// Anyone who may not open PickLab, signed in or not, gets the same "not found" as a site without this handler.
import { and, asc, count, eq, lt } from "drizzle-orm";
import { EVENT_ID } from "@/lib/excerpt-keys";
import { member, sameSite } from "@/lib/server/picklab";
import { ACCOUNTS } from "@/lib/site";

export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };
const MAX = 200;  // games one account may follow at once
const WEEK = 7 * 86_400_000;
const missing = () => Response.json({ detail: "Not found" }, { status: 404, headers: PRIVATE });

async function list(userId: string) {
  const [{ getDb }, { follow }] = await Promise.all([import("@/lib/server/db"), import("@/lib/server/schema")]);
  const rows = await (await getDb()).select({ id: follow.eventId, start: follow.startsAt }).from(follow)
    .where(eq(follow.userId, userId)).orderBy(asc(follow.startsAt), asc(follow.eventId));
  return Response.json({ events: rows.map((r) => ({ id: r.id, start: r.start ? r.start.toISOString() : null })) }, { headers: PRIVATE });
}

export async function GET(req: Request): Promise<Response> {
  if (!ACCOUNTS) return missing();
  const me = await member(req.headers);
  if (!me) return missing();
  const [{ getDb }, { follow }] = await Promise.all([import("@/lib/server/db"), import("@/lib/server/schema")]);
  await (await getDb()).delete(follow).where(and(eq(follow.userId, me.id), lt(follow.startsAt, new Date(Date.now() - WEEK))));
  return list(me.id);
}

export async function PUT(req: Request): Promise<Response> {
  if (!ACCOUNTS) return missing();
  if (!sameSite(req)) return Response.json({ ok: false }, { status: 403, headers: PRIVATE });
  const me = await member(req.headers);
  if (!me) return missing();
  const body = (await req.json().catch(() => null)) as { event_id?: unknown; on?: unknown; start?: unknown } | null;
  const id = body?.event_id, on = body?.on;
  if (typeof id !== "string" || !EVENT_ID.test(id) || typeof on !== "boolean") return Response.json({ ok: false }, { status: 400, headers: PRIVATE });
  let start: Date | null = null;
  if (body?.start != null) {
    const t = typeof body.start === "string" ? Date.parse(body.start) : NaN;
    if (!Number.isFinite(t)) return Response.json({ ok: false }, { status: 400, headers: PRIVATE });
    start = new Date(t);
  }
  const [{ getDb }, { follow }] = await Promise.all([import("@/lib/server/db"), import("@/lib/server/schema")]);
  const db = await getDb(), mine = and(eq(follow.userId, me.id), eq(follow.eventId, id));
  if (!on) {
    await db.delete(follow).where(mine);
    return list(me.id);
  }
  const [had] = await db.select({ id: follow.eventId }).from(follow).where(mine).limit(1);
  if (!had) {
    const [{ n }] = await db.select({ n: count() }).from(follow).where(eq(follow.userId, me.id));
    if (n >= MAX) return Response.json({ ok: false, error: "full" }, { status: 409, headers: PRIVATE });
  }
  await db.insert(follow).values({ userId: me.id, eventId: id, startsAt: start })
    .onConflictDoUpdate({ target: [follow.userId, follow.eventId], set: start ? { startsAt: start } : { eventId: id } });
  return list(me.id);
}
