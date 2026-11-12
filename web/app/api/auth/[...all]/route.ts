// Everything the accounts library answers: sign-up, sign-in, sign-out, password reset, Google's callback, and (when
// billing is set up) Checkout, the Customer Portal and Stripe's webhook. A site without accounts has none of it.
import { ACCOUNTS } from "@/lib/site";

async function handle(req: Request): Promise<Response> {
  if (!ACCOUNTS) return new Response("Not found", { status: 404 });
  const { getAuth } = await import("@/lib/server/auth");  // loaded only where accounts are on
  const res = await (await getAuth()).handler(req);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
