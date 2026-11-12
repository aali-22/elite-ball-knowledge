"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Crest, Face } from "@/components/ebk/Crest";
import { DataNote } from "@/components/ebk/DataNote";
import { OneRail, RankRail } from "@/components/ebk/RankRail";
import { StatGlyph, partOf } from "@/components/ebk/StatGlyph";
import { playerEdge } from "@/lib/framing";
import { HOME } from "@/lib/site";
import { Reveal } from "@/components/motion/Reveal";
import { Seen } from "@/components/motion/Scroll";
import { CountUp } from "@/components/viz/CountUp";
import { SPORT, fmtValue, ord, teamHref, usePlayer } from "@/lib/ebk";
import { fmtDate, useLocalTime } from "@/lib/localTime";
import { LoadError } from "@/components/ebk/LoadError";

export function PlayerView({ id }: { id: string }) {
  const local = useLocalTime();
  const q = usePlayer(id);
  const p = q.data;
  useEffect(() => { if (p) document.title = `${p.name} · Elite Ball Knowledge`; }, [p]);
  if (q.isLoading) return <main className="mx-auto max-w-7xl px-4 py-10"><div className="h-80 animate-pulse rounded-3xl bg-muted" /></main>;
  if (q.isError) return <main className="mx-auto grid max-w-3xl px-4 py-16"><LoadError what="this player" retry={() => q.refetch()} /></main>;
  if (!p) return <main className="mx-auto grid max-w-3xl gap-3 px-4 py-16"><h1 className="pl-display text-5xl">No player page yet</h1><p className="text-sm text-muted-foreground">A player appears once their team has a game with a breakdown in the last two weeks.</p><Link href="/games" className="pl-label underline decoration-[var(--hot)] decoration-2 underline-offset-4">All games</Link></main>;
  const spec = new Map(p.trait_meta.map((m) => [m.id, m]));
  const labels = Object.fromEntries(p.trait_meta.map((m) => [m.id, m.label]));
  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-6 sm:py-10">
      <div className="-mb-4 flex items-end gap-3"><Face playerId={p.player_id} name={p.name} size={104} /><Crest sport={p.sport} team={p.team} name={p.team_name} size={40} /></div>
      <PageHeader title={p.name} size="lg"
        eyebrow={<><span>{SPORT[p.sport] ?? p.sport}</span><span>/</span><Link href={teamHref(p.sport, p.team)} className="hover:text-foreground">{p.team_name}</Link><span>/</span><span>{p.position}</span></>}
        lede={p.carried ? "Last season's production, ranked among last season's players at his position." : "This season's production, ranked among the regulars at his position."} />
      <DataNote summary="Who he is ranked against" className="-mt-6">
        {p.carried ? "His team's breakdown is still on last season's numbers, so these are last season's, among last season's players at his position."
          : `Built ${fmtDate(p.as_of, { month: "short", day: "numeric", year: "numeric" }, local)}. The pool is ${p.sport === "nba" ? "each team's eight most-used players" : "each team's top backs, receivers and tight ends"} with at least half their team's games.`} These are the measures the matchup model uses, not a full stat line.
      </DataNote>
      <div className="grid gap-4 sm:grid-cols-3">
        {p.traits.map((t, i) => (
          <Reveal key={t.trait} delay={i * 0.05} className="pl-reading grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border p-4">
            <div className="grid content-start gap-2">
              <span className="flex items-center gap-2.5">
                <StatGlyph trait={t.trait} size={36} />
                <span className="pl-label text-[10px] leading-snug text-muted-foreground">{partOf(t.trait).name}<br /><span className="text-foreground">{spec.get(t.trait)?.label ?? t.trait}</span></span>
              </span>
              <span className="pl-display text-6xl"><CountUp value={t.value} format={(v) => fmtValue(v, spec.get(t.trait)?.measure)} /></span>
              <span className="tabular text-xs text-muted-foreground">{t.rank ? `${ord(t.rank)} of ${t.of} at the position` : "Not ranked: under half the team's games"} · {t.n} games</span>
            </div>
            {t.rank && t.of ? <Seen>{(seen) => <OneRail rank={t.rank!} of={t.of!} ink={HOME.ink} seen={seen} height={128} label={`${p.name}: ${ord(t.rank!)} of ${t.of} at the position`}>
              <Face playerId={p.player_id} name={p.name} size={26} color={HOME.ink} /></OneRail>}</Seen> : null}
          </Reveal>
        ))}
      </div>
      {p.matchups.length > 0 && (
        <section className="grid gap-4 border-t pt-5">
          <h2 className="pl-display text-4xl sm:text-6xl">{p.upcoming.length ? "Next game, then recent ones" : "Recent opponents"}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">His rank at the position beside how each opponent ranks at defending it. High on the left and low on the right is the favourable matchup.</p>
          <DataNote summary="Which numbers">The next game uses today&apos;s numbers; a game already played shows the ranks as they stood before it, so the pool sizes differ.</DataNote>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {p.matchups.map((e, i) => (
              <Reveal key={`${e.opponent}:${e.mechanism}`} delay={Math.min(i, 8) * 0.03} className="pl-reading grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border p-4">
                <div className="grid content-start gap-2">
                  <span className="flex items-center gap-2"><Crest sport={p.sport} team={e.opponent} name={e.opponent} size={26} /><span className="text-sm font-medium">against {e.opponent}</span></span>
                  <span className="flex items-center gap-2"><StatGlyph trait={e.resist.trait} size={28} className="rounded-lg" /><span className="text-sm leading-snug">{e.label}</span></span>
                  <span className="pl-label text-[10px] text-muted-foreground">{p.upcoming.includes(e.opponent) ? <b className="font-medium text-[var(--hot)]">Next game</b> : "Played"}</span>
                </div>
                <Seen>{(seen) => <RankRail seen={seen} sport={p.sport} g={{ home: { team: p.team, name: p.team_name }, away: { team: e.opponent, name: e.opponent } }}
                  i={playerEdge({ ...e, player_id: p.player_id, player: p.name, team: p.team }, labels)} />}</Seen>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
