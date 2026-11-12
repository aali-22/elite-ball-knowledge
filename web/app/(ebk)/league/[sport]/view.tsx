"use client";

import { Table, pixel, proportional } from "@astryxdesign/core/Table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Landscape } from "@/components/ebk/Charts";
import { Picker, SportPicker } from "@/components/ebk/Controls";
import { Crest, Face } from "@/components/ebk/Crest";
import { Reveal } from "@/components/motion/Reveal";
import { Seen } from "@/components/motion/Scroll";
import { SIDE_BASIS, SPORT, fmtValue, playerHref, teamHref, useLeaders, useLeague, type TraitLeague } from "@/lib/ebk";
import { DataNote } from "@/components/ebk/DataNote";
import { LeagueSwarm } from "@/components/ebk/LeagueSwarm";
import { StatGlyph, partOf, partOrder, sideOf } from "@/components/ebk/StatGlyph";
import { useNarrow } from "@/lib/useNarrow";
import { LoadError } from "@/components/ebk/LoadError";
import { useUrlState } from "@/lib/urlState";

// Soccer stays off the public picker until it has its own slate, findings and per-league tables (/league/soccer still works)
const SPORTS = ["nba", "nfl"];
type Sort = "overall" | "offense" | "defense";
interface Row extends Record<string, unknown> { team: string; name: string; carried: boolean; record: string; offense: number; defense: number; overall: number; rank: number | null }

