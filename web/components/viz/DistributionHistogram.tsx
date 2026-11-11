"use client";

// Distribution histogram with a marked line (a spread, a total, a prop line). Bins above the line take the series
// colour, bins below recede to grey, and the two tail probabilities are written above the plot, so "how much of the
// distribution clears the line" reads at a glance. A push (a bin exactly on the line) is counted separately.

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, TipBox, VIZ, axisProps, pct, type Provenance } from "./base";

export interface Bin {
  /** Bin value (e.g. a home margin of +3, a total of 44). */
  x: number;
  /** Probability mass of the bin (the bins sum to ~1). */
  p: number;
}

export interface Mark {
  x: number;
  label: string;
}

/** Mass above / on / below a line. Exported for tests and for callers that print the numbers elsewhere. */
export function tails(bins: Bin[], line: number) {
  let above = 0, below = 0, push = 0;
  for (const b of bins) {
    if (b.x > line) above += b.p;
    else if (b.x < line) below += b.p;
    else push += b.p;
  }
  return { above, below, push };
}

export function DistributionHistogram({ bins, line, marks = [], xLabel = (x) => String(x), aboveLabel = "Above",
  belowLabel = "Below", pushLabel = "push", title, subtitle, sample, source, height = 220, color = VIZ.a, exact, animate = false }: {
  bins: Bin[];
  /** Exact tail masses at the line from the caller (e.g. the raw simulation), printed instead of sums of the bins. */
  exact?: { above: number; below: number; push: number };
  /** The line whose tails are reported and coloured. */
  line?: Mark;
  /** Extra reference marks (model mean, a second book's line); drawn thinner, without tails. */
  marks?: Mark[];
  xLabel?: (x: number) => string;
  aboveLabel?: string;
  belowLabel?: string;
  /** What a bin exactly on the line is called ("push" against a betting line, "level after regulation" against zero). */
  pushLabel?: string;
  title?: string;
  subtitle?: string;
  sample?: string;
  source?: Provenance;
  height?: number;
  color?: string;
  /** Ease bar heights when the bins change (model explainer sliders); off for static charts. */
  animate?: boolean;
}) {
  const t = line ? (exact ?? tails(bins, line.x)) : null;
  const xs = bins.map((b) => b.x);
  const step = bins.length > 1 ? Math.min(...bins.slice(1).map((b, i) => b.x - bins[i].x)) : 1;
  return (
    <ChartFrame title={title} subtitle={subtitle} sample={sample} source={source}
      table={{ columns: ["Value", "Probability"], rows: bins.map((b) => [xLabel(b.x), pct(b.p, 1)]) }}>
      {t && line && (
        <div className="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
          <span><span className="text-sm font-semibold">{pct(t.above)}</span> <span className="text-muted-foreground">{aboveLabel} {line.label}</span></span>
          <span><span className="text-sm font-semibold">{pct(t.below)}</span> <span className="text-muted-foreground">{belowLabel}</span></span>
          {t.push > 0.0005 && <span><span className="font-medium tabular">{pct(t.push, 1)}</span> <span className="text-muted-foreground">{pushLabel}</span></span>}
        </div>
      )}
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
            <CartesianGrid stroke={VIZ.grid} vertical={false} />
            <XAxis dataKey="x" type="number" domain={[Math.min(...xs) - step / 2, Math.max(...xs) + step / 2]}
              tickFormatter={xLabel} allowDecimals={false} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={(v: number) => pct(v)} width={36} axisLine={false} {...axisProps} />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} isAnimationActive={false} content={(p) => {
              const b = p.payload?.[0]?.payload as Bin | undefined;
              if (!p.active || !b) return null;
              return <TipBox rows={[{ label: xLabel(b.x), value: pct(b.p, 1) }]} />;
            }} />
            <Bar dataKey="p" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={animate} animationDuration={250} animationEasing="ease-out">
              {bins.map((b) => (
                <Cell key={b.x} fill={!line || b.x > line.x ? color : VIZ.muted}
                  fillOpacity={!line || b.x > line.x ? 1 : 0.45} />
              ))}
            </Bar>
            {marks.map((mk) => (
              <ReferenceLine key={mk.label} x={mk.x} stroke={VIZ.muted} strokeWidth={1}
                label={{ value: mk.label, position: line && mk.x < line.x ? "insideTopRight" : "insideTopLeft", offset: 4,
                  fill: "var(--muted-foreground)", fontSize: 10 }} />
            ))}
            {line && (
              <ReferenceLine x={line.x} stroke={VIZ.ink} strokeWidth={1.5}
                label={{ value: line.label, position: "top", fill: "var(--foreground)", fontSize: 11 }} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
