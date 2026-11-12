"use client";

// The front door. Tonight's sharpest edges first, one card at a time, each a chart that shows its own numbers; then
// tonight's board, every game in one list, open a row for what decides it; then the league on one plot. Data comes in
// small, chosen pieces, never all at once. Everything is read from /api/public/analytics.
import { ArrowDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TonightBoard } from "@/components/ebk/Board";
import { Landscape } from "@/components/ebk/Charts";
import { SportPicker } from "@/components/ebk/Controls";
import { DataNote } from "@/components/ebk/DataNote";
import { EdgeDeck } from "@/components/ebk/Edges";
import { LoadError } from "@/components/ebk/LoadError";
import { SeasonNote } from "@/components/ebk/SeasonNote";
import { Reveal, SplitHeading } from "@/components/motion/Reveal";
import { Seen } from "@/components/motion/Scroll";
import { SIDE_BASIS, SPORT, useEdges, useLeague, useSlate } from "@/lib/ebk";
import { boardDay, dayKey, dayName, pickEdges } from "@/lib/edges";
import { PickLabDoor } from "@/components/public/Entry";
import { PICKLAB, SITE } from "@/lib/site";

export function HomeView() {
  const slate = useSlate(undefined, 5);
  const edges = useEdges();
  const games = useMemo(() => slate.data?.games ?? [], [slate.data]);
  const day = useMemo(() => boardDay(games.map((g) => g.start)), [games]);
  const name = day ? dayName(day) : "Tonight";
  const tonight = useMemo(() => games.filter((g) => g.start && dayKey(g.start) === day), [games, day]);
  const later = useMemo(() => games.filter((g) => g.start && day && dayKey(g.start) > day), [games, day]);
  const daySports = useMemo(() => [...new Set(tonight.map((g) => g.sport))], [tonight]);
  const [sport, setSport] = useState<string | null>(null);
  const board = sport ? tonight.filter((g) => g.sport === sport) : tonight;
  const deck = useMemo(() => pickEdges(edges.data?.findings ?? [], day), [edges.data, day]);
  const sports = slate.data?.sports ?? [];
  const leagueSport = sports.includes("nba") ? "nba" : sports.includes("nfl") ? "nfl" : sports[0] ?? "nba";
  const [lg, setLg] = useState<string | null>(null);
  const league = useLeague(lg ?? leagueSport);
  const nextDay = later[0]?.start ? dayKey(later[0].start) : null;
  const nextCount = nextDay ? later.filter((g) => g.start && dayKey(g.start) === nextDay).length : 0;

  return (
    <main>
      {/* ---- tonight's sharpest edges ---- */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-10 sm:gap-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="grid gap-3">
            <p className="pl-label text-[var(--hot)]">Sports analytics, shown not told</p>
            <SplitHeading text={SITE.name} className="pl-display text-[clamp(2.6rem,8vw,5.4rem)]" />
          </div>
          <div className="grid gap-2 pb-1">
            <p className="max-w-sm text-base leading-snug text-muted-foreground">Every claim next to the chart behind it.</p>
            <a href="#board" className="pl-label hidden min-h-10 items-center gap-2 justify-self-start text-[11px] underline decoration-[var(--hot)] decoration-2 underline-offset-4 sm:inline-flex">
              {name}&apos;s board <ArrowDown aria-hidden className="size-3.5" />
            </a>
          </div>
        </div>
        {edges.isLoading || slate.isLoading ? <div className="h-[30rem] animate-pulse rounded-3xl bg-muted" />
          : deck.length > 0 ? <EdgeDeck edges={deck} title={`${name}'s sharpest edges`} />
          : edges.isError ? <LoadError what="tonight's edges" retry={() => edges.refetch()} /> : null}
      </section>

      {/* ---- tonight's board ---- */}
      <section id="board" className="mx-auto grid max-w-7xl scroll-mt-16 gap-4 px-4 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
          <h2 className="pl-display text-4xl sm:text-6xl">{name}<span className="ml-3 align-middle font-sans text-base normal-case tracking-normal text-muted-foreground">{tonight.length ? `${tonight.length} ${tonight.length === 1 ? "game" : "games"}` : ""}</span></h2>
          {daySports.length > 1 && <SportPicker sports={daySports} value={sport} onChange={setSport} />}
        </div>
        {slate.isLoading && <div className="h-72 animate-pulse rounded-3xl bg-muted" />}
        {slate.isError && <LoadError what="the games" retry={() => slate.refetch()} />}
        {slate.data && !tonight.length && <p className="text-sm text-muted-foreground">No games with a breakdown right now. Breakdowns are built the day before each game.</p>}
        {board.length > 0 && <TonightBoard games={board} findings={edges.data?.findings ?? []} />}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          {(!sport || sport === "nba") && daySports.includes("nba") ? <SeasonNote /> : <span />}
          <Link href="/games" className="pl-label inline-flex min-h-10 items-center gap-2 text-[10px] underline decoration-[var(--hot)] decoration-2 underline-offset-4">
            {nextDay ? `${dayName(nextDay)} · ${nextCount} ${nextCount === 1 ? "game" : "games"}` : "Every game"} <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* ---- league ---- */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
          <h2 className="pl-display text-4xl sm:text-6xl">The league, on one plot</h2>
          <SportPicker sports={sports} value={lg ?? leagueSport} onChange={(v) => setLg(v)} all={false} label="League" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center">
          <div className="pl-reading rounded-3xl border p-4 sm:p-6">
            {league.data ? <Seen>{(seen) => <Landscape teams={league.data!.teams} sport={league.data!.sport} seen={seen} />}</Seen>
              : league.isError ? <LoadError what="the league plot" retry={() => league.refetch()} className="border-0 p-2" /> : <div className="h-80 animate-pulse rounded-2xl bg-muted" />}
          </div>
          <Reveal className="grid gap-3">
            <p className="text-lg leading-snug">Each dot is a team. Right scores more, up allows less.</p>
            <DataNote summary="How the plot is drawn">
              Positions are the league percentile of {SIDE_BASIS[lg ?? leagueSport] ?? "each side's traits"}, scored and allowed, with the strength of the schedule taken out. It is one measure of each side, not a power ranking. Pick a dot to open the team.
            </DataNote>
            <Link href={`/league/${lg ?? leagueSport}`} className="pl-label inline-flex min-h-10 items-center justify-self-start underline decoration-[var(--hot)] decoration-2 underline-offset-4">Explore the {SPORT[lg ?? leagueSport] ?? ""} league →</Link>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pt-14 sm:grid-cols-2">
        {[{ href: "/findings", k: "Every finding", t: "Everything the numbers noticed", d: "Filter by kind and sport, strongest first." },
          { href: "/compare", k: "What if", t: "Put any two teams together", d: "The full breakdown, as if they met today." }].map((c, i) => (
          <Reveal key={c.href} delay={i * 0.06}>
            <Link href={c.href} className="group grid h-full gap-2 rounded-3xl border p-6 transition-colors hover:border-foreground/40 sm:p-8">
              <span className="pl-label text-[10px] text-[var(--hot)]">{c.k}</span>
              <span className="pl-display text-3xl sm:text-4xl">{c.t}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{c.d}</span>
              <ArrowRight aria-hidden className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        ))}
      </section>

      {PICKLAB && <section className="mx-auto max-w-7xl px-4 pt-4"><PickLabDoor /></section>}
    </main>
  );
}
