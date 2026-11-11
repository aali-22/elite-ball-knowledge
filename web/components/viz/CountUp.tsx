"use client";

// Animated count-up number and the stat tile built on it (dataviz "figures"): label, value, optional signed delta
// coloured by direction × whether up is good (with an arrow, never colour alone), optional sparkline, sample size.
// Big values use proportional figures; the animation is skipped under reduced motion and the final value is always
// what screen readers and the first paint after it see.

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CountUp({ value, format = (v) => v.toFixed(0), duration = 0.7, className }: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const ctl = animate(from.current, value, {
      duration, ease: "easeOut",
      onUpdate: (v) => setShown(v),
      onComplete: () => { from.current = value; },
    });
    return () => {
      ctl.stop();
      from.current = value;
    };
  }, [value, duration, reduce]);
  return (
    <span className={className} aria-label={format(value)}>
      <span aria-hidden>{format(shown)}</span>
    </span>
  );
}

export function StatTile({ label, value, format, delta, deltaLabel, upIsGood = true, trend, sample, className }: {
  label: string;
  value: number | null;
  format?: (v: number) => string;
  /** Signed change vs a named period (deltaLabel), already in display units. */
  delta?: number | null;
  deltaLabel?: string;
  upIsGood?: boolean;
  /** e.g. a <Sparkline />. */
  trend?: ReactNode;
  sample?: string;
  className?: string;
}) {
  const good = delta != null && delta !== 0 && (delta > 0) === upIsGood;
  const tone = delta == null || delta === 0 ? "text-muted-foreground" : good ? "text-[var(--status-good)]" : "text-[var(--status-critical)]";
  return (
    <div className={cn("grid gap-1 rounded-lg border bg-card px-3 py-2.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold leading-none">
          {value == null ? "–" : <CountUp value={value} format={format} />}
        </span>
        {trend}
      </div>
      {(delta != null || sample) && (
        <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
          {delta != null && (
            <span className={cn("font-medium tabular", tone)}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {format ? format(Math.abs(delta)) : Math.abs(delta)}
              {deltaLabel && <span className="ml-1 font-normal text-muted-foreground">{deltaLabel}</span>}
            </span>
          )}
          {sample && <span className="text-muted-foreground tabular">{sample}</span>}
        </div>
      )}
    </div>
  );
}
