"use client";

// PickLab's own record: the allowlisted paper strategies (single bets, flat 1 unit, price frozen at selection), stats
// recomputed over the picks whose inputs are all public (api/public/router.py). Retrospective backtests never appear.
import { usePageTitle } from "@/lib/title";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataNote } from "@/components/ebk/DataNote";
import { ResultChip } from "@/components/public/PublicPickRow";
import { Skeleton } from "@/components/ui/skeleton";
import { localDateTime } from "@/lib/format";
import { american, pct, signed, usePublicStrategies, type PublicStrategy } from "@/lib/public";
import { sportLabel } from "@/lib/ebk";

function Stat({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="grid gap-0.5" title={title}>
      <span className="pl-label text-[10px] text-muted-foreground">{label}</span>
      <span className="font-mono text-lg tabular-nums">{value}</span>
    </div>
  );
}

type Curve = { t: number; u: number }[];
/** A strategy's running total by game time. The API lists the total in the order picks settled; here each pick's
 *  change is put at its own game's start and the total is run again, so the line always moves forward in time. */
function curveOf(s: PublicStrategy): Curve {
  const raw = ((s.stats.curve ?? []) as { date: string; units: number }[]).map((p) => ({ t: new Date(p.date).getTime(), u: Number(p.units) })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.u));
  const steps = raw.map((p, i) => ({ t: p.t, d: p.u - (i ? raw[i - 1].u : 0) })).sort((a, b) => a.t - b.t);
  let sum = 0;
  return steps.map((p) => ({ t: p.t, u: (sum += p.d) }));
}
const MIN_LINE = 5;  // settled picks before a strategy's own line is worth drawing
const isControl = (s: PublicStrategy) => s.id.startsWith("control_");

/** A strategy's running total of units over time, with the two controls behind it in grey on the same scale: what the
 *  idea did beside what no idea did. The dashed line is break-even. */
function Units({ s, controls }: { s: PublicStrategy; controls: PublicStrategy[] }) {
  const mine = curveOf(s), others = controls.filter((c) => c.id !== s.id).map((c) => ({ name: c.name, pts: curveOf(c) })).filter((c) => c.pts.length > 1);
  if (mine.length < MIN_LINE) return null;
  const all = [...mine, ...others.flatMap((o) => o.pts)];
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t));
  const lo = Math.min(0, ...all.map((p) => p.u)), hi = Math.max(0, ...all.map((p) => p.u));
  const W = 320, H = 88, pad = 6;
  const x = (t: number) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * pad - 34);
  const y = (u: number) => pad + (1 - (u - lo) / Math.max(0.01, hi - lo)) * (H - 2 * pad);
  const line = (pts: Curve) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.u).toFixed(1)}`).join(" ");
  const end = mine[mine.length - 1];
  return (
    <figure className="grid gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`${s.name}: ${signed(end.u, 2)} units after ${s.stats.settled} settled picks${others.length ? `; the controls ended at ${others.map((o) => `${signed(o.pts[o.pts.length - 1].u, 2)} (${o.name})`).join(" and ")}` : ""}`}>
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="var(--viz-axis)" strokeDasharray="3 3" />
        {others.map((o) => <path key={o.name} d={line(o.pts)} fill="none" stroke="var(--viz-muted)" strokeWidth={1.25} opacity={0.55} />)}
        <path d={line(mine)} fill="none" stroke="var(--hot)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(end.t)} cy={y(end.u)} r={3.5} fill="var(--hot)" />
        <text x={x(end.t) + 7} y={Math.max(10, Math.min(H - 3, y(end.u) + 4))} className="tabular fill-foreground" fontSize={11} fontWeight={600}>{signed(end.u, 1)}u</text>
      </svg>
      <figcaption className="pl-label flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span aria-hidden className="h-0.5 w-4 rounded bg-[var(--hot)]" />Units over time</span>
        {others.length > 0 && <span className="inline-flex items-center gap-1"><span aria-hidden className="h-0.5 w-4 rounded bg-[var(--viz-muted)]" />The two controls</span>}
      </figcaption>
    </figure>
  );
}

function StrategyCard({ s, controls }: { s: PublicStrategy; controls: PublicStrategy[] }) {
  const st = s.stats;
  return (
    <article className="pl-reading grid gap-4 rounded-xl border p-4 sm:p-5">
      <header className="grid gap-1">
        <h2 className="pl-matchup flex flex-wrap items-baseline gap-x-2 text-2xl">{s.name}{isControl(s) && <span className="pl-label text-[10px] text-muted-foreground">Control: no idea behind it</span>}</h2>
        <p className="text-sm text-muted-foreground">{s.description}</p>
      </header>
      <Units s={s} controls={controls} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="W-L-P" value={`${st.won}-${st.lost}-${st.push}`} title={`${st.picks} picks, ${st.settled} settled with a price`} />
        <Stat label="Units" value={st.settled ? signed(st.units, 2) : "—"} title={st.units_95ci ? `95% range ${st.units_95ci.join(" to ")}` : undefined} />
        <Stat label="Hit vs market" value={<>{pct(st.hit_rate)} <span className="text-sm text-muted-foreground">/ {pct(st.implied_hit_rate)}</span></>}
          title="Hit rate against the average fair probability at selection" />
        <Stat label="Avg CLV" value={st.avg_clv_pct == null ? "—" : `${signed(st.avg_clv_pct * 100)}%`} title={`${st.clv_n} picks with a closing price`} />
      </div>
      {st.settled < 150 && (
        <p className="text-xs text-muted-foreground">{st.settled} settled {st.settled === 1 ? "pick" : "picks"}: too few to read much into yet (about 150 is where ROI starts to mean something).</p>
      )}
      {s.picks.length > 0 && (
        <details className="group/p">
          <summary className="pl-label inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 text-[10px] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            Latest {s.picks.length} {s.picks.length === 1 ? "pick" : "picks"}<ChevronDown aria-hidden className="size-3.5 transition-transform group-open/p:rotate-180 motion-reduce:transition-none" />
          </summary>
        <ul className="mt-2 divide-y text-sm">
          {s.picks.map((p, i) => (
            <li key={`${p.selected_at}-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2">
              <span className="font-medium">{p.selection}</span>
              {american(p.odds) && <span className="font-mono tabular-nums text-muted-foreground">{american(p.odds)}</span>}
              <span className="pl-label text-[10px] text-muted-foreground">{p.market_label}</span>
              <span className="ml-auto"><ResultChip result={p.status === "pending" ? null : p.status} />
                {p.status === "pending" && <span className="pl-label text-[10px] text-muted-foreground">Pending</span>}</span>
              <span className="w-full text-xs text-muted-foreground">
                {sportLabel(p.sport)} · {p.label ?? ""} · {localDateTime(p.start)} · picked {localDateTime(p.selected_at)}
              </span>
            </li>
          ))}
        </ul>
        </details>
      )}
    </article>
  );
}

