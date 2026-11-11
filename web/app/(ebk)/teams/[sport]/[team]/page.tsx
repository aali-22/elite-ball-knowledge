"use client";

import Link from "next/link";
import { use } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { InsightCard } from "@/components/ebk/Cards";
import { FormRibbon, TraitStrip } from "@/components/ebk/Charts";
import { Crest, Face } from "@/components/ebk/Crest";
import { Reveal } from "@/components/motion/Reveal";
import { Seen } from "@/components/motion/Scroll";
import { CountUp } from "@/components/viz/CountUp";
import { SPORT, fmtValue, gameHref, ord, playerHref, useTeam, when } from "@/lib/ebk";
import { HOME } from "@/lib/site";

export default function TeamPageView({ params }: { params: Promise<{ sport: string; team: string }> }) {
  const { sport, team } = use(params);
  const q = useTeam(sport, team);
  const t = q.data;
  if (q.isLoading) return <main className="mx-auto max-w-6xl px-4 py-10"><div className="h-96 animate-pulse rounded-3xl bg-muted" /></main>;
  if (!t) return <main className="mx-auto grid max-w-3xl gap-3 px-4 py-16"><h1 className="pl-display text-5xl">No team page yet</h1><p className="text-sm text-muted-foreground">A team appears once it has a game with a breakdown in the last two weeks.</p><Link href={`/league/${sport}`} className="pl-label underline decoration-[var(--hot)] decoration-2 underline-offset-4">The league</Link></main>;
  const spec = new Map(t.trait_meta.map((m) => [m.id, m]));
  const sides = { home: t.team, away: "", names: { [t.team]: t.name, ...Object.fromEntries(t.games.map((g) => [g.opponent, g.opponent_name])) } };
  const players = new Map<string, typeof t.players>();
  for (const p of t.players) players.set(p.player_id, [...(players.get(p.player_id) ?? []), p]);
  const played = t.opponents.filter((o) => o.result);
  const wins = played.filter((o) => o.result === "W").length;
  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-4 py-6 sm:py-10">
      <Crest sport={sport} team={t.team} name={t.name} size={96} color={HOME.ink} eager className="-mb-4" />
      <PageHeader title={t.name} size="lg" eyebrow={<><Link href={`/league/${sport}`} className="hover:text-foreground">{SPORT[sport] ?? sport}</Link><span>/</span><span>Team</span></>}
        lede={`Identity as of ${new Date(t.as_of).toLocaleDateString()}. Ranks are within the league, with the schedule taken out where it can be.`} />
      {(t.notes ?? []).map((x) => (
        <p key={x} className="flex gap-2 rounded-xl border border-[var(--status-warning)]/60 bg-[color-mix(in_oklab,var(--status-warning)_12%,transparent)] px-3 py-2.5 text-sm leading-relaxed">
          <span aria-hidden className="pl-label shrink-0 pt-0.5 text-[10px]">Read first</span><span>{x}</span>
        </p>
      ))}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[{ l: "Offense percentile", v: t.offense }, { l: "Defense percentile", v: t.defense }].map((s) => (
          <Reveal key={s.l} className="grid gap-1 border-l pl-3"><span className="pl-label text-[10px] text-muted-foreground">{s.l}</span>
            <span className="pl-display text-5xl">{s.v != null ? <CountUp value={Math.round(s.v * 100)} /> : "—"}</span></Reveal>
        ))}
        <Reveal className="grid gap-1 border-l pl-3"><span className="pl-label text-[10px] text-muted-foreground">Record</span><span className="pl-display text-5xl">{wins}–{played.length - wins}</span></Reveal>
        <Reveal className="grid gap-1 border-l pl-3"><span className="pl-label text-[10px] text-muted-foreground">Traits computed</span><span className="pl-display text-5xl"><CountUp value={t.traits.length} /></span></Reveal>
      </div>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="pl-reading rounded-3xl border p-4 sm:p-6"><Seen>{(seen) => <TraitStrip traits={t.traits} meta={t.trait_meta} color={HOME.ink} seen={seen} />}</Seen></div>
        <div className="grid gap-4">
          <div className="pl-reading grid gap-3 rounded-3xl border p-4 sm:p-5">
            <h2 className="pl-label text-muted-foreground">Results so far</h2>
            <Seen>{(seen) => <FormRibbon games={t.opponents} seen={seen} max={12} />}</Seen>
          </div>
          {t.games.length > 0 && (
            <div className="grid gap-2 rounded-3xl border p-4 sm:p-5">
              <h2 className="pl-label text-muted-foreground">Breakdowns</h2>
              <ul className="grid gap-px">
                {t.games.map((g) => (
                  <li key={g.event_id}><Link href={gameHref(g.event_id)} className="grid gap-0.5 rounded-md px-2 py-1.5 hover:bg-muted/60">
                    <span className="flex items-center gap-2 text-sm font-medium"><Crest sport={sport} team={g.opponent} name={g.opponent_name} size={20} />{g.home ? "v" : "at"} {g.opponent_name}{when(g.start) ? <span className="ml-2 text-xs font-normal text-muted-foreground">{when(g.start)!.day}</span> : null}</span>
                    {g.headline && <span className="line-clamp-1 text-xs text-muted-foreground">{g.headline.title}</span>}
                  </Link></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
      {t.findings.length > 0 && (
        <section className="grid gap-4 border-t pt-5">
          <h2 className="pl-display text-4xl sm:text-6xl">What stands out</h2>
          <div className="grid gap-4 sm:grid-cols-2">{t.findings.map((f, i) => <Reveal key={f.id} delay={i * 0.04}><InsightCard f={f} sides={sides} className="h-full" /></Reveal>)}</div>
        </section>
      )}
      {players.size > 0 && (
        <section className="grid gap-4 border-t pt-5">
          <h2 className="pl-display text-4xl sm:text-6xl">Players</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...players].map(([pid, rows], i) => (
              <Reveal key={pid} delay={Math.min(i, 8) * 0.03}>
                <Link href={playerHref(pid)} className="pl-reading grid gap-2 rounded-2xl border p-4 transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="flex items-center gap-3"><Face playerId={pid} name={rows[0].name} size={44} /><span className="pl-matchup min-w-0 flex-1 truncate text-xl">{rows[0].name}</span><span className="pl-label text-[10px] text-muted-foreground">{rows[0].position}</span></div>
                  <ul className="grid gap-0.5">
                    {rows.map((p) => (
                      <li key={p.trait} className="flex justify-between gap-3 text-xs"><span className="truncate text-muted-foreground">{spec.get(p.trait)?.label ?? p.trait}</span>
                        <span className="tabular shrink-0">{fmtValue(p.value, spec.get(p.trait)?.measure)}{p.rank ? <span className="text-muted-foreground"> · {ord(p.rank)}/{p.of}</span> : null}</span></li>
                    ))}
                  </ul>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
