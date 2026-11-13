// The same card for a link to one finding of a game: /game/<id>/og?f=<finding id>. The metadata image file beside
// this folder can't see a query, so a shared finding's page points here instead (page.tsx).
import { gameImage } from "@/lib/share-image";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const f = new URL(req.url).searchParams.get("f");
  return gameImage((await params).id, f && f.length <= 120 ? f : null);
}
