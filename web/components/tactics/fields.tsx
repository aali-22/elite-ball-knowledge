"use client";

// Bird's-eye surfaces and pieces for the tactical board. Coordinates are real units: NFL yards (120 × 53.3, end zones
// included, offense moving right), soccer metres (105 × 68, attacking right) and NBA feet (94 × 50, attacking the right
// basket at x = 88.75). Scenes place pieces in those units.
import { useEffect, useRef, useState } from "react";
import { onInk } from "@/lib/teamInk";

export type Pt = [number, number];

/** Position along a path of keyframes at progress t (0..1); `times` spaces the keyframes (default even). */
export function along(path: Pt[], t: number, times?: number[]): Pt {
  if (path.length === 1) return path[0];
  const ts = times ?? path.map((_, i) => i / (path.length - 1));
  if (t <= ts[0]) return path[0];
  for (let i = 1; i < path.length; i++) {
    if (t <= ts[i]) {
      const f = (t - ts[i - 1]) / Math.max(1e-6, ts[i] - ts[i - 1]);
      const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2; // ease in-out
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * e, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * e];
    }
  }
  return path[path.length - 1];
}

/** A looping 0..1 clock with play / pause / step; respects reduced motion (starts paused at the key frame). */
export function useClock(durationMs = 4200) {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [t, setT] = useState(reduced ? 0.7 : 0);
  const [playing, setPlaying] = useState(!reduced);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (last.current != null) setT((x) => (x + (now - last.current!) / durationMs) % 1.15); // brief hold at the end
      last.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, durationMs]);
  return {
    t: Math.min(1, t), playing,
    toggle: () => setPlaying((p) => !p),
    step: (d: number) => { setPlaying(false); setT((x) => Math.max(0, Math.min(1, Math.round((Math.min(1, x) + d) * 10) / 10))); },
    restart: () => { setT(0); setPlaying(true); },
  };
}

export function Field({ children, attack = "#2563eb", defend = "#dc2626", focus }: {
  children: React.ReactNode; attack?: string; defend?: string; focus?: [number, number]; // x range in yards to show
}) {
  const [x0, x1] = focus ?? [0, 120];
  const h = Math.min(57.3, (x1 - x0) * 0.6); // a zoomed scene keeps a landscape frame around the middle of the field
  const y0 = Math.max(-2, Math.min(55.3 - h, 26.65 - h / 2));
  return (
    <svg viewBox={`${x0} ${y0} ${x1 - x0} ${h}`} className="h-auto w-full rounded-lg" role="img" aria-label="Football field, bird's-eye view">
      <rect x={0} y={0} width={120} height={53.3} fill="var(--field-turf, #1f5f35)" />
      <rect x={0} y={0} width={10} height={53.3} fill={defend} opacity={0.35} />
      <rect x={110} y={0} width={10} height={53.3} fill={attack} opacity={0.35} />
      {Array.from({ length: 21 }, (_, i) => 10 + i * 5).map((x) => (
        <line key={x} x1={x} x2={x} y1={0} y2={53.3} stroke="#fff" strokeOpacity={x % 10 === 0 ? 0.55 : 0.25} strokeWidth={x % 10 === 0 ? 0.3 : 0.18} />
      ))}
      {Array.from({ length: 100 }, (_, i) => 10 + i).filter((x) => x % 5).map((x) => (
        <g key={x} stroke="#fff" strokeOpacity={0.35} strokeWidth={0.15}>
          <line x1={x} x2={x} y1={0.4} y2={1.4} /><line x1={x} x2={x} y1={52} y2={53} />
          <line x1={x} x2={x} y1={22.6} y2={23.6} /><line x1={x} x2={x} y1={29.7} y2={30.7} />
        </g>
      ))}
      {[20, 30, 40, 50, 60, 70, 80, 90, 100].map((x) => (
        <text key={x} x={x} y={8} fill="#fff" fillOpacity={0.5} fontSize={3.2} textAnchor="middle" fontFamily="ui-monospace">{x <= 60 ? x - 10 : 110 - x}</text>
      ))}
      <rect x={0} y={0} width={120} height={53.3} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={0.4} />
      {children}
    </svg>
  );
}

export function Pitch({ children }: { children: React.ReactNode }) {
  const line = { stroke: "#fff", strokeOpacity: 0.6, strokeWidth: 0.35, fill: "none" } as const;
  return (
    <svg viewBox="-2 -2 109 72" className="h-auto w-full rounded-lg" role="img" aria-label="Soccer pitch, bird's-eye view">
      <rect x={-2} y={-2} width={109} height={72} fill="var(--pitch-grass, #1e6b3a)" />
      {Array.from({ length: 7 }, (_, i) => <rect key={i} x={i * 15} y={0} width={7.5} height={68} fill="#fff" opacity={0.03} />)}
      <rect x={0} y={0} width={105} height={68} {...line} />
      <line x1={52.5} x2={52.5} y1={0} y2={68} {...line} />
      <circle cx={52.5} cy={34} r={9.15} {...line} />
      <rect x={0} y={13.85} width={16.5} height={40.3} {...line} /><rect x={88.5} y={13.85} width={16.5} height={40.3} {...line} />
      <rect x={0} y={24.85} width={5.5} height={18.3} {...line} /><rect x={99.5} y={24.85} width={5.5} height={18.3} {...line} />
      <rect x={-1.5} y={30.34} width={1.5} height={7.32} {...line} /><rect x={105} y={30.34} width={1.5} height={7.32} {...line} />
      {children}
    </svg>
  );
}

