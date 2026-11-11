"use client";

import { Table, pixel, proportional } from "@astryxdesign/core/Table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Landscape } from "@/components/ebk/Charts";
import { Picker, SportPicker } from "@/components/ebk/Controls";
import { Crest, Face } from "@/components/ebk/Crest";
import { Reveal } from "@/components/motion/Reveal";
import { Seen } from "@/components/motion/Scroll";
import { SPORT, fmtValue, ord, pctOf, playerHref, rankOf, teamHref, useLeaders, useLeague } from "@/lib/ebk";

const SPORTS = ["nba", "nfl", "soccer"];
type Sort = "overall" | "offense" | "defense";
interface Row extends Record<string, unknown> { team: string; name: string; offense: number; defense: number; overall: number; rank: number }

export default function LeaguePage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = use(params);
  const router = useRouter();
  const q = useLeague(sport);
  const leaders = useLeaders(sport);
  const [trait, setTrait] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("overall");
  const meta = useMemo(() => [...(q.data?.traits ?? [])].sort((a, b) => a.unit.localeCompare(b.unit) || a.label.localeCompare(b.label)), [q.data]);
  const tid = trait ?? meta[0]?.id;
  const spec = meta.find((m) => m.id === tid);
  const rows = useMemo(() => (q.data?.teams ?? []).flatMap((t) => {
    const v = t.traits.find((x) => x.trait === tid), p = pctOf(v);
    return v && p != null ? [{ t, v, p }] : [];
  }).sort((a, b) => b.p - a.p), [q.data, tid]);
  const table = useMemo<Row[]>(() => (q.data?.teams ?? []).filter((t) => t.offense != null && t.defense != null)
    .map((t) => ({ team: t.team, name: t.name, offense: Math.round(t.offense! * 100), defense: Math.round(t.defense! * 100), overall: Math.round((t.offense! + t.defense!) * 50), rank: 0 }))
    .sort((a, b) => b[sort] - a[sort]).map((r, i) => ({ ...r, rank: i + 1 })), [q.data, sort]);
  const bar = (v: number) => (
    <span className="flex items-center gap-2"><span className="tabular w-7 text-right">{v}</span>
      <span className="relative hidden h-1.5 flex-1 rounded-full bg-muted sm:block"><span className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${v}%`, opacity: 0.3 + 0.7 * (v / 100) }} /></span></span>
  );
  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-6 sm:py-10">
      <PageHeader title={`${SPORT[sport] ?? sport} league`} size="lg" eyebrow={<span>Every team, every trait</span>}
        lede="Where each team sits on offense and defense, the table behind the plot, the players leading each kind of production, and any single trait ranked across the league."
        right={<SportPicker sports={SPORTS} value={sport} onChange={(s) => s && router.push(`/league/${s}`)} all={false} label="League" />} />
      {q.isLoading && <div className="h-96 animate-pulse rounded-3xl bg-muted" />}
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
            <p className="max-w-2xl text-sm text-muted-foreground">Average league percentile of every trait on each side of the ball (100 is best), schedule-adjusted where it can be. Overall is the mean of the two.</p>
            <div className="pl-reading overflow-x-auto rounded-3xl border p-2 sm:p-4">
              <Table<Row> data={table} idKey="team" density="compact" hasHover columns={[
                { key: "rank", header: "#", width: pixel(44), renderCell: (r) => <span className="tabular text-muted-foreground">{r.rank}</span> },
                { key: "name", header: "Team", width: proportional(2, { minWidth: 150 }), renderCell: (r) => (
                  <Link href={teamHref(sport, r.team)} className="flex items-center gap-2.5 font-medium hover:underline"><Crest sport={sport} team={r.team} name={r.name} size={24} />{r.name}</Link>) },
                { key: "overall", header: "Overall", width: proportional(1, { minWidth: 70 }), renderCell: (r) => bar(r.overall) },
                { key: "offense", header: "Offense", width: proportional(1, { minWidth: 70 }), renderCell: (r) => bar(r.offense) },
                { key: "defense", header: "Defense", width: proportional(1, { minWidth: 70 }), renderCell: (r) => bar(r.defense) },
              ]} />
            </div>
          </section>

          {leaders.data && leaders.data.boards.length > 0 && (
            <section className="grid gap-4 border-t pt-5">
              <h2 className="pl-display text-4xl sm:text-6xl">Leaders</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">The top players in each kind of production, ranked within their position among players with at least half their team&apos;s games.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {leaders.data.boards.map((b, i) => (
                  <Reveal key={`${b.trait.id}:${b.position}`} delay={Math.min(i, 6) * 0.04} className="pl-reading grid content-start gap-3 rounded-2xl border p-4">
                    <div className="grid gap-0.5"><h3 className="text-sm font-semibold">{b.trait.label}</h3><span className="pl-label text-[10px] text-muted-foreground">{b.position ?? "All positions"} · {b.trait.measure}</span></div>
                    <ol className="grid gap-1.5">
                      {b.leaders.slice(0, 5).map((p, k) => (
                        <li key={p.player_id}>
                          <Link href={playerHref(p.player_id)} className="flex items-center gap-2.5 rounded-lg p-1 hover:bg-muted/60">
                            <span className="tabular w-4 text-xs text-muted-foreground">{k + 1}</span>
                            <Face playerId={p.player_id} name={p.name} size={k === 0 ? 40 : 30} />
                            <span className="grid min-w-0 flex-1"><span className="truncate text-sm font-medium">{p.name}</span><span className="truncate text-[11px] text-muted-foreground">{p.team_name}</span></span>
                            <span className="tabular text-sm font-semibold" title={p.rank ? `${ord(p.rank)} of ${p.of}; ${p.n} games` : undefined}>{fmtValue(p.value, b.trait.measure)}</span>
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
              <h2 className="pl-display text-4xl sm:text-6xl">Rank any trait</h2>
              <label className="grid gap-1 text-xs text-muted-foreground">Trait
                <select value={tid ?? ""} onChange={(e) => setTrait(e.target.value)} className="h-9 max-w-[80vw] rounded-md border bg-background px-2 text-sm text-foreground">
                  {meta.map((m) => <option key={m.id} value={m.id}>{m.unit === "offense" ? "Offense" : m.unit === "defense" ? "Defense" : "Game"} · {m.label}</option>)}
                </select>
              </label>
            </div>
            {spec && <p className="max-w-2xl text-sm text-muted-foreground">{spec.description}. {spec.good_high ? "Higher is better." : "Lower is better."}</p>}
            <Seen>{(seen) => (
              <ol className="grid gap-0.5">
                {rows.map((r, i) => (
                  <li key={r.t.team}>
                    <Link href={teamHref(sport, r.t.team)} className="grid grid-cols-[1.6rem_minmax(0,10rem)_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/60 sm:grid-cols-[1.6rem_minmax(0,15rem)_minmax(0,1fr)_4.5rem]">
                      <span className="tabular text-xs text-muted-foreground">{rankOf(r.v) ?? i + 1}</span>
                      <span className="flex min-w-0 items-center gap-2"><Crest sport={sport} team={r.t.team} name={r.t.name} size={20} /><span className="truncate text-sm">{r.t.name}</span></span>
                      <span className="relative block h-3 rounded-sm bg-muted">
                        <span className="absolute inset-y-0 left-0 rounded-sm bg-foreground transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                          style={{ width: `${(seen ? r.p : 0) * 100}%`, opacity: 0.3 + 0.7 * r.p, transitionDelay: `${Math.min(i, 30) * 14}ms` }} />
                      </span>
                      <span className="tabular text-right text-xs" title={r.v.n ? `n=${r.v.n}; ${rankOf(r.v) ? ord(rankOf(r.v)!) : ""} of ${r.v.of}` : undefined}>{fmtValue(r.v.value, spec?.measure)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}</Seen>
          </section>
        </>
      )}
    </main>
  );
}
