"use client";

// Charts for the public analytics pages. Two encodings, each with one job:
//   - two teams against each other: a horizontal league-percentile rail (left = worst, right = best for the team that
//     owns the number). Everything in this file.
//   - where a team sits in the league: a vertical ladder by rank, best at the top, logos as the marks
//     (LeagueSwarm for the whole league, RankRail for a card's own numbers).
// Home is the first categorical slot and away the second in both, ranks are printed as text so colour is never the only
// carrier, and each chart draws itself in when `seen` turns true and is complete without motion.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChartFrame, VIZ } from "@/components/viz/base";
import { DistributionHistogram, type Bin } from "@/components/viz/DistributionHistogram";
import { SIDE_BASIS, fmtValue, ord, pctOf, rankOf, teamHref, type Insight, type LeagueTeam, type MatchupEdge, type OpponentFaced, type TraitMeta, type TraitValue } from "@/lib/ebk";
import { fmtDate, fmtInt, useLocalTime } from "@/lib/localTime";
import { AWAY, HOME } from "@/lib/site";
import { teamLogo } from "@/lib/teamMedia";
import { useIsDark } from "@/lib/theme";
import { useNarrow } from "@/lib/useNarrow";
import { StatGlyph } from "./StatGlyph";

export type Sides = { home: string; away: string; names: Record<string, string> };
export const inkOf = (s: Sides, team: string | null | undefined) => (team === s.home ? HOME.ink : team === s.away ? AWAY.ink : VIZ.muted);
const ease = "transition-[left,width,transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

function Rail({ children, ticks = true }: { children: React.ReactNode; ticks?: boolean }) {
  return (
    <div className="relative h-7">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--viz-axis)]" />
      {ticks && [0, 0.5, 1].map((t) => <span key={t} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-[var(--viz-axis)]" style={{ left: `${t * 100}%` }} />)}
      {children}
    </div>
  );
}

function Dot({ p, color, seen, label, title }: { p: number; color: string; seen: boolean; label?: string; title?: string }) {
  return (
    <span title={title} className={`absolute top-1/2 z-[1] grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ring-2 ring-[var(--surface,var(--background))] ${ease}`}
      style={{ left: `${p * 100}%`, background: color, opacity: seen ? 1 : 0, transform: `translate(-50%, -50%) scale(${seen ? 1 : 0.2})` }}>
      {label && <span className="pl-label absolute -top-4 whitespace-nowrap text-[10px] text-muted-foreground">{label}</span>}
    </span>
  );
}

const RailScale = () => (
  <div className="pl-label flex justify-between text-[10px] text-muted-foreground"><span>Worst</span><span>Avg</span><span>Best</span></div>
);

/** One matchup: the attacking trait and the trait that resists it on the same percentile rail; the gap is the edge. */
export function Duel({ attack, resist, sides, seen, attackLabel, resistLabel }: {
  attack: { team: string; rank?: number | null; of?: number | null; percentile?: number | null; label?: string };
  resist: { team: string; rank?: number | null; of?: number | null; percentile?: number | null; label?: string };
  sides: Sides; seen: boolean; attackLabel: string; resistLabel: string;
}) {
  // The dot sits where the printed rank puts it (1st at BEST, last at WORST), so the position can never disagree with the label.
  const at = (x: typeof attack) => (x.rank && x.of ? 1 - (x.rank - 1) / Math.max(1, x.of - 1) : x.percentile ?? 0.5);
  const a = at(attack), r = at(resist);
  const row = (who: typeof attack, p: number, label: string) => (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{who.label ?? sides.names[who.team] ?? who.team}</div>
        <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      </div>
      <Rail><Dot p={p} color={inkOf(sides, who.team)} seen={seen} /></Rail>
      <div className="tabular text-right text-xs">{who.rank ? <><b>{ord(who.rank)}</b><span className="text-muted-foreground">/{who.of}</span></> : "—"}</div>
    </div>
  );
  return (
    <div className="grid gap-1.5">
      {row(attack, a, attackLabel)}
      {row(resist, r, resistLabel)}
      <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] gap-3"><span /><RailScale /><span /></div>
      <p className="text-[10px] leading-snug text-muted-foreground">Ranks are within the league, with the strength of the schedule taken out where it can be.</p>
    </div>
  );
}