/** NBA court in feet: 94 × 50, baskets 5.25 ft in from each baseline, 22 ft corner threes (3 ft in from the sideline,
 *  14 ft out), 23.75 ft arc, 16 ft lane to the free-throw line at 19 ft. `focus` = x range to show (the attacking half
 *  by default). A dark floor in both themes, so pieces use the dark-theme ink like the turf. */
export const HOOP: Pt = [88.75, 25];
export function Court({ children, focus = [44, 94] }: { children: React.ReactNode; focus?: [number, number] }) {
  const [x0, x1] = focus;
  const line = { stroke: "#fff", strokeOpacity: 0.6, strokeWidth: 0.3, fill: "none" } as const;
  const arc = (base: number, dir: 1 | -1) => { // corner lines from the baseline, then the arc around the basket
    const bx = base - dir * 5.25, dx = Math.sqrt(23.75 ** 2 - 22 ** 2);
    return `M ${base} 3 L ${bx - dir * dx} 3 A 23.75 23.75 0 0 ${dir === 1 ? 0 : 1} ${bx - dir * dx} 47 L ${base} 47`;
  };
  const end = (dir: 1 | -1) => {
    const base = dir === 1 ? 94 : 0, bx = base - dir * 5.25, ft = base - dir * 19;
    return (
      <g key={dir}>
        <rect x={Math.min(base, ft)} y={17} width={19} height={16} {...line} fill="#fff" fillOpacity={0.05} />
        <circle cx={ft} cy={25} r={6} {...line} />
        <path d={`M ${bx} 21 A 4 4 0 0 ${dir === 1 ? 0 : 1} ${bx} 29`} {...line} />
        <path d={arc(base, dir)} {...line} />
        <line x1={base - dir * 4} x2={base - dir * 4} y1={22} y2={28} stroke="#fff" strokeOpacity={0.8} strokeWidth={0.35} />
        <circle cx={bx} cy={25} r={0.75} fill="none" stroke="#f97316" strokeWidth={0.3} />
      </g>
    );
  };
  return (
    <svg viewBox={`${x0 - 1} -1 ${x1 - x0 + 2} 52`} className="h-auto w-full rounded-lg" role="img" aria-label="Basketball court, bird's-eye view">
      <rect x={-1} y={-1} width={96} height={52} fill="var(--court-floor, #22303f)" />
      <rect x={0} y={0} width={94} height={50} {...line} />
      <line x1={47} x2={47} y1={0} y2={50} {...line} />
      <circle cx={47} cy={25} r={6} {...line} />
      {end(1)}{end(-1)}
      {children}
    </svg>
  );
}

export function Player({ at, color, label, r = 1.1, ring }: { at: Pt; color: string; label?: string; r?: number; ring?: boolean }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      {ring && <circle r={r * 1.9} fill="none" stroke="#facc15" strokeWidth={0.3} />}
      <circle r={r} fill={color} stroke="#fff" strokeWidth={0.25} />
      {label && <text y={r * 0.42} fontSize={r * 1.05} textAnchor="middle" fill={onInk(color)} fontWeight={700} fontFamily="ui-sans-serif">{label}</text>}
    </g>
  );
}

export function Ball({ at, soccer, hoops }: { at: Pt; soccer?: boolean; hoops?: boolean }) {
  if (hoops) return <circle cx={at[0]} cy={at[1]} r={0.75} fill="#f97316" stroke="#111" strokeWidth={0.15} />;
  return soccer
    ? <circle cx={at[0]} cy={at[1]} r={0.7} fill="#fff" stroke="#111" strokeWidth={0.15} />
    : <ellipse cx={at[0]} cy={at[1]} rx={0.75} ry={0.45} fill="#8b4513" stroke="#fff" strokeWidth={0.12} />;
}

export function Trail({ path, color, dashed, opacity = 0.7 }: { path: Pt[]; color: string; dashed?: boolean; opacity?: number }) {
  return <polyline points={path.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeOpacity={opacity}
    strokeWidth={0.35} strokeDasharray={dashed ? "1 0.8" : undefined} strokeLinecap="round" />;
}

function light(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) > 160;
}

export function Tag({ at, text, tone = "#111" }: { at: Pt; text: string; tone?: string }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <rect x={-text.length * 0.62} y={-1.9} width={text.length * 1.24} height={2.7} rx={0.6} fill={tone} opacity={0.88} />
      <text y={0} fontSize={1.65} textAnchor="middle" fill={light(tone) ? "#111" : "#fff"} fontWeight={700} fontFamily="ui-sans-serif">{text}</text>
    </g>
  );
}
