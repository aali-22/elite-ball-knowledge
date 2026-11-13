// Where a player's page sits in the site, for search engines (a breadcrumb trail): his league, his team, him. The
// player's document is the one the page itself loads, so this costs no second request.
import { JsonLd, crumbs } from "@/components/common/JsonLd";
import { Q, SHAPE } from "@/lib/ebk-queries";
import type { Schemas } from "@/lib/http";
import { load } from "@/lib/server/ebk";
import { SITE_URL } from "@/lib/site";

const LEAGUE: Record<string, string> = { nba: "NBA", nfl: "NFL" };

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = SHAPE.player.test(id) ? await load<Schemas["PlayerPage"]>(Q.player(id).path).catch(() => null) : null;
  return (
    <>
      {p && <JsonLd data={crumbs(SITE_URL, [[LEAGUE[p.sport] ?? "League", `/league/${p.sport}`], [p.team_name, `/teams/${p.sport}/${p.team}`], [p.name, `/players/${id}`]])} />}
      {children}
    </>
  );
}