/** A rank before and after the schedule is taken out: where the team sits, and where it would sit against an average slate. */
export function RankShift({ raw, adj, of, color, seen }: { raw: number; adj: number | null; of: number; color: string; seen: boolean }) {
  const p = (r: number) => 1 - (r - 1) / Math.max(1, of - 1);
  const to = adj ?? raw;
  const lo = Math.min(p(raw), p(to)), hi = Math.max(p(raw), p(to));
  return (
    <div className="grid gap-1.5">
      <Rail>
        <span className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full opacity-40 ${ease}`} style={{ left: `${lo * 100}%`, width: `${(seen ? hi - lo : 0) * 100}%`, background: color }} />
        <span className="absolute top-1/2 z-[1] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-[var(--surface,var(--background))]" style={{ left: `${p(raw) * 100}%`, borderColor: color }} title={`Raw: ${ord(raw)} of ${of}`} />
        <Dot p={p(to)} color={color} seen={seen} title={`Schedule-adjusted: ${ord(to)} of ${of}`} />
      </Rail>
      <RailScale />
      <div className="tabular flex flex-wrap gap-x-4 text-xs">
        <span><span className="text-muted-foreground">Raw</span> <b>{ord(raw)}</b></span>
        <span><span className="text-muted-foreground">Schedule-adjusted</span> <b>{ord(to)}</b></span>
        <span className="text-muted-foreground">of {of}</span>
      </div>
    </div>
  );
}

/** How many of the board's matchups each side wins. */
/** The split is always drawn at its real proportion: a bar that waits to be scrolled into view can be read while it still says 50/50. */
export function BalanceBar({ home, away, homeWins, awayWins }: { home: string; away: string; homeWins: number; awayWins: number; seen?: boolean }) {
  const total = Math.max(1, homeWins + awayWins);
  return (
    <div className="grid gap-1.5">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        <span className={`h-full rounded-l-full ${ease}`} style={{ width: `${(awayWins / total) * 100}%`, background: AWAY.ink }} />
        <span className={`h-full flex-1 rounded-r-full ${ease}`} style={{ background: HOME.ink }} />
      </div>
      <div className="tabular flex justify-between text-xs">
        <span><b>{awayWins}</b> <span className="text-muted-foreground">{away}</span></span>
        <span><span className="text-muted-foreground">{home}</span> <b>{homeWins}</b></span>
      </div>
    </div>
  );
}

const RESULT: Record<string, { cls: string; word: string }> = {
  // near-black letters: white on these greens and reds falls under 3:1
  W: { cls: "bg-[var(--status-good)] text-[#0b0b0b]", word: "Win" }, L: { cls: "bg-[var(--status-critical)] text-white dark:text-[#0b0b0b]", word: "Loss" },
  D: { cls: "bg-muted-foreground text-background", word: "Draw" },
};

/** Recent results, oldest first: the letter is the result, the bar under it is how strong the opponent was. */
export function FormRibbon({ games, seen, max = 10, sport }: { games: OpponentFaced[]; seen: boolean; max?: number; sport?: string }) {
  const shown = games.filter((g) => g.result).slice(-max);
  const tie = sport === "soccer" ? { letter: "D", word: "Draw" } : { letter: "T", word: "Tie" };  // a level game is a tie outside soccer
  const last = shown.at(-1)?.date;
  const local = useLocalTime();
  const through = last ? fmtDate(last as string, { month: "short", day: "numeric" }, local) : null;
  if (!shown.length) return <p className="text-xs text-muted-foreground">No games played yet.</p>;
  return (
    <div className="grid gap-1.5">
      <ol className="flex items-end gap-1" aria-label="Recent results, oldest first">
        {shown.map((g, i) => {
          const r = RESULT[g.result!];
          const who = g.name ?? g.opponent;
          return (
            <li key={i} className="grid min-w-0 flex-1 justify-items-center gap-1"
              title={`${g.result === "D" ? tie.word : r.word} ${g.score ?? ""} ${g.home ? "v" : "at"} ${who}${g.rank ? ` (ranked ${ord(g.rank)})` : ""}`}>
              <span className="flex h-10 w-full items-end rounded-sm bg-muted">
                <span className={`w-full rounded-sm bg-foreground/45 ${ease}`} style={{ height: `${Math.max(6, (g.strength ?? 0.5) * 100)}%`, transform: seen ? "scaleY(1)" : "scaleY(0)", transformOrigin: "bottom", transitionDelay: `${i * 40}ms` }} />
              </span>
              <span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${r.cls}`}>{g.result === "D" ? tie.letter : g.result}</span>
              <span className="w-full truncate text-center text-[10px] text-muted-foreground">{who.replace(/^soc:/, "")}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-muted-foreground">Oldest on the left, latest on the right{through ? `: results through ${through}, when these numbers were built` : ""}. Bar height = strength of the opponent (taller is tougher).</p>
    </div>
  );
}

