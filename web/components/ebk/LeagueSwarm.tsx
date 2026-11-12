"use client";

// One stat, the whole league, every team its own logo: best at the top, worst at the bottom, each team at the height
// its rank puts it (so a logo can never disagree with the rank printed beside it), nudged sideways only to keep logos
// from overlapping. The finding's
// team is large and full colour with its rank beside it, its opponent ringed, everyone else small and quiet until
// pointed at. On first sight the logos rise from the league average to their places, the subject landing last; when
// the numbers change (the schedule taken out), every logo glides to its new place on the same fixed scale.
import { useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ord, type TraitLeague } from "@/lib/ebk";
import { Crest } from "./Crest";

type Team = TraitLeague["teams"][number];
export type Mark = { team: string; ink: string; rank?: number | null };

const glide = "transition-[left,top,opacity] duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

export function LeagueSwarm({ league, sport, subject, rival, mode = "adj", seen: inView, width = 300, height = 300, compact = false, big = false, label, onPick }: {
  league: TraitLeague; sport: string; subject: Mark; rival?: Mark | null; mode?: "raw" | "adj"; seen: boolean;
  width?: number; height?: number; compact?: boolean; big?: boolean; label: string; onPick?: (team: string) => void;  // onPick: a pressed logo becomes the page's chosen team
}) {
  const seen = useReducedMotion() ? true : inView;  // with less motion asked for, nothing waits off-screen at zero opacity
  const [hover, setHover] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);  // the first rise is staggered; every later move is not
  // `big`: a wide card on a desktop, where the small logos read as specks; `compact`: two charts side by side
  const rS = big ? 30 : compact ? 16 : 21, rR = big ? 21 : compact ? 12 : 15, rO = big ? 14 : compact ? 8.5 : 9.5;
  const layout = useMemo(() => {
    const me = league.teams.find((t) => t.team === subject.team);
    // a team on last season's numbers is drawn among last season's teams, a this-season team among this season's
    const pool = league.teams.filter((t) => !!t.carried === !!me?.carried && t.value != null);
    const of = Math.max(2, ...pool.map((t) => t.of ?? pool.length));  // one scale for both views: the axis never moves
    const rankOf = (t: Team) => (mode === "adj" ? t.adj_rank ?? t.rank : t.rank) ?? of;
    const pad = rS + 8;
    const py = (rank: number) => pad + ((rank - 1) / (of - 1)) * (height - 2 * pad);
    const val = rankOf;
    const radius = (t: string) => (t === subject.team ? rS : t === rival?.team ? rR : rO);
    const order = [...pool].sort((a, b) => Number(b.team === subject.team) - Number(a.team === subject.team)
      || Number(b.team === rival?.team) - Number(a.team === rival?.team) || py(val(a)) - py(val(b)));
    const placed: { x: number; y: number; r: number }[] = [];
    const at = new Map<string, { x: number; y: number; r: number; rank: number | null }>();
    for (const t of order) {
      const y = py(val(t)), r = radius(t.team);
      const room = r + (t.team === subject.team || t.team === rival?.team ? 5 : 0);  // a ringed logo keeps its ring clear of its neighbours
      let x = 0;
      search: for (let k = 0; k <= width / 3; k++) {
        for (const s of k === 0 ? [0] : [1, -1]) {
          const cand = s * k * 1.5;
          if (Math.abs(cand) + room > width / 2) continue;
          if (placed.every((p) => Math.hypot(p.x - cand, p.y - y) >= p.r + room + 1.5)) { x = cand; break search; }
        }
      }
      placed.push({ x, y, r: room });
      at.set(t.team, { x, y, r, rank: rankOf(t) });
    }
    const avg = py((of + 1) / 2);  // the middle of the league
    return { pool, at, avg, of };
  }, [league, subject.team, rival?.team, mode, width, height, rS, rR, rO]);

  const n = layout.pool.length;
  useEffect(() => {
    if (!seen || entered) return;
    const t = setTimeout(() => setEntered(true), n * 14 + 1100);
    return () => clearTimeout(t);
  }, [seen, entered, n]);

  const name = (t: string) => layout.pool.find((x) => x.team === t)?.name ?? t;
  const pill = (m: Mark, lead: boolean) => {
    const p = layout.at.get(m.team);
    if (!p) return null;
    // the label sits on the side with room; when the two marked teams sit close together, each label goes on its own
    // outer side so neither lands on the other's logo
    const o = layout.at.get(m.team === subject.team ? rival?.team ?? "" : subject.team);
    const close = !!o && o !== p && Math.abs(o.y - p.y) < o.r + p.r + 16;
    const right = close ? p.x > o!.x || (p.x === o!.x && m.team === subject.team) : p.x <= 0;
    const rank = m.rank ?? p.rank;
    return (
      <span aria-hidden className={`pointer-events-none absolute z-[5] flex items-baseline gap-1 whitespace-nowrap ${glide}`}
        style={{ top: (seen ? p.y : layout.avg) - (lead ? (big ? 17 : 13) : 9), left: right ? `calc(50% + ${(seen ? p.x : 0) + p.r + 6}px)` : undefined,
          right: right ? undefined : `calc(50% - ${(seen ? p.x : 0) - p.r - 6}px)`, opacity: seen ? 1 : 0, transitionDelay: entered ? "0ms" : `${n * 14 + 200}ms` }}>
        <b className={`pl-display tabular rounded-md bg-[var(--card)]/90 px-1 leading-none ${lead ? (big ? "text-4xl" : "text-2xl") : big ? "text-xl" : "text-base"}`} style={{ color: m.ink }}>{rank ? ord(rank) : "—"}</b>
      </span>
    );
  };

  return (
    <div role="group" aria-label={label} className="relative mx-auto" style={{ width: "100%", maxWidth: width + (compact ? 40 : big ? 190 : 120), height }}>
      <span className="pl-label absolute top-0 left-0 flex items-center gap-1 text-[10px] text-muted-foreground"><ArrowUp aria-hidden className="size-3" />Best</span>
      <span className="pl-label absolute bottom-0 left-0 flex items-center gap-1 text-[10px] text-muted-foreground"><ArrowDown aria-hidden className="size-3" />Worst</span>
      <span aria-hidden className="absolute inset-x-0 border-t border-dashed border-[var(--viz-axis)]" style={{ top: layout.avg }} />
      <span aria-hidden className="pl-label absolute right-0 text-[10px] text-muted-foreground" style={{ top: layout.avg - 14 }}>Mid</span>
      {layout.pool.map((t, i) => {
        const p = layout.at.get(t.team)!;
        const isS = t.team === subject.team, isR = t.team === rival?.team, quiet = !isS && !isR;
        const delay = entered || !seen ? 0 : isS ? n * 14 + 160 : isR ? n * 14 + 60 : i * 14;
        return (
          <button key={t.team} type="button" aria-label={`${t.name}: ${p.rank ? ord(p.rank) : "unranked"} of ${layout.of}`}
            onMouseEnter={() => setHover(t.team)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(t.team)} onBlur={() => setHover(null)}
            onClick={() => { if (onPick) onPick(t.team); else setHover(hover === t.team ? null : t.team); }}
            className={`absolute grid place-items-center rounded-full ${glide}`}
            style={{ left: `calc(50% + ${(seen ? p.x : 0) - p.r}px)`, top: (seen ? p.y : layout.avg) - p.r, width: p.r * 2, height: p.r * 2,
              opacity: !seen ? 0 : quiet ? (hover === t.team ? 1 : big ? 0.6 : 0.5) : 1, zIndex: isS ? 4 : isR ? 3 : hover === t.team ? 6 : 1, transitionDelay: `${delay}ms` }}>
            <Crest sport={sport} team={t.team} name={t.name} size={Math.round(p.r * 2)} />
            {(isS || isR) && <span aria-hidden className="absolute -inset-1 rounded-full" style={{ boxShadow: `0 0 0 ${isS ? 3 : 2}px ${isS ? subject.ink : rival!.ink}` }} />}
          </button>
        );
      })}
      {pill(subject, true)}
      {rival && layout.at.has(rival.team) && pill(rival, false)}
      {hover && hover !== subject.team && hover !== rival?.team && layout.at.get(hover) && (() => {
        const p = layout.at.get(hover)!;
        return (
          <span aria-hidden className="pointer-events-none absolute z-[7] -translate-x-1/2 rounded-md border bg-background px-2 py-1 text-xs whitespace-nowrap shadow-sm"
            style={{ left: `calc(50% + ${p.x}px)`, top: p.y - p.r - 30 }}>
            {name(hover)} <b className="tabular font-medium">{p.rank ? ord(p.rank) : "—"}</b>
          </span>
        );
      })()}
    </div>
  );
}
