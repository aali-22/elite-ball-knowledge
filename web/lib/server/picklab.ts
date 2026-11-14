// PickLab by invitation, decided on the server. Only ever imported by server code.
//
// Who gets in: a signed-in account whose email is on the owner's list (PICKLAB_ALLOW_EMAILS, comma-separated, set on
// the host and nowhere in the code). Everyone else gets the one-line page with the waitlist. The list is read at
// each request, so it can be set after the owner has made their account: until then it lets nobody in.
//
// What they get: the PickLab documents, fetched from the API with the key only this server holds (PICKLAB_KEY) and
// passed on marked private. The browser never sees the key and the API answers nothing without it, so the gate is
// not something a visitor can step around by asking the API directly.
import { eq } from "drizzle-orm";
import { ACCOUNTS, PICKLAB, PICKLAB_OPEN, SITE_URL } from "@/lib/site";

const API = (process.env.API_BASE ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const PRIVATE = { "Cache-Control": "private, no-store" };
const MAIL = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,185}\.[a-z]{2,24}$/i;

const allowed = () => (process.env.PICKLAB_ALLOW_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
/** A plain, lower-cased email address, or null for anything that isn't one. */
export const cleanEmail = (v: unknown) => (typeof v === "string" && v.trim().length <= 254 && MAIL.test(v.trim()) ? v.trim().toLowerCase() : null);

/** Whether an account with this address may open PickLab. Reads only the setting: no database. */
export const isInvited = (email: string | null | undefined) => PICKLAB && (PICKLAB_OPEN || Boolean(email && allowed().includes(email.toLowerCase())));

/** A form on another site must not be able to post here in a visitor's name. */
export function sameSite(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;  // not a browser's cross-site post
  try {
    const o = new URL(origin).host;
    return o === new URL(req.url).host || o === new URL(SITE_URL).host || o === req.headers.get("host");
  } catch { return false; }
}

/** The signed-in account asking, when it may open PickLab; null for anyone else (and with accounts off). */
export async function member(headers: Headers): Promise<{ id: string; email: string } | null> {
  if (!PICKLAB || !ACCOUNTS) return null;
  const { who } = await import("./entitlement");
  const me = (await who(headers)).user;
  return me && isInvited(me.email) ? { id: me.id, email: me.email.toLowerCase() } : null;
}

export type Access = { invited: boolean; signedIn: boolean; email: string | null; listed: boolean };
const NOBODY: Access = { invited: false, signedIn: false, email: null, listed: false };

/** What the person asking may do with PickLab: open it (`invited`), and whether they are already on its waitlist. */
export async function access(headers: Headers): Promise<Access> {
  if (!PICKLAB) return NOBODY;
  if (PICKLAB_OPEN) return { ...NOBODY, invited: true };
  if (!ACCOUNTS) return NOBODY;  // no accounts on this build: nobody can be recognised, so nobody is let in
  const { who } = await import("./entitlement");
  const me = await who(headers);
  if (!me.user) return NOBODY;
  const email = me.user.email.toLowerCase();
  const invited = allowed().includes(email);
  return { invited, signedIn: true, email, listed: invited ? false : await onWaitlist(email) };
}

async function onWaitlist(email: string): Promise<boolean> {
  const [{ getDb }, { waitlist }] = await Promise.all([import("./db"), import("./schema")]);
  const [row] = await (await getDb()).select({ email: waitlist.email }).from(waitlist).where(eq(waitlist.email, email)).limit(1);
  return Boolean(row);
}

const notFound = () => Response.json({ detail: "Not found" }, { status: 404, headers: PRIVATE });

/** One PickLab document for the browser of someone who may read it; "not found" for anyone else, the same answer a
 *  site with no PickLab gives. `path` is fixed by the route that calls this; only the query comes from the request. */
export async function picklabData(req: Request, path: "/picks" | "/records" | "/strategies"): Promise<Response> {
  if (!PICKLAB) return notFound();
  if (!PICKLAB_OPEN && !(await access(req.headers)).invited) return notFound();
  const key = process.env.PICKLAB_KEY?.trim();
  let res: Response;
  try {
    res = await fetch(`${API}/public${path}${new URL(req.url).search}`, {
      cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { accept: "application/json", ...(key ? { "x-picklab-key": key } : {}) },
    });
  } catch {
    return Response.json({ detail: "The data didn't arrive" }, { status: 502, headers: PRIVATE });
  }
  const pass: Record<string, string> = { "Content-Type": res.headers.get("content-type") ?? "application/json" };
  const wait = res.headers.get("retry-after");
  if (wait) pass["Retry-After"] = wait;
  // open to everyone: the API's own short cache. By invitation: one person's answer, never stored anywhere.
  pass["Cache-Control"] = PICKLAB_OPEN ? res.headers.get("cache-control") ?? "public, max-age=60" : PRIVATE["Cache-Control"];
  return new Response(res.body, { status: res.status, headers: pass });
}
