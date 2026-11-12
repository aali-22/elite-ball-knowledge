// The first paid feature: a table as a CSV file. GET /api/pro/export?table=power&sport=nba is the league power table
// exactly as the League page shows it; ?table=picks is the paper strategies' pick history, where PickLab is on.
// The rows come from the same shared documents the pages use (lib/server/ebk load); only the permission is per person.
import { Q, SHAPE } from "@/lib/ebk-queries";
import type { Schemas } from "@/lib/http";
import { ACCOUNTS, PICKLAB } from "@/lib/site";

type Cell = string | number | boolean | null | undefined;

/** One CSV line. A text cell that a spreadsheet would run as a formula is made plain text. */
const line = (cells: Cell[]) => cells.map((c) => {
  if (c == null) return "";
  const s = typeof c === "string" && /^[=+\-@\t\r]/.test(c) ? `'${c}` : String(c);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(",");

function powerTable(league: Schemas["League"]): string {
  const rows = league.teams.filter((t) => t.offense != null && t.defense != null).map((t) => {
    const offense = Math.round(t.offense! * 100), defense = Math.round(t.defense! * 100);
    return { t, offense, defense, overall: Math.round((offense + defense) / 2) };
  // this season's teams are ranked against each other; a team still on last season's numbers follows, unranked
  }).sort((a, b) => Number(!!a.t.carried) - Number(!!b.t.carried) || b.overall - a.overall);
  return [line(["rank", "team", "name", "wins", "losses", "draws", "overall", "offense", "defense", "last_season_numbers", "as_of"]),
    ...rows.map((r, i) => line([r.t.carried ? null : i + 1, r.t.team, r.t.name, r.t.wins, r.t.losses, r.t.draws, r.overall, r.offense, r.defense, !!r.t.carried, r.t.as_of]))].join("\r\n") + "\r\n";
}

function pickHistory(strategies: Schemas["PublicStrategy"][]): string {
  return [line(["strategy", "selected_at", "sport", "game", "start", "market", "selection", "odds", "result", "units"]),
    ...strategies.flatMap((s) => s.picks.map((p) => line([s.name, p.selected_at, p.sport, p.label, p.start, p.market_label, p.selection, p.odds, p.status, p.units])))].join("\r\n") + "\r\n";
}

export async function GET(req: Request): Promise<Response> {
  if (!ACCOUNTS) return new Response("Not found", { status: 404 });
  const { PRIVATE, can, who } = await import("@/lib/server/entitlement");
  const refuse = (status: number, error: string) => Response.json({ error, feature: "export.csv" }, { status, headers: PRIVATE });
  if (!(await can("export.csv", req.headers))) {
    return (await who(req.headers)).user ? refuse(403, "upgrade") : refuse(401, "sign_in");
  }
  const { load } = await import("@/lib/server/ebk");
  const ask = new URL(req.url).searchParams, table = ask.get("table") ?? "power", sport = (ask.get("sport") ?? "nba").toLowerCase();
  let name: string, csv: string;
  try {
    if (table === "power" && SHAPE.sport.test(sport)) {
      const league = await load<Schemas["League"]>(Q.league(sport).path);
      if (!league) return refuse(404, "no_table");
      name = `ebk-power-${sport}`; csv = powerTable(league);
    } else if (table === "picks" && PICKLAB) {
      const strategies = await load<Schemas["PublicStrategy"][]>("/strategies");
      if (!strategies) return refuse(404, "no_table");
      name = "ebk-strategy-picks"; csv = pickHistory(strategies);
    } else return refuse(404, "no_table");
  } catch {
    return refuse(502, "data_unavailable");
  }
  return new Response(csv, { headers: { ...PRIVATE, "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
