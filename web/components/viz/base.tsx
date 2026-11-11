"use client";

// Shared pieces of the chart kit (dataviz skill): tokens, the frame every chart sits in (title, sample size,
// provenance, legend, table twin), the tooltip box and number helpers. Text always wears text tokens; series
// colours go on marks only.

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const VIZ = {
  a: "var(--side-a)",
  b: "var(--side-b)",
  c: "var(--series-3)",
  pos: "var(--viz-pos)",
  neg: "var(--viz-neg)",
  mid: "var(--viz-mid)",
  grid: "var(--viz-grid)",
  axis: "var(--viz-axis)",
  muted: "var(--viz-muted)",
  surface: "var(--card)",
  ink: "var(--foreground)",
} as const;

/** Categorical slots in fixed order (never cycled: a 4th series is a design error, not a new hue). */
export const SLOTS = [VIZ.a, VIZ.b, VIZ.c] as const;

/** Recharts axis props: hairline, recessive, tabular ticks. */
export const axisProps = {
  stroke: VIZ.axis,
  tickLine: false,
  tick: { fill: VIZ.muted, fontSize: 11, style: { fontVariantNumeric: "tabular-nums" } },
} as const;

export const pct = (p: number, digits = 0) => `${(p * 100).toFixed(digits)}%`;
export const signed = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}`;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Where a chart's numbers came from (rule 7): shown as a footnote, full detail on hover. */
export interface Provenance {
  label: string;
  url?: string;
  fetchedAt?: string;
}

export interface LegendItem {
  label: string;
  color: string;
  /** Mirror the mark: a line key for lines, a square for bars/areas, a dot for points, a tick for markers. */
  shape?: "line" | "box" | "dot" | "tick";
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length < 2) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground", className)} aria-label="Legend">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <Key color={it.color} shape={it.shape} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function Key({ color, shape = "box" }: { color: string; shape?: LegendItem["shape"] }) {
  const cls =
    shape === "line" ? "h-0.5 w-3.5 rounded-full"
      : shape === "dot" ? "size-2 rounded-full"
        : shape === "tick" ? "h-3 w-0.5 rounded-full"
          : "size-2.5 rounded-[3px]";
  return <span className={cn("inline-block shrink-0", cls)} style={{ backgroundColor: color }} aria-hidden />;
}

/** Tooltip box: the value leads (strong), the label follows (muted); rows keyed with a short line of the series colour. */
export function TipBox({ title, rows, note }: {
  title?: ReactNode;
  rows: { label: ReactNode; value: ReactNode; color?: string }[];
  note?: ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-md border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-sm">
      {title != null && <p className="text-muted-foreground">{title}</p>}
      {rows.map((r, i) => (
        <p key={i} className="flex items-center gap-2">
          {r.color && <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />}
          <span className="font-medium tabular">{r.value}</span>
          <span className="text-muted-foreground">{r.label}</span>
        </p>
      ))}
      {note != null && <p className="max-w-56 text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Small absolutely-positioned tooltip for the HTML/SVG charts (Recharts ones use its own Tooltip with TipBox). */
export function FloatTip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full pb-2" style={{ left: x, top: y }}>
      {children}
    </div>
  );
}

export interface TableView {
  columns: string[];
  rows: (string | number)[][];
}

/**
 * The frame every kit chart sits in: title + subtitle, optional legend, the plot, then a footnote with the sample size
 * (rule 8) and provenance (rule 7), and a "Table" toggle with the same numbers (tooltips never gate a value).
 */
export function ChartFrame({ title, subtitle, legend, sample, source, table, className, children }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  sample?: ReactNode;
  source?: Provenance;
  table?: TableView;
  className?: string;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  return (
    <figure className={cn("grid min-w-0 gap-2", className)}>
      {(title || subtitle) && (
        <figcaption className="grid gap-0.5">
          {title && <span className="text-sm font-medium">{title}</span>}
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </figcaption>
      )}
      {legend && <Legend items={legend} />}
      <div className="relative min-w-0">{children}</div>
      {(sample || source || table) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {sample && <span className="tabular">{sample}</span>}
          {source && <SourceNote source={source} />}
          {table && (
            <button type="button" className="ml-auto underline-offset-2 hover:text-foreground hover:underline"
              aria-expanded={showTable} aria-controls={id} onClick={() => setShowTable((v) => !v)}>
              {showTable ? "Hide table" : "Table"}
            </button>
          )}
        </div>
      )}
      {table && showTable && (
        <div id={id} className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                {table.columns.map((c, i) => (
                  <th key={c} className={cn("py-1 pr-2 font-normal", i > 0 && "text-right")}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {r.map((v, j) => <td key={j} className={cn("py-1 pr-2", j > 0 && "text-right")}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

function SourceNote({ source }: { source: Provenance }) {
  const when = source.fetchedAt ? new Date(source.fetchedAt).toLocaleString() : null;
  const hover = [source.label, source.url, when && `fetched ${when}`].filter(Boolean).join(" · ");
  const body = <>Source: {source.label}{when ? ` · ${when}` : ""}</>;
  return source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer" title={hover} className="hover:text-foreground hover:underline">{body}</a>
  ) : (
    <span title={hover}>{body}</span>
  );
}