export function LeagueView({ sport }: { sport: string }) {
  const router = useRouter();
  const q = useLeague(sport);
  const leaders = useLeaders(sport);
  // the table's sort and the trait being ranked live in the address, so a view can be shared
  const [traitParam, setTrait] = useUrlState<string>("trait", "");
  const trait = traitParam || null;
  const [sort, setSort] = useUrlState<Sort>("sort", "overall", ["overall", "offense", "defense"]);
  const [view, setView] = useUrlState<"raw" | "adj">("numbers", "raw", ["raw", "adj"]);
  const adjusted = view === "adj", setAdjusted = (v: boolean) => setView(v ? "adj" : "raw");
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  // stats are listed by the part of the game they belong to, in the same order as everywhere else on the site
  const meta = useMemo(() => [...(q.data?.traits ?? [])].sort((a, b) => partOrder(partOf(a.id).key) - partOrder(partOf(b.id).key) || a.unit.localeCompare(b.unit) || a.label.localeCompare(b.label)), [q.data]);
  const parts = useMemo(() => [...new Set(meta.map((m) => partOf(m.id).name))], [meta]);
  const [focus, setFocus] = useState<string | null>(null);  // the team the league chart marks: a pressed logo or a pointed-at row
  const wide = !useNarrow(1023);
  const tid = meta.some((m) => m.id === trait) ? trait! : meta[0]?.id;
  const spec = meta.find((m) => m.id === tid);
  // sorted by the number in the row: raw value and raw rank, or the schedule-adjusted pair, never a mix of the two
  const rows = useMemo(() => (q.data?.teams ?? []).flatMap((t) => {
    const v = t.traits.find((x) => x.trait === tid);
    const p = adjusted ? v?.adj_percentile ?? v?.percentile : v?.percentile;
    const rank = adjusted ? v?.adj_rank ?? v?.rank : v?.rank;
    const shown = adjusted ? v?.adj_value ?? v?.value : v?.value;
    return v && p != null && rank != null ? [{ t, v, p, rank, shown, other: adjusted ? v.rank : v.adj_rank }] : [];
  }).sort((a, b) => Number(!!a.t.carried) - Number(!!b.t.carried) || a.rank - b.rank), [q.data, tid, adjusted]);  // this season's teams, then last season's
  const hasAdj = rows.some((r) => r.v.adj_rank != null);
  // the same stat as one picture: every team's logo at its rank (built from the league already on the page, no request)
  const swarm = useMemo<TraitLeague | null>(() => (spec && q.data ? { sport, trait: spec, teams: q.data.teams.map((t) => {
    const v = t.traits.find((x) => x.trait === tid);
    return { team: t.team, name: t.name, value: v?.value ?? null, adj_value: v?.adj_value ?? null, rank: v?.rank ?? null, adj_rank: v?.adj_rank ?? null, of: v?.of ?? null, carried: !!t.carried };
  }) } : null), [spec, q.data, sport, tid]);
  const marked = rows.find((r) => r.t.team === focus) ?? rows[0];
  const firstOld = rows.findIndex((r) => r.t.carried);
  const table = useMemo<Row[]>(() => (q.data?.teams ?? []).filter((t) => t.offense != null && t.defense != null)
    .map((t) => {
      const offense = Math.round(t.offense! * 100), defense = Math.round(t.defense! * 100);
      // the mean of the two numbers shown, so the row adds up for anyone who checks it
      return { team: t.team, name: t.name, carried: !!t.carried, record: `${t.wins}-${t.losses}${t.draws ? `-${t.draws}` : ""}`, offense, defense, overall: Math.round((offense + defense) / 2), rank: 0 };
    })
    // this season's teams are ranked against each other; a team on last season's numbers is listed after them, unranked
    .sort((a, b) => Number(a.carried) - Number(b.carried) || b[sort] - a[sort]).map((r, i) => ({ ...r, rank: r.carried ? null : i + 1 })), [q.data, sort]);
  const basis = SIDE_BASIS[sport];
  const bar = (v: number) => (
    <span className="flex items-center gap-2"><span className="tabular w-7 text-right">{v}</span>
      <span className="relative hidden h-1.5 flex-1 rounded-full bg-muted sm:block"><span className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${v}%`, opacity: 0.3 + 0.7 * (v / 100) }} /></span></span>
  );
  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-6 sm:py-10">
      <PageHeader title={`${SPORT[sport] ?? sport} league`} size="lg" eyebrow={<span>Every team, every trait</span>}
        lede="Every team on one plot, the table behind it, the players leading each kind of production, and any stat ranked across the league."
        right={<SportPicker sports={SPORTS} value={sport} onChange={(s) => s && router.push(`/league/${s}`)} all={false} label="League" />} />
      {q.isLoading && <div className="h-96 animate-pulse rounded-3xl bg-muted" />}
      {q.isError && <LoadError what="the league" retry={() => q.refetch()} />}
      {q.data === null && <p className="text-sm text-muted-foreground">No league by that name.</p>}
      {q.data && !q.data.teams.length && <p className="text-sm text-muted-foreground">No {SPORT[sport] ?? sport} teams with a breakdown in the last two weeks.</p>}
      {q.data && q.data.teams.length > 0 && (
        <>
          <div className="pl-reading rounded-3xl border p-4 sm:p-6"><Seen>{(seen) => <Landscape teams={q.data!.teams} sport={sport} seen={seen} height={540} />}</Seen></div>
          {sport === "soccer" && <p className="-mt-6 text-xs text-muted-foreground">Soccer mixes leagues on one plot: each club&apos;s percentile is within its own league.</p>}

          <section className="grid gap-4 border-t pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="pl-display text-4xl sm:text-6xl">Power table</h2>
              <Picker label="Sort by" value={sort} onChange={setSort} options={[{ value: "overall", label: "Overall" }, { value: "offense", label: "Offense" }, { value: "defense", label: "Defense" }]} />
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{basis ? `Offense and defense: league percentile of ${basis}, scored and allowed. 100 is best.` : "Offense and defense: average league percentile of each side's traits. 100 is best."}</p>
            <DataNote summary="How this table is counted">
              Both numbers have the strength of the schedule taken out. Overall is the mean of the two. The record is beside it so you can see where the two disagree; each record is through that team&apos;s latest breakdown, so it can trail by a game.
              {table.some((r) => r.carried) ? " * = still on last season's numbers (a breakdown switches to this season once both teams have played 10 games). Those teams are listed last and not ranked: their percentiles are among last season's teams." : ""}
            </DataNote>
            <div className="pl-reading overflow-x-auto rounded-3xl border p-2 sm:p-4">
              <Table<Row> data={table} idKey="team" density="compact" hasHover textOverflow="truncate" columns={[
                { key: "rank", header: "#", width: pixel(narrow ? 38 : 40), renderCell: (r) => <span className="tabular text-muted-foreground">{r.rank ?? "—"}</span> },
                { key: "name", header: "Team", width: proportional(2, { minWidth: narrow ? 88 : 170 }), renderCell: (r) => (
                  <Link href={teamHref(sport, r.team)} className="flex min-w-0 items-center gap-2 font-medium hover:underline"><Crest sport={sport} team={r.team} name={r.name} size={22} /><span className="grid min-w-0"><span className="truncate">{r.name}{r.carried ? " *" : ""}</span>{narrow && <span className="tabular text-[10px] font-normal text-muted-foreground">{r.record}</span>}</span></Link>) },
                ...(narrow ? [] : [{ key: "record" as const, header: "Record", width: pixel(76), renderCell: (r: Row) => <span className="tabular text-muted-foreground">{r.record}</span> }]),
                { key: "overall", header: narrow ? "All" : "Overall", width: narrow ? pixel(42) : proportional(1, { minWidth: 70 }), renderCell: (r) => bar(r.overall) },
                { key: "offense", header: narrow ? "Off" : "Offense", width: narrow ? pixel(42) : proportional(1, { minWidth: 70 }), renderCell: (r) => bar(r.offense) },
                { key: "defense", header: narrow ? "Def" : "Defense", width: narrow ? pixel(42) : proportional(1, { minWidth: 70 }), renderCell: (r) => bar(r.defense) },
              ]} />
            </div>
          </section>

          {leaders.data && leaders.data.boards.length > 0 && (
            <section className="grid gap-4 border-t pt-5">
              <h2 className="pl-display text-4xl sm:text-6xl">Leaders</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">The top players in each kind of production, ranked within their position.</p>
              <DataNote summary="Who is ranked">The pool is each team&apos;s regulars ({sport === "nba" ? "its eight most-used players by minutes" : "its top two backs, three receivers and two tight ends by volume"}) with at least half the team&apos;s games, on teams with this season&apos;s numbers.</DataNote>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {leaders.data.boards.map((b, i) => (
                  <Reveal key={`${b.trait.id}:${b.position}`} delay={Math.min(i, 6) * 0.04} className="pl-reading grid content-start gap-3 rounded-2xl border p-4">
                    <div className="flex items-center gap-2.5">
                      <StatGlyph trait={b.trait.id} size={36} />
                      <div className="grid min-w-0 gap-0.5"><h3 className="text-sm font-semibold">{b.trait.label}</h3><span className="pl-label text-[10px] text-muted-foreground">{b.position ?? "All positions"} · {b.trait.measure}</span></div>
                    </div>
                    <ol className="grid gap-1.5">
                      {b.leaders.slice(0, 5).map((p, k) => (
                        <li key={p.player_id}>
                          <Link href={playerHref(p.player_id)} className={`flex items-center gap-2.5 rounded-lg p-1 hover:bg-muted/60 ${k === 0 ? "pb-2" : ""}`}>
                            <span className="tabular w-4 text-xs text-muted-foreground">{k + 1}</span>
                            <span className="rounded-full" style={k === 0 ? { boxShadow: "0 0 0 2px var(--hot)" } : undefined}><Face playerId={p.player_id} name={p.name} size={k === 0 ? 56 : 30} /></span>
                            <span className="grid min-w-0 flex-1"><span className={`truncate font-medium ${k === 0 ? "pl-matchup text-xl" : "text-sm"}`}>{p.name}</span><span className="truncate text-[11px] text-muted-foreground">{p.team_name}</span></span>
                            <span className="grid justify-items-end"><span className={`tabular font-semibold ${k === 0 ? "pl-display text-3xl leading-none" : "text-sm"}`}>{fmtValue(p.value, b.trait.measure)}</span><span className="tabular text-[10px] text-muted-foreground">{p.n} games</span></span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-4 border-t pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="pl-display text-4xl sm:text-6xl">Rank any stat</h2>
              <label className="grid gap-1 text-xs text-muted-foreground">Stat
                <select value={tid ?? ""} onChange={(e) => { setTrait(e.target.value); setFocus(null); }} className="h-9 max-w-[80vw] rounded-md border bg-background px-2 text-sm text-foreground">
                  {parts.map((part) => (
                    <optgroup key={part} label={part}>
                      {meta.filter((m) => partOf(m.id).name === part).map((m) => <option key={m.id} value={m.id}>{m.label} · {sideOf(m.id)}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {spec && <p className="max-w-2xl text-sm text-muted-foreground">{spec.description}. {spec.good_high ? "Ranked from the highest." : "Lower is better: ranked from the lowest."}{adjusted && !hasAdj ? " This trait has no schedule adjustment, so these are the numbers as played." : ""}</p>}
              <Picker label="Which numbers" value={adjusted ? "adj" : "raw"} onChange={(v) => setAdjusted(v === "adj")} options={[{ value: "raw", label: "As played" }, { value: "adj", label: "Schedule taken out" }]} />
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
            {swarm && marked && spec && (
              <div className="pl-reading grid gap-3 rounded-3xl border p-4 sm:p-6 lg:sticky lg:top-20">
                <div className="flex items-center gap-3">
                  <StatGlyph trait={spec.id} size={44} />
                  <div className="grid min-w-0 gap-0.5">
                    <span className="pl-label text-[10px] text-muted-foreground">{partOf(spec.id).name} · {sideOf(spec.id)}</span>
                    <span className="text-base leading-snug font-medium">{spec.label}</span>
                  </div>
                </div>
                <Seen>{(seen) => <LeagueSwarm league={swarm} sport={sport} seen={seen} mode={adjusted ? "adj" : "raw"} big={wide} width={wide ? 380 : 300} height={wide ? 460 : 340}
                  subject={{ team: marked.t.team, ink: "var(--hot)" }} onPick={setFocus} label={`${spec.label}, every team, best at the top`} />}</Seen>
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                  <Link href={teamHref(sport, marked.t.team)} className="font-medium underline decoration-[var(--hot)] decoration-2 underline-offset-4">{marked.t.name}</Link>
                  <span className="tabular text-muted-foreground">{fmtValue(marked.shown, spec.measure)}{marked.v.n ? ` · ${marked.v.n} ${sport === "nba" ? "games" : "plays"}` : ""}</span>
                </p>
                <p className="pl-label text-[10px] text-muted-foreground">Press a logo, or point at a row, to mark that team</p>
              </div>
            )}
            <div className="grid content-start gap-2">
            <div className="pl-label grid grid-cols-[1.6rem_minmax(0,10rem)_minmax(0,1fr)_4.5rem_3rem] gap-3 px-2 text-[10px] text-muted-foreground sm:grid-cols-[1.6rem_minmax(0,15rem)_minmax(0,1fr)_4.5rem_4.5rem]">
              <span>#</span><span>Team</span><span /><span className="text-right">{adjusted && hasAdj ? "Adjusted" : "Value"}</span><span className="text-right" title={adjusted ? "Rank as played" : "Rank with the schedule taken out"}>{!hasAdj ? "" : adjusted ? "Raw #" : "Adj #"}</span>
            </div>
            <Seen>{(seen) => (
              <ol className="grid gap-0.5">
                {rows.map((r, i) => (
                  <li key={r.t.team}>
                    {i === firstOld && <p className="pl-label mt-3 mb-1 border-t px-2 pt-3 text-[10px] text-muted-foreground">Last season&apos;s numbers, ranked among last season&apos;s teams (not comparable with the rows above)</p>}
                    <Link href={teamHref(sport, r.t.team)} onMouseEnter={() => setFocus(r.t.team)} onFocus={() => setFocus(r.t.team)}
                      className={`grid min-h-9 grid-cols-[1.6rem_minmax(0,10rem)_minmax(0,1fr)_4.5rem_3rem] items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/60 sm:grid-cols-[1.6rem_minmax(0,15rem)_minmax(0,1fr)_4.5rem_4.5rem] ${r.t.team === marked?.t.team ? "bg-muted/60" : ""}`}>
                      <span className="tabular text-xs text-muted-foreground">{r.rank}</span>
                      <span className="flex min-w-0 items-center gap-2"><Crest sport={sport} team={r.t.team} name={r.t.name} size={20} /><span className="truncate text-sm">{r.t.name}{r.t.carried ? " *" : ""}</span></span>
                      <span className="relative block h-3 rounded-sm bg-muted">
                        <span className="absolute inset-y-0 left-0 rounded-sm bg-foreground transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                          style={{ width: `${(seen ? Math.max(r.p, 0.015) : 0) * 100}%`, opacity: 0.3 + 0.7 * r.p, transitionDelay: `${Math.min(i, 30) * 14}ms` }} />
                      </span>
                      <span className="tabular text-right text-xs" title={r.v.n ? `n=${r.v.n}` : undefined}>{fmtValue(r.shown, spec?.measure)}</span>
                      <span className="tabular text-right text-xs text-muted-foreground">{hasAdj ? r.other ?? "—" : ""}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}</Seen>
            </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