/** The chart for one finding, chosen by the finding's own `viz.type`. */
export function InsightViz({ f, sides, seen, labels }: { f: Insight; sides: Sides; seen: boolean; labels: Record<string, string> }) {
  const v = f.viz as Record<string, unknown>;
  const [a, b] = f.numbers;
  if (v.type === "duel" && a && b) {
    return <Duel seen={seen} sides={sides} attackLabel={a.label} resistLabel={b.label}
      attack={{ team: a.team ?? "", rank: a.rank, of: a.of, percentile: a.percentile, label: typeof v.player === "string" ? v.player : undefined }}
      resist={{ team: b.team ?? "", rank: b.rank, of: b.of, percentile: b.percentile }} />;
  }
  if (v.type === "split" && a && b) {
    return <Duel seen={seen} sides={sides} attackLabel={a.label} resistLabel={b.label}
      attack={{ team: a.team ?? "", rank: a.rank, of: a.of, percentile: a.percentile }} resist={{ team: b.team ?? "", rank: b.rank, of: b.of, percentile: b.percentile }} />;
  }
  if (v.type === "rank_shift" && typeof v.raw_rank === "number" && typeof v.of === "number") {
    return <RankShift seen={seen} raw={v.raw_rank} adj={typeof v.adj_rank === "number" ? v.adj_rank : null} of={v.of} color={inkOf(sides, f.team)} />;
  }
  if (v.type === "balance") {
    return <BalanceBar seen={seen} home={sides.names[sides.home]} away={sides.names[sides.away]} homeWins={Number(v.home_wins)} awayWins={Number(v.away_wins)} />;
  }
  if (v.type === "form" && Array.isArray(v.games)) return <FormRibbon seen={seen} games={v.games as OpponentFaced[]} />;
  if (v.type === "dist") {
    const lo = Number(v.p10), mid = Number(v.p50), hi = Number(v.p90), span = Math.max(Math.abs(lo), Math.abs(hi), 1) * 1.15;
    const x = (n: number) => `${((n + span) / (2 * span)) * 100}%`;
    return (
      <div className="grid gap-1.5">
        <div className="relative h-7">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--viz-axis)]" />
          <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-[var(--viz-muted)]" style={{ left: "50%" }} />
          <span className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full opacity-45 ${ease}`} style={{ left: x(lo), width: seen ? `calc(${x(hi)} - ${x(lo)})` : 0, background: inkOf(sides, f.team) }} />
          <Dot p={(mid + span) / (2 * span)} color={inkOf(sides, f.team)} seen={seen} />
        </div>
        <div className="tabular flex justify-between text-xs text-muted-foreground">
          <span>1 in 10: {lo > 0 ? "+" : ""}{Math.round(lo)}</span><span className="text-foreground">Middle game: <b>{mid > 0 ? "+" : ""}{Math.round(mid)}</b></span><span>1 in 10: +{Math.round(hi)}</span>
        </div>
      </div>
    );
  }
  void labels;
  return null;
}

/** The simulation's margin, as the share of simulated games at each margin (no market line anywhere). */
export function MarginDist({ sim, home, away }: { sim: Record<string, unknown>; home: string; away: string }) {
  const bins = useMemo(() => {
    const raw: Bin[] = Array.isArray(sim.margin_dist) ? (sim.margin_dist as [number, number][]).map(([x, p]) => ({ x: Number(x), p: Number(p) })) : [];
    let lo = 0, hi = raw.length - 1, acc = 0;
    while (lo < hi && acc + raw[lo].p < 0.0025) acc += raw[lo++].p;
    acc = 0;
    while (hi > lo && acc + raw[hi].p < 0.0025) acc += raw[hi--].p;
    return raw.slice(lo, hi + 1);
  }, [sim.margin_dist]);
  if (!bins.length) return null;
  const n = typeof sim.n_sims === "number" ? `${fmtInt(sim.n_sims)} simulated games` : undefined;
  const hw = typeof sim.home_win === "number" ? sim.home_win : null;
  const exact = hw != null ? { above: hw, below: typeof sim.away_win === "number" ? sim.away_win : 1 - hw, push: typeof sim.tie === "number" ? sim.tie : 0 } : undefined;
  return <DistributionHistogram bins={bins} exact={exact} line={{ x: 0, label: "" }} aboveLabel={`${home} win`} belowLabel={`${away} win`} pushLabel="level after regulation (decided in overtime)"
    xLabel={(x) => (x > 0 ? `${home} +${x}` : x < 0 ? `${away} +${-x}` : "Tie")} color={HOME.ink}
    title={`${home} margin`} subtitle="Home points minus away points; the middle 99.5% of simulated games" sample={n}
    source={{ label: "Drive simulation from nflverse play-by-play, earlier weeks only" }} />;
}

/** Every measured matchup as one row: the bar leans toward the side with the edge, its length is the size of it. */
export function EdgeLadder({ edges, sides, pick, onPick, seen, limit = 12 }: { edges: MatchupEdge[]; sides: Sides; pick: number; onPick: (i: number) => void; seen: boolean; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? edges : edges.slice(0, Math.max(limit, pick + 1));
  return (
    <ChartFrame title="Every matchup on the board" subtitle="Bar leans toward the side with the edge; the fainter the bar, the smaller the sample behind it"
      legend={[{ label: sides.names[sides.away], color: AWAY.ink }, { label: sides.names[sides.home], color: HOME.ink }]}
      table={{ columns: ["Matchup", "With the ball", "Edge to", "Size", "Sample (share of a full one)", "Counted in the whole board"], rows: edges.map((e) => [e.label, sides.names[e.attack_team] ?? e.attack_team,
        sides.names[e.edge >= 0 ? e.attack_team : e.resist_team] ?? "", Math.abs(e.edge).toFixed(2), `${Math.round(e.confidence * 100)}%`,
        Math.abs(e.edge) >= 0.1 && e.confidence >= 0.3 ? "yes" : Math.abs(e.edge) < 0.1 ? "no: too close" : "no: sample under 30%"]) }}>
      <ul className="grid gap-px">
        {shown.map((e, i) => {
          const winner = e.edge >= 0 ? e.attack_team : e.resist_team;
          const toHome = winner === sides.home;
          const w = Math.min(1, Math.abs(e.edge)) * 50;
          return (
            <li key={`${e.mechanism}:${e.attack_team}`}>
              <button type="button" onClick={() => onPick(i)} aria-pressed={i === pick}
                className={`grid w-full grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted/60 ${i === pick ? "bg-muted" : ""}`}>
                <StatGlyph trait={e.resist?.trait ?? e.attack?.trait} size={26} className="rounded-lg" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium leading-snug">{e.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{sides.names[e.attack_team] ?? e.attack_team} with the ball</span>
                </span>
                <span className="relative h-4">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--viz-axis)]" />
                  <span className={`absolute inset-y-0.5 rounded-sm ${ease}`} title={`${sides.names[winner] ?? winner} by ${Math.abs(e.edge).toFixed(2)} (sample: ${Math.round(e.confidence * 100)}% of a full one)`}
                    style={{ [toHome ? "left" : "right"]: "50%", width: `${seen ? w : 0}%`, background: toHome ? HOME.ink : AWAY.ink, opacity: 0.35 + 0.65 * e.confidence, transitionDelay: `${Math.min(i, 12) * 25}ms` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {edges.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="pl-label mt-3 min-h-10 rounded-full border px-4 py-1.5 text-[10px] hover:bg-muted">
          {all ? "Show the biggest edges only" : `Show all ${edges.length} matchups`}
        </button>
      )}
    </ChartFrame>
  );
}

/** One team's number in a table view, every part named: the value and rank as played, the rank with the schedule taken out, the sample. */
const cell = (t: TraitValue, m: TraitMeta) =>
  `${fmtValue(t.value, m.measure)} · ${t.rank ? ord(t.rank) : "—"} · ${t.adj_rank ? ord(t.adj_rank) : "not adjusted"}${t.n ? ` · n=${t.n}` : ""}`;

const UNIT_ORDER = ["offense", "defense", "situation", "special"];
const UNIT_LABEL: Record<string, string> = { offense: "With the ball", defense: "Without the ball", situation: "Game state", special: "Special teams" };

/** Both identities, trait by trait, on the percentile rail: a wide gap between the two dots is where the game tilts. */
export function IdentityRails({ home, away, meta, sides, seen, limit }: {
  home: TraitValue[]; away: TraitValue[]; meta: TraitMeta[]; sides: Sides; seen: boolean; limit?: number;
}) {
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    const a = new Map(away.map((t) => [t.trait, t]));
    const spec = new Map(meta.map((m) => [m.id, m]));
    return home.flatMap((h) => {
      const o = a.get(h.trait), m = spec.get(h.trait);
      const hp = pctOf(h), ap = pctOf(o);
      return o && m && hp != null && ap != null ? [{ h, o, m, hp, ap, gap: Math.abs(hp - ap) }] : [];
    }).sort((x, y) => UNIT_ORDER.indexOf(x.m.unit) - UNIT_ORDER.indexOf(y.m.unit) || y.gap - x.gap);
  }, [home, away, meta]);
  const top = limit && !all ? [...rows].sort((x, y) => y.gap - x.gap).slice(0, limit).sort((x, y) => UNIT_ORDER.indexOf(x.m.unit) - UNIT_ORDER.indexOf(y.m.unit) || y.gap - x.gap) : rows;
  let unit = "";
  return (
    <ChartFrame title="Two identities, side by side" subtitle="League percentile of each trait (schedule-adjusted where it can be); right is better for the team that owns it"
      legend={[{ label: sides.names[sides.away], color: AWAY.ink, shape: "dot" }, { label: sides.names[sides.home], color: HOME.ink, shape: "dot" }]}
      table={{ columns: ["Trait", `${sides.names[sides.away]}: value as played · rank as played · rank with the schedule taken out · sample`, `${sides.names[sides.home]}: the same`], rows: rows.map((r) => [r.m.label, cell(r.o, r.m), cell(r.h, r.m)]) }}>
      <div className="grid gap-0.5">
        {top.map((r, i) => {
          const head = r.m.unit !== unit ? (unit = r.m.unit) : null;
          return (
            <div key={r.m.id}>
              {head && <div className="pl-label mt-3 mb-1 text-[10px] text-muted-foreground first:mt-0">{UNIT_LABEL[head] ?? head}</div>}
              <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]" title={r.m.description}>
                <span className="truncate text-xs">{r.m.label}</span>
                <span className="relative block h-5">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--viz-grid)]" />
                  <span className={`absolute top-1/2 h-0.5 -translate-y-1/2 bg-foreground/25 ${ease}`}
                    style={{ left: `${Math.min(r.hp, r.ap) * 100}%`, width: `${(seen ? r.gap : 0) * 100}%`, transitionDelay: `${Math.min(i, 14) * 20}ms` }} />
                  {[{ p: r.ap, c: AWAY.ink, t: r.o }, { p: r.hp, c: HOME.ink, t: r.h }].map((d, k) => (
                    <span key={k} title={`${sides.names[d.t.team] ?? d.t.team}: ${fmtValue(d.t.value, r.m.measure)}, ${rankOf(d.t) ? ord(rankOf(d.t)!) : "—"} of ${d.t.of ?? "—"}${d.t.n ? ` (n=${d.t.n})` : ""}`}
                      className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface,var(--background))] ${ease}`}
                      style={{ left: `${d.p * 100}%`, background: d.c, opacity: seen ? 1 : 0, transitionDelay: `${Math.min(i, 14) * 20}ms` }} />
                  ))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"><span /><RailScale /></div>
      {limit && rows.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="pl-label mt-3 min-h-10 rounded-full border px-4 py-1.5 text-[10px] hover:bg-muted">
          {all ? "Show the widest gaps only" : `Show all ${rows.length} traits`}
        </button>
      )}
    </ChartFrame>
  );
}

