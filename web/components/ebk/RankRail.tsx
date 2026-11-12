"use client";

// A finding's numbers as a small picture, drawn from the finding alone (no request, so it is safe in a grid of cards):
// a short ruler of the league, best at the top, with the logo (or the player's face) at the height its rank puts it.
// The same rank spacing as the full league chart, so a logo here and there sit at the same place. Which picture depends
// on the finding: two teams on one stat share a ruler; two different stats get a ruler each; a schedule finding shows
// one logo moving from the rank as played to the rank without the schedule. The ticks are a ruler, not other teams.
// Nothing here can be pointed at or pressed: it sits inside the card's link.
import { useReducedMotion } from "framer-motion";
import { ord } from "@/lib/ebk";
import { frame, vizOf, nameIn, type Num, type Teams } from "@/lib/framing";
import type { Insight } from "@/lib/ebk";
import { AWAY, HOME } from "@/lib/site";
import { Crest, Face } from "./Crest";
import { StatGlyph } from "./StatGlyph";

const glide = "transition-[top,opacity] duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
const PAD = 15;  // room for half a logo above the best rank and below the worst

/** Where a rank sits on a ruler `h` tall: 1st at the top, last at the bottom, equal steps between. */
export const rankY = (rank: number, of: number, h: number) => PAD + ((Math.min(Math.max(rank, 1), of) - 1) / Math.max(1, of - 1)) * (h - 2 * PAD);

function Ruler({ of, h, ys, children, head }: { of: number; h: number; ys: number[]; children: React.ReactNode; head?: React.ReactNode }) {
  // an end's number gives way to a logo sitting on it
  const top = !ys.some((y) => y < PAD + 14), bottom = !ys.some((y) => y > h - PAD - 14);
  return (
    <span className="grid justify-items-start gap-1">
      {head}
      <span aria-hidden className="relative block w-[4.6rem]" style={{ height: h }}>
        <span className="absolute left-[13px] w-px bg-[var(--viz-axis)]" style={{ top: PAD, bottom: PAD }} />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <span key={t} className="absolute left-[10px] h-px w-[7px] bg-[var(--viz-axis)]" style={{ top: PAD + t * (h - 2 * PAD) }} />
        ))}
        {top && <span className="pl-label tabular absolute left-[13.5px] -translate-x-1/2 text-[9px] leading-none text-muted-foreground/70" style={{ top: 0 }}>1</span>}
        {bottom && <span className="pl-label tabular absolute left-[13.5px] -translate-x-1/2 text-[9px] leading-none text-muted-foreground/70" style={{ bottom: 0 }}>{of}</span>}
        {children}
      </span>
    </span>
  );
}

function Mark({ top, ink, rank, seen, from, children }: { top: number; ink: string; rank: number; seen: boolean; from: number; children: React.ReactNode }) {
  return (
    <span className={`absolute left-0 flex items-center gap-1.5 ${glide}`} style={{ top: (seen ? top : from) - 13, opacity: seen ? 1 : 0 }}>
      <span className="grid size-[26px] place-items-center overflow-hidden rounded-full bg-[var(--card)]" style={{ boxShadow: `0 0 0 2px ${ink}` }}>{children}</span>
      <b className="pl-display tabular rounded bg-[var(--card)]/90 px-0.5 text-[15px] leading-none" style={{ color: ink }}>{ord(rank)}</b>
    </span>
  );
}

/** One mark on one ruler: any single rank (a player at his position, a team on a stat), with whatever stands for it. */
export function OneRail({ rank, of, ink, seen: inView, label, height = 104, children }: { rank: number; of: number; ink: string; seen: boolean; label: string; height?: number; children: React.ReactNode }) {
  const seen = useReducedMotion() ? true : inView;
  const y = rankY(rank, of, height);
  return (
    <span role="img" aria-label={label} className="inline-grid">
      <Ruler of={of} h={height} ys={[y]}><Mark top={y} from={height / 2} ink={ink} rank={rank} seen={seen}>{children}</Mark></Ruler>
    </span>
  );
}

