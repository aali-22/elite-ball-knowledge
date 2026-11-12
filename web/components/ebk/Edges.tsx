"use client";

// The home page's opening: tonight's sharpest edges, one card at a time. Each card says which game (logos first), what
// part of the game it's about (a picture of it), the two numbers that matter (big), and draws them on the whole league:
// every team's logo on one stat, best at the top, the finding's team large and ringed, its opponent ringed too. Under
// it, one line on what it means; how the stat is counted sits in a data note. A schedule finding moves by itself once
// (the rank as played, then without the schedule), and the reader can move it back. Swipe, or use the arrows.
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Seen } from "@/components/motion/Scroll";
import { KIND, gameHref, ord, useTrait, type Finding, type TraitLeague } from "@/lib/ebk";
import { frame, nameIn, type Num as N, type Teams, type Viz } from "@/lib/framing";
import { AWAY, HOME } from "@/lib/site";
import { useNarrow } from "@/lib/useNarrow";
import { Crest, Face } from "./Crest";
import { DataNote } from "./DataNote";
import { LeagueSwarm } from "./LeagueSwarm";
import { MatchupLine } from "./MatchupLine";
import { StatGlyph, partOf, sideOf } from "./StatGlyph";

/** What the league charts need of a finding: its sport, the two teams, its numbers and its chart note. A slate finding
 *  is one; a board's matchup or a player edge can be dressed as one (see `charted`). */
export type Charted = Teams & { sport: string; insight: { numbers: N[]; viz: unknown } };
export const charted = (sport: string, g: Teams, numbers: N[], viz: Viz = { type: "duel" }): Charted => ({ sport, home: g.home, away: g.away, insight: { numbers, viz } });

const name = (f: Teams, team?: string | null) => nameIn(f, team);
const inkOf = (f: Teams, team?: string | null) => (team === f.home.team ? HOME.ink : team === f.away.team ? AWAY.ink : "var(--viz-muted)");
const other = (f: Teams, team?: string | null) => (team === f.home.team ? f.away.team : f.home.team);

const CHART_H = 300;
const Hold = ({ h = CHART_H }: { h?: number }) => <div className="animate-pulse rounded-2xl bg-muted/60" style={{ height: h }} />;
/** The one-ladder chart's size: on a desktop the card is wide, so the league is drawn large enough to read each logo. */
function useLadder(small = false) {
  const wide = !useNarrow(1023);
  return wide && !small ? { big: true, width: 380, height: 430 } : { big: false, width: 300, height: CHART_H };
}

/** A schedule finding: one stat, the whole league, as played and with the schedule taken out. */
function ShiftView({ f, seen, small }: { f: Charted; seen: boolean; small?: boolean }) {
  const v = f.insight.viz as Viz, trait = v.trait ?? f.insight.numbers[0]?.trait;
  const q = useTrait(f.sport, trait);
  const raw = v.raw_rank ?? 1, adj = v.adj_rank ?? raw;
  const size = useLadder(small);
  const [out, setOut] = useState(false);
  const played = useRef(false);  // it moves by itself once, the first time it's seen; after that it's the reader's
  useEffect(() => {
    if (!seen || !q.data || played.current || adj === raw) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => { played.current = true; setOut(true); }, calm ? 0 : 1600);
    return () => clearTimeout(t);
  }, [seen, q.data, adj, raw]);
  if (!q.data) return <Hold h={size.height} />;
  return (
    <div className="grid gap-3">
      <LeagueSwarm league={q.data} sport={f.sport} seen={seen} {...size} mode={out ? "adj" : "raw"} label={`${q.data.trait.label}, every team, best at the top`}
        subject={{ team: v.team!, ink: inkOf(f, v.team), rank: out ? adj : raw }} rival={{ team: other(f, v.team), ink: inkOf(f, other(f, v.team)) }} />
      {adj !== raw && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">{out ? "With the schedule taken out" : "As played"}</p>
          <button type="button" onClick={() => { played.current = true; setOut((x) => !x); }} aria-pressed={out}
            className="pl-label min-h-10 rounded-full border px-4 text-[10px] hover:bg-muted">{out ? "Put the schedule back" : "Take out the schedule"}</button>
        </div>
      )}
    </div>
  );
}