/** The league on one plot: offense across, defense up, every team a labelled dot; the two teams of a game stand out. */
export function Landscape({ teams, sport, focus = [], seen, height = 380 }: { teams: LeagueTeam[]; sport: string; focus?: string[]; seen: boolean; height?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const dark = useIsDark();
  const pts = teams.filter((t) => t.offense != null && t.defense != null);
  // a phone gets its own, squarer drawing so the logos and the axis numbers stay a readable size instead of shrinking
  const narrow = useNarrow();
  const W = narrow ? 360 : 600, H = narrow ? 400 : 440, pad = narrow ? 30 : 40;
  // The axes run over the range the teams actually cover (averages of many percentiles bunch toward the middle),
  // widened a little and kept symmetric around the league average so the centre lines stay the average.
  const span = Math.min(0.5, Math.max(0.12, ...pts.flatMap((t) => [Math.abs(t.offense! - 0.5), Math.abs(t.defense! - 0.5)])) + 0.04);
  const unit = (p: number) => (p - (0.5 - span)) / (2 * span);
  const x = (p: number) => pad + unit(p) * (W - 2 * pad), y = (p: number) => H - pad - unit(p) * (H - 2 * pad);
  const lo = 0.5 - span, hi = 0.5 + span;
  const old = pts.filter((t) => t.carried).length;
  const short = (t: LeagueTeam) => (t.team.startsWith("soc:") ? t.name.slice(0, 3).toUpperCase() : t.team);
  return (
    <ChartFrame title="The league at a glance" subtitle={`League percentile of each team's ${SIDE_BASIS[sport] ?? "offense and defense traits"}, scored and allowed, with the schedule taken out; up and right is better at both`}
      sample={`${pts.length} teams${old ? `, ${old} of them on last season's numbers (dashed ring), placed among last season's teams` : ""}`} table={{ columns: ["Team", "Offense", "Defense", "Season"], rows: [...pts].sort((a, b) => (b.offense! + b.defense!) - (a.offense! + a.defense!))
        .map((t) => [t.name, Math.round(t.offense! * 100), Math.round(t.defense! * 100), t.carried ? "last season" : "this season"]) }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: narrow ? undefined : height }} role="img" aria-label="Offense against defense for every team">
        <rect x={x(0.5)} y={y(hi)} width={x(hi) - x(0.5)} height={y(0.5) - y(hi)} fill="var(--foreground)" opacity={0.04} />
        {[lo, 0.5, hi].map((t) => <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={y(lo)} y2={y(hi)} stroke="var(--viz-grid)" strokeDasharray={t === 0.5 ? "" : "2 4"} />
          <line y1={y(t)} y2={y(t)} x1={x(lo)} x2={x(hi)} stroke="var(--viz-grid)" strokeDasharray={t === 0.5 ? "" : "2 4"} />
          <text x={x(t)} y={y(lo) + 14} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px] tabular">{Math.round(t * 100)}</text>
          <text x={x(lo) - 6} y={y(t) + 3} textAnchor="end" className="fill-[var(--viz-muted)] text-[10px] tabular">{Math.round(t * 100)}</text>
        </g>)}
        <text x={x(hi)} y={y(hi) - 8} textAnchor="end" className="fill-[var(--viz-muted)] text-[11px]">Good at both</text>
        <text x={x(hi)} y={y(lo) + 30} textAnchor="end" className="fill-[var(--viz-muted)] text-[11px]">Offense percentile →</text>
        <text x={x(lo)} y={y(hi) - 8} className="fill-[var(--viz-muted)] text-[11px]">↑ Defense percentile</text>
        {pts.map((t, i) => {
          const f = focus.indexOf(t.team), on = f >= 0 || hover === t.team;
          const cx = x(t.offense!), cy = y(t.defense!);
          return (
            <Link key={t.team} href={teamHref(sport, t.team)} aria-label={`${t.name}: offense ${Math.round(t.offense! * 100)}, defense ${Math.round(t.defense! * 100)}${t.carried ? " (last season's numbers)" : ""}`} onMouseEnter={() => setHover(t.team)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(t.team)} onBlur={() => setHover(null)}>
              <g style={{ transform: `translate(${cx}px, ${cy}px)`, opacity: seen ? 1 : 0, transition: "opacity 500ms ease", transitionDelay: `${i * 14}ms` }}>
                <title>{`${t.name}: offense ${Math.round(t.offense! * 100)}, defense ${Math.round(t.defense! * 100)}${t.carried ? " (last season's numbers)" : ""}`}</title>
                <circle r={18} fill="transparent" />
                {(() => {
                  const logo = broken.has(t.team) ? null : teamLogo(sport, t.team, dark);
                  const r = logo ? (on ? 17 : 12) : on ? 7 : 4.5;
                  return (
                    <>
                      {f >= 0 && logo && <circle r={r + 5} fill="none" stroke={f === 0 ? HOME.ink : AWAY.ink} strokeWidth={2.5} />}
                      {t.carried && <circle r={r + 3} fill="none" stroke="var(--viz-muted)" strokeWidth={1.2} strokeDasharray="3 3" />}
                      {logo
                        ? <image href={logo} x={-r} y={-r} width={2 * r} height={2 * r} opacity={f >= 0 || hover === t.team || !focus.length ? 1 : 0.55}
                            style={{ transition: "all 200ms" }} onError={() => setBroken((b) => new Set(b).add(t.team))} />
                        : <circle r={r} fill={f === 0 ? HOME.ink : f === 1 ? AWAY.ink : "var(--foreground)"} opacity={f >= 0 || hover === t.team ? 1 : 0.5} stroke="var(--surface,var(--background))" strokeWidth={2} />}
                      {(!logo || on) && <text y={-(r + 6)} textAnchor="middle" className={`text-[10px] ${on ? "fill-[var(--foreground)] font-semibold" : "fill-[var(--viz-muted)]"}`}
                        style={{ paintOrder: "stroke", stroke: "var(--surface,var(--background))", strokeWidth: on ? 3 : 0 }}>{logo || on ? `${t.name}${on ? ` · off ${Math.round(t.offense! * 100)}, def ${Math.round(t.defense! * 100)}` : ""}` : short(t)}</text>}
                    </>
                  );
                })()}
              </g>
            </Link>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

/** One team's traits as a ranked strip: best to worst, each on the percentile rail. */
export function TraitStrip({ traits, meta, color, seen }: { traits: TraitValue[]; meta: TraitMeta[]; color: string; seen: boolean }) {
  const spec = new Map(meta.map((m) => [m.id, m]));
  const rows = traits.flatMap((t) => { const m = spec.get(t.trait), p = pctOf(t); return m && p != null ? [{ t, m, p }] : []; }).sort((a, b) => b.p - a.p);
  return (
    <ChartFrame title="Identity, strongest to weakest" subtitle="League percentile of each computed trait" sample={`${rows.length} traits`}
      table={{ columns: ["Trait", "Value as played", "Rank as played", "Rank, schedule taken out", "Sample"], rows: rows.map((r) => [r.m.label, fmtValue(r.t.value, r.m.measure),
        r.t.rank ? `${ord(r.t.rank)} of ${r.t.of}` : "—", r.t.adj_rank ? `${ord(r.t.adj_rank)} of ${r.t.of}` : "not adjusted", r.t.n ? `n=${r.t.n}` : "—"]) }}>
      <ul className="grid gap-0.5">
        {rows.map((r, i) => (
          <li key={r.m.id} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.2rem] items-center gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_3.2rem]" title={r.m.description}>
            <span className="truncate text-xs">{r.m.label}</span>
            <span className="relative block h-3 rounded-sm bg-muted">
              <span className={`absolute inset-y-0 left-0 rounded-sm ${ease}`} style={{ width: `${(seen ? r.p : 0) * 100}%`, background: color, opacity: 0.35 + 0.65 * r.p, transitionDelay: `${Math.min(i, 20) * 18}ms` }} />
              <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--surface,var(--background))]" />
            </span>
            <span className="tabular text-right text-xs">{rankOf(r.t) ? <><b>{ord(rankOf(r.t)!)}</b><span className="text-muted-foreground">/{r.t.of}</span></> : "—"}</span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