/** The picture for one finding, or nothing when its numbers carry no league rank. */
export function RankRail({ i, g, sport, seen: inView, height = 104, bare = false }: {
  i: Insight; g: Teams; sport: string; seen: boolean; height?: number; bare?: boolean;  // bare: no small stat drawings over a pair's rulers (a row that already shows one)
}) {
  const seen = useReducedMotion() ? true : inView;  // a visitor who asked for less motion never waits for a logo to arrive
  const fr = frame(i, g), v = vizOf(i), [a, b] = i.numbers;
  const ink = (team?: string | null) => (team === g.home.team ? HOME.ink : team === g.away.team ? AWAY.ink : "var(--viz-muted)");
  const crest = (team?: string | null) => <Crest sport={sport} team={team ?? ""} name={nameIn(g, team)} size={20} color={ink(team)} />;
  const mid = height / 2;
  const said = (x: Num, who = nameIn(g, x.team)) => `${who} ${ord(x.rank ?? 0)} of ${x.of} in ${x.label.toLowerCase()}`;

  if (fr.shape === "shift" && v.raw_rank && v.of) {
    const raw = v.raw_rank, adj = v.adj_rank ?? raw, yr = rankY(raw, v.of, height), ya = rankY(adj, v.of, height), c = ink(v.team);
    return (
      <span role="img" aria-label={`${nameIn(g, v.team)}: ${ord(raw)} of ${v.of} as played, ${ord(adj)} with the schedule taken out`} className="inline-grid">
        <Ruler of={v.of} h={height} ys={[yr, ya]}>
          {adj !== raw && (
            <>
              <span className="absolute left-[12px] w-[3px] rounded-full" style={{ top: Math.min(yr, ya), height: Math.abs(yr - ya), background: `color-mix(in oklab, ${c} 55%, transparent)` }} />
              <span className="absolute left-[4px] size-[19px] rounded-full border border-dashed border-muted-foreground/70 bg-[var(--card)]" style={{ top: yr - 9.5 }} />
              {/* the rank as played, struck through; left out when the two ranks sit too close for both labels to be read */}
              {Math.abs(yr - ya) >= 15 && <span className="pl-label tabular absolute left-[30px] text-[10px] leading-none text-muted-foreground line-through" style={{ top: yr - 5 }}>{ord(raw)}</span>}
            </>
          )}
          {/* the logo starts where the team ranks as played and moves to where it ranks without the schedule */}
          <Mark top={ya} from={yr} ink={c} rank={adj} seen={seen}>{crest(v.team)}</Mark>
        </Ruler>
      </span>
    );
  }
  if (fr.shape === "clash" && a?.rank && b?.rank) {
    const of = Math.max(a.of ?? 0, b.of ?? 0, a.rank, b.rank);
    return (
      <span role="img" aria-label={`${said(a)}; ${said(b)}`} className="inline-grid">
        <Ruler of={of} h={height} ys={[rankY(a.rank, of, height), rankY(b.rank, of, height)]}>
          <Mark top={rankY(a.rank, of, height)} from={mid} ink={ink(a.team)} rank={a.rank} seen={seen}>{crest(a.team)}</Mark>
          <Mark top={rankY(b.rank, of, height)} from={mid} ink={ink(b.team)} rank={b.rank} seen={seen}>{crest(b.team)}</Mark>
        </Ruler>
      </span>
    );
  }
  if ((fr.shape === "pair" || fr.shape === "player") && a?.rank && b?.rank) {
    const ofA = Math.max(a.of ?? 0, a.rank), ofB = Math.max(b.of ?? 0, b.rank);
    const head = (x: Num) => (bare ? undefined : <StatGlyph trait={x.trait} size={22} className="ml-0.5 rounded-md" />);
    return (
      <span role="img" aria-label={`${said(a, v.player ?? undefined)}; ${said(b)}`} className="inline-flex gap-1">
        <Ruler of={ofA} h={height} ys={[rankY(a.rank, ofA, height)]} head={head(a)}>
          <Mark top={rankY(a.rank, ofA, height)} from={mid} ink={ink(a.team)} rank={a.rank} seen={seen}>
            {v.player ? <Face playerId={v.player_id ?? ""} name={v.player} size={26} color={ink(a.team)} /> : crest(a.team)}
          </Mark>
        </Ruler>
        <Ruler of={ofB} h={height} ys={[rankY(b.rank, ofB, height)]} head={head(b)}>
          <Mark top={rankY(b.rank, ofB, height)} from={mid} ink={ink(b.team)} rank={b.rank} seen={seen}>{crest(b.team)}</Mark>
        </Ruler>
      </span>
    );
  }
  return null;
}