/** A column header for one side of a matchup: whose number, which stat, its rank. */
function Side({ f, x, playerName }: { f: Charted; x: N; playerName?: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <div className="flex items-center gap-1.5">
        <Crest sport={f.sport} team={x.team ?? ""} name={name(f, x.team)} size={18} />
        <span className="truncate text-sm font-medium">{playerName ?? name(f, x.team)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <StatGlyph trait={x.trait} size={26} className="rounded-lg" />
        <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">{x.label}</span>
      </div>
    </div>
  );
}

/** Two numbers against each other: the attack and what resists it, side by side, each on its own stat across the league.
 *  The same stat at opposite ends is one field with both teams on it. A player stands on his own rail, his face as the mark. */
function PairView({ f, seen, small }: { f: Charted; seen: boolean; small?: boolean }) {
  const v = f.insight.viz as Viz, [a, b] = f.insight.numbers;
  const qa = useTrait(f.sport, a?.trait?.includes(".player.") ? null : a?.trait);
  const qb = useTrait(f.sport, b?.trait);
  const size = useLadder(small);
  if (v.type === "split") {
    if (!qa.data) return <Hold h={size.height} />;
    return <LeagueSwarm league={qa.data} sport={f.sport} seen={seen} {...size} label={`${qa.data.trait.label}, every team, best at the top`}
      subject={{ team: a.team!, ink: inkOf(f, a.team), rank: a.rank }} rival={{ team: b.team!, ink: inkOf(f, b.team), rank: b.rank }} />;
  }
  const pairH = (size.big ? 400 : CHART_H) - 40;  // two ladders side by side: each a little shorter than the single one
  const field = (q: { data?: TraitLeague | null }, x: N) => (q.data
    ? <LeagueSwarm league={q.data} sport={f.sport} seen={seen} compact={!size.big} width={size.big ? 200 : 150} height={pairH + 20} label={`${q.data.trait.label}, every team, best at the top`}
        subject={{ team: x.team!, ink: inkOf(f, x.team), rank: x.rank }} />
    : <Hold h={pairH} />);
  const player = v.player && a ? (
    <div className="relative mx-auto" style={{ height: pairH, width: 130 }} role="img" aria-label={`${v.player}: ${ord(a.rank ?? 0)} of ${a.of} at his position`}>
      <span aria-hidden className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-[var(--viz-axis)]" />
      {(() => {
        const p = a.rank && a.of ? 1 - (a.rank - 1) / Math.max(1, a.of - 1) : 0.5;
        const top = 8 + (1 - (seen ? p : 0.5)) * (pairH - 64);
        return (
          <span className="absolute left-1/2 grid -translate-x-1/2 justify-items-center gap-1 transition-[top] duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" style={{ top }}>
            <span className="rounded-full" style={{ boxShadow: `0 0 0 3px ${inkOf(f, a.team)}` }}><Face playerId={v.player_id ?? ""} name={v.player} size={44} /></span>
            <b className="pl-display tabular text-xl leading-none" style={{ color: inkOf(f, a.team) }}>{ord(a.rank ?? 0)}</b>
            <span className="pl-label text-[10px] text-muted-foreground">of {a.of}</span>
          </span>
        );
      })()}
    </div>
  ) : null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid content-start gap-2"><Side f={f} x={a} playerName={v.player} />{player ?? field(qa, a)}</div>
      <div className="grid content-start gap-2"><Side f={f} x={b} />{field(qb, b)}</div>
    </div>
  );
}

/** How the stats are counted: one line each, from the stat's own definition. */
export function Measured({ f }: { f: Charted }) {
  const traits = [...new Set(f.insight.numbers.map((x) => x.trait).filter((t): t is string => !!t && !t.includes(".player.")))];
  const q0 = useTrait(f.sport, traits[0]), q1 = useTrait(f.sport, traits[1]);
  const metas = [q0.data?.trait, q1.data?.trait].filter(Boolean) as TraitLeague["trait"][];
  const n = f.insight.numbers.find((x) => x.n)?.n;
  if (!metas.length) return null;
  return (
    <DataNote summary="What's measured">
      {metas.map((m) => <span key={m.id} className="block">{m.label}: {m.description.replace(/\.$/, "")}. {m.good_high ? "Higher is better." : "Lower is better."}</span>)}
      <span className="block">Ranks are within the league, with the strength of the schedule taken out where it can be{n ? `; sample ${n} ${f.sport === "nba" ? "games" : "plays"}` : ""}. Every logo sits at its rank, best at the top; point at a faded one for its team.</span>
    </DataNote>
  );
}