export default function PublicStrategiesPage() {
  usePageTitle("Our record · PickLab");
  const { data, isLoading } = usePublicStrategies();
  // the strategies with an idea first, the two controls after them
  const shown = (data ?? []).filter((s) => s.stats.picks > 0).sort((a, b) => Number(isControl(a)) - Number(isControl(b)) || b.stats.settled - a.stats.settled);
  const controls = (data ?? []).filter(isControl);
  return (
    <div className="grid gap-8">
      <PageHeader title="Our record" eyebrow="Paper picks, 1 unit each"
        lede="PickLab's own strategies, run every day: single bets at the price seen when picked, graded on results and against the closing line. Two controls show what luck looks like." />
      <DataNote summary="What the numbers mean">
        <span className="block"><b className="font-medium text-foreground">Units</b>: profit or loss at one unit staked per pick, at the price taken. The line on each card is the running total.</span>
        <span className="block"><b className="font-medium text-foreground">Hit vs market</b>: how often the picks won, next to how often the market expected them to win at the prices taken. Beating the second number is the point.</span>
        <span className="block"><b className="font-medium text-foreground">Avg CLV</b>: closing-line value, how much better the price taken was than the last price before the game. Positive means the market moved toward the pick.</span>
        <span className="block"><b className="font-medium text-foreground">Controls</b>: two strategies with no idea behind them (favourites, and random picks), drawn in grey on every card. A real strategy has to beat them to mean anything.</span>
        <span className="block">No backtests here. The strategies run on every sport PickLab follows, so most picks so far are soccer and baseball rather than the NBA and NFL covered on the rest of the site.</span>
      </DataNote>
      {isLoading && <Skeleton className="h-64 rounded-xl" />}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {shown.map((s) => (
          <div key={s.id} className="contents">
            <StrategyCard s={s} controls={controls} />
          </div>
        ))}
      </div>
      {data && shown.length < data.length && (
        <p className="text-xs text-muted-foreground">
          No picks yet in the last 90 days: {data.filter((s) => !s.stats.picks).map((s) => s.name).join(", ")}.
        </p>
      )}
    </div>
  );
}
