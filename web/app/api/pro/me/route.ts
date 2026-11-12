// What the browser may know about the person looking: signed in or not, their plan, which features are open to them.
// The nav and the pricing page ask this instead of the page being rendered per person.
import { ACCOUNTS } from "@/lib/site";

export async function GET(req: Request): Promise<Response> {
  if (!ACCOUNTS) return new Response("Not found", { status: 404 });
  const { PRIVATE, entitlement } = await import("@/lib/server/entitlement");
  return Response.json(await entitlement(req.headers), { headers: PRIVATE });
}