/** A finding drawn on the whole league: one ladder for a stat the schedule moved or one both teams share, two ladders
 *  side by side for two different stats, a player on his position's rail. `small` keeps the phone size on any screen. */
export function LeagueChart({ f, seen, small }: { f: Charted; seen: boolean; small?: boolean }) {
  return (f.insight.viz as Viz).type === "rank_shift" ? <ShiftView f={f} seen={seen} small={small} /> : <PairView f={f} seen={seen} small={small} />;
}

function EdgeCard({ f }: { f: Finding }) {
  const fr = frame(f.insight, f), part = partOf(fr.trait);
  return (
    <article className="pl-reading grid content-start gap-5 rounded-3xl border p-5 sm:p-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
      <div className="grid content-start gap-4">
        <Link href={gameHref(f.event_id)} className="group justify-self-start">
          <MatchupLine g={f} sport={f.sport} start={f.start}><ArrowRight aria-hidden className="size-3" /></MatchupLine>
        </Link>
        <div className="flex items-center gap-3">
          <StatGlyph trait={fr.trait} size={52} />
          <div className="grid min-w-0 gap-0.5">
            <span className="pl-label text-[10px] text-muted-foreground">{part.name} · {sideOf(fr.trait)} · <span className="text-foreground">{KIND[f.insight.kind]}</span></span>
            <span className="text-base leading-snug font-medium">{fr.stat}</span>
          </div>
        </div>
        <h3 className="pl-display text-[clamp(1.9rem,6.5vw,3rem)] leading-[0.95] lg:text-[clamp(3rem,4.6vw,4.4rem)]">{fr.headline}</h3>
        <p className="flex max-w-xl gap-2 text-sm leading-relaxed lg:text-base"><Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--hot)] lg:mt-1" /><span>{fr.meaning}</span></p>
        <Measured f={f} />
      </div>
      <Seen>{(seen) => <LeagueChart f={f} seen={seen} />}</Seen>
    </article>
  );
}

/** The deck: one card per screen, swipe or arrows, the position always shown. */
export function EdgeDeck({ edges, title }: { edges: Finding[]; title: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [tall, setTall] = useState<number | null>(null);  // the height of the card on screen: a short card leaves no gap under it
  useLayoutEffect(() => {
    const slide = track.current?.children[at] as HTMLElement | undefined;
    if (!slide) return;
    const fit = () => setTall(slide.offsetHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(slide);
    return () => ro.disconnect();
  }, [at, edges.length]);
  const go = (to: number) => {
    const el = track.current;
    if (!el) return;
    const i = Math.max(0, Math.min(edges.length - 1, to));
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: calm ? "auto" : "smooth" });
  };
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const on = () => setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);
  if (!edges.length) return null;
  return (
    <section aria-roledescription="carousel" aria-label={title} className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="pl-label text-[11px] text-[var(--hot)]">{title}</h2>
        {edges.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="pl-label tabular mr-1 text-[10px] text-muted-foreground" aria-live="polite">{at + 1} / {edges.length}</span>
            <button type="button" onClick={() => go(at - 1)} aria-label="Previous edge" className="grid size-10 place-items-center rounded-full border text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={at === 0}><ArrowLeft className="size-4" /></button>
            <button type="button" onClick={() => go(at + 1)} aria-label="Next edge" className="grid size-10 place-items-center rounded-full border text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={at >= edges.length - 1}><ArrowRight className="size-4" /></button>
          </div>
        )}
      </div>
      <div ref={track} tabIndex={0} onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); } }}
        // contain:paint: without it Chrome lets the data notes (<details>) of off-screen cards widen the whole page
        style={{ height: tall ?? undefined }}
        className="-mx-1 flex snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-3xl outline-none transition-[height] duration-300 [contain:paint] [scrollbar-width:none] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--hot)] [&::-webkit-scrollbar]:hidden">
        {edges.map((f, i) => (
          <div key={f.insight.id + f.event_id} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${edges.length}`} className="w-full shrink-0 snap-center px-1">
            <EdgeCard f={f} />
          </div>
        ))}
      </div>
      {edges.length > 1 && (
        <div className="flex justify-center gap-1.5" aria-hidden>
          {edges.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${i === at ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/40"}`} />)}
        </div>
      )}
    </section>
  );
}
