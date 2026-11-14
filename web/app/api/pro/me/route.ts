// What the browser may know about the person looking: signed in or not, their plan, which features are open to them,
// and whether PickLab is open to them. The nav and the pricing page ask this instead of the page being rendered per person.
import type { Me } from "@/lib/plans";
import { ACCOUNTS } from "@/lib/site";

export async function GET(req: Request): Promise<Response> {
  if (!ACCOUNTS) return new Response("Not found", { status: 404 });
  const [{ PRIVATE, entitlement }, { isInvited }] = await Promise.all([import("@/lib/server/entitlement"), import("@/lib/server/picklab")]);
  const ent = await entitlement(req.headers);
  const me: Me = { ...ent, picklab: isInvited(ent.email) };  // from the setting alone: no extra database query
  return Response.json(me, { headers: PRIVATE });
}
