// Where a team's page sits in the site, for search engines (a breadcrumb trail). The team's document is the one the
// page itself loads, so this costs no second request; with no team there is no trail.
import { JsonLd, crumbs } from "@/components/common/JsonLd";
import { Q, SHAPE } from "@/lib/ebk-queries";
import type { Schemas } from "@/lib/http";
import { load } from "@/lib/server/ebk";
import { SITE_URL } from "@/lib/site";

const LEAGUE: Record<string, string> = { nba: "NBA", nfl: "NFL", soccer: "Soccer" };

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ sport: string; team: string }> }) {
  const { sport, team } = await params;
  const ok = SHAPE.sport.test(sport.toLowerCase()) && SHAPE.team.test(team);
  const t = ok ? await load<Schemas["TeamPage"]>(Q.team(sport, team).path).catch(() => null) : null;
  return (
    <>
      {t && <JsonLd data={crumbs(SITE_URL, [[LEAGUE[sport.toLowerCase()] ?? "League", `/league/${sport}`], [t.name, `/teams/${sport}/${team}`]])} />}
      {children}
    </>
  );
}
