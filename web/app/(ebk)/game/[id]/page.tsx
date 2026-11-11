"use client";

// One game: the head (who, when, the read on the whole board), then the board told as a scroll (components/ebk/BoardView).
// Everything is computed (the analytics API); nothing here is an opinion, a pick or a price.
import Link from "next/link";
import { use, useEffect, useMemo } from "react";
import { BoardView } from "@/components/ebk/BoardView";
import { sidesOf } from "@/components/ebk/Cards";
import { InsightViz } from "@/components/ebk/Charts";
import { Crest } from "@/components/ebk/Crest";
import { GameExtras } from "@/components/ebk/GameExtras";
import { ViewLink } from "@/components/ebk/Shell";
import { Reveal, SplitHeading } from "@/components/motion/Reveal";
import { Seen } from "@/components/motion/Scroll";
import { CountUp } from "@/components/viz/CountUp";
import { SPORT, crestName, teamHref, useBoard, when } from "@/lib/ebk";
import { AWAY, HOME, LAB } from "@/lib/site";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useBoard(id);
  const b = q.data;
  const sides = useMemo(() => (b ? sidesOf(b) : null), [b]);
  useEffect(() => { if (b) document.title = `${b.label} · Elite Ball Knowledge`; }, [b]);

  if (q.isLoading) return <main className="mx-auto grid max-w-6xl gap-4 px-4 py-10"><div className="h-40 animate-pulse rounded-3xl bg-muted" /><div className="h-80 animate-pulse rounded-3xl bg-muted" /></main>;
  if (!b || !sides) {
    return (
      <main className="mx-auto grid max-w-3xl gap-3 px-4 py-16">
        <h1 className="pl-display text-5xl">No breakdown for this game</h1>
        <p className="text-sm text-muted-foreground">Breakdowns are built the day before a game, for the NBA, the NFL and the top soccer leagues.</p>
        <div className="flex gap-3">
          <Link href="/games" className="pl-label underline decoration-[var(--hot)] decoration-2 underline-offset-4">All games</Link>
          {LAB && <Link href={`/lab/${id.startsWith("soc") ? "match" : "game"}/${id}`} className="pl-label text-muted-foreground underline underline-offset-4">Open in the Lab</Link>}
        </div>
      </main>
    );
  }
  const hn = sides.names[sides.home], an = sides.names[sides.away];
  const w = when(b.start);
  const balance = b.insights.find((f) => f.kind === "balance");
  const sim = b.simulation as Record<string, unknown> | null;
  const labels = Object.fromEntries(b.traits.map((t) => [t.id, t.label]));
  const homeWin = typeof sim?.home_win === "number" ? sim.home_win : null;

  return (
    <main className="mx-auto grid max-w-6xl gap-12 px-4 py-6 sm:gap-16 sm:py-10">
      {/* ---- head ---- */}
      <header className="grid gap-5">
        <div className="pl-label flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
          <Link href="/games" className="hover:text-foreground">Games</Link><span>/</span>
          <span>{SPORT[b.sport] ?? b.sport}</span>{w && <><span>·</span><span>{w.day}, {w.time}</span></>}
        </div>
        <h1 className="grid gap-2" aria-label={b.label}>
          {[{ t: sides.away, name: an, ink: AWAY.ink, i: 0 }, { t: sides.home, name: hn, ink: HOME.ink, i: 1 }].map(({ t, name, ink, i }) => (
            <span key={t} className="contents">
              {i === 1 && <span className="pl-label pl-[calc(clamp(3rem,9vw,6.5rem)+1rem)] text-muted-foreground">{b.sport === "soccer" ? "versus" : "at"}</span>}
              <ViewLink href={teamHref(b.sport, t)} className="group flex w-fit max-w-full items-center gap-4">
                <Crest sport={b.sport} team={t} name={name} color={ink} eager className="!size-[clamp(3rem,9vw,6.5rem)] shrink-0"
                  style={{ viewTransitionName: crestName(b.event_id, i) }} size={104} />
                <SplitHeading as="h2" text={name} className="pl-display min-w-0 text-[clamp(2.4rem,9.5vw,7rem)] decoration-4 underline-offset-8 group-hover:underline" />
              </ViewLink>
            </span>
          ))}
        </h1>
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
          <Reveal className="grid gap-1">
            <span className="pl-label text-[10px] text-muted-foreground">Matchups measured</span>
            <span className="pl-display text-5xl"><CountUp value={b.matchups.length} /></span>
          </Reveal>
          <Reveal delay={0.06} className="grid gap-1">
            <span className="pl-label text-[10px] text-muted-foreground">Findings</span>
            <span className="pl-display text-5xl"><CountUp value={b.insights.length} /></span>
          </Reveal>
          <Reveal delay={0.12} className="grid gap-1">
            <span className="pl-label text-[10px] text-muted-foreground">{homeWin != null ? `${homeWin >= 0.5 ? hn : an} in simulations` : "Traits per team"}</span>
            <span className="pl-display text-5xl">{homeWin != null ? <CountUp value={Math.round(Math.max(homeWin, 1 - homeWin) * 100)} format={(v) => `${v.toFixed(0)}%`} /> : <CountUp value={b.home.traits.length} />}</span>
          </Reveal>
        </div>
        {balance && (
          <Reveal className="pl-reading grid gap-3 rounded-3xl border p-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-8 sm:p-7">
            <div className="grid gap-1.5">
              <span className="pl-label text-[10px] text-muted-foreground">The whole board</span>
              <p className="pl-matchup text-2xl sm:text-3xl">{balance.title}</p>
              <p className="text-sm text-muted-foreground">{balance.claim}</p>
            </div>
            <Seen>{(seen) => <InsightViz f={balance} sides={sides} seen={seen} labels={labels} />}</Seen>
          </Reveal>
        )}
        {b.notes.map((x) => <p key={x} className="rounded-xl border-l-2 border-[var(--status-warning)] bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{x}</p>)}
      </header>

      <BoardView b={b} after={(num) => <GameExtras b={b} sides={sides} num={num} />} />

      <footer className="grid gap-1 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        <p>{b.method}</p>
        <p>Built {new Date(b.built_at).toLocaleString()} · <Link href="/picklab/sources" className="underline underline-offset-2">Sources and method</Link></p>
      </footer>
    </main>
  );
}
