"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Landscape } from "@/components/ebk/Charts";
import { Seen } from "@/components/motion/Scroll";
import { SPORT, fmtValue, ord, pctOf, rankOf, teamHref, useLeague } from "@/lib/ebk";

const SPORTS = ["nba", "nfl", "soccer"];

export default function LeaguePage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = use(params);
  const q = useLeague(sport);
  const [trait, setTrait] = useState<string | null>(null);
  const meta = useMemo(() => [...(q.data?.traits ?? [])].sort((a, b) => a.unit.localeCompare(b.unit) || a.label.localeCompare(b.label)), [q.data]);
  const tid = trait ?? meta[0]?.id;
  const spec = meta.find((m) => m.id === tid);
  const rows = useMemo(() => (q.data?.teams ?? []).flatMap((t) => {
    const v = t.traits.find((x) => x.trait === tid), p = pctOf(v);
    return v && p != null ? [{ t, v, p }] : [];
  }).sort((a, b) => b.p - a.p), [q.data, tid]);
  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:py-10">
      <PageHeader title={`${SPORT[sport] ?? sport} league`} size="lg" eyebrow={<span>Every team, every trait</span>}
        lede="Where each team sits on offense and defense, then any single trait ranked across the league. Teams appear once they have a game with a breakdown in the last two weeks."
        right={<div className="flex gap-1" role="group" aria-label="League">
          {SPORTS.map((s) => <Link key={s} href={`/league/${s}`} aria-current={s === sport ? "page" : undefined}
            className={`pl-label rounded-full px-3 py-1.5 text-[10px] ${s === sport ? "bg-foreground text-background" : "border text-muted-foreground hover:text-foreground"}`}>{SPORT[s]}</Link>)}
        </div>} />
      {q.isLoading && <div className="h-96 animate-pulse rounded-3xl bg-muted" />}
      {q.data === null && <p className="text-sm text-muted-foreground">No league by that name.</p>}
      {q.data && !q.data.teams.length && <p className="text-sm text-muted-foreground">No {SPORT[sport] ?? sport} teams with a breakdown in the last two weeks.</p>}
      {q.data && q.data.teams.length > 0 && (
        <>
          <div className="pl-reading rounded-3xl border p-4 sm:p-6"><Seen>{(seen) => <Landscape teams={q.data!.teams} sport={sport} seen={seen} height={520} />}</Seen></div>
          {sport === "soccer" && <p className="text-xs text-muted-foreground">Soccer mixes leagues on one plot: each club&apos;s percentile is within its own league.</p>}
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
                    <Link href={teamHref(sport, r.t.team)} className="grid grid-cols-[1.6rem_minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/60 sm:grid-cols-[1.6rem_minmax(0,14rem)_minmax(0,1fr)_4.5rem]">
                      <span className="tabular text-xs text-muted-foreground">{rankOf(r.v) ?? i + 1}</span>
                      <span className="truncate text-sm">{r.t.name}</span>
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
