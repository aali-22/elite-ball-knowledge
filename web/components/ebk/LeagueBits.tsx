"use client";

// Small pieces the league pages share (soccer's table, the Champions League's bands, a club's two competitions, college
// football): form chips, the schedule switch, the stat chips, a rank rail, the competition pills and the league picker.
// Red (--hot) marks only what the reader has switched on or picked; everything else is ink and greys.
import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SportPicker } from "@/components/ebk/Controls";
import { StatGlyph, partOf } from "@/components/ebk/StatGlyph";
import { track } from "@/lib/analytics";
import { LEAGUE_SPORTS, ord } from "@/lib/ebk";
import { COMPETITIONS } from "@/lib/ebk-queries";
import type { BandKind } from "@/lib/framing";

const WORD: Record<string, string> = { W: "Win", D: "Draw", L: "Loss" };

/** Last results as chips, oldest first: a win solid, a draw mid-grey, a loss an outline, the letter always inside. */
export function FormChips({ form, size = 18 }: { form?: string[] | null; size?: number }) {
  if (!form?.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span role="img" aria-label={`Last ${form.length}, oldest first: ${form.map((r) => WORD[r] ?? r).join(", ")}`} className="inline-flex gap-[3px]">
      {form.map((r, i) => (
        <span key={i} title={WORD[r] ?? r} aria-hidden
          className={`tabular inline-grid shrink-0 place-items-center rounded-[4px] font-mono leading-none ${r === "W" ? "bg-foreground text-background" : r === "D" ? "bg-[color-mix(in_oklab,var(--foreground)_32%,transparent)] text-foreground" : "border-[1.5px] border-muted-foreground text-foreground"}`}
          style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.55)) }}>{r}</span>
      ))}
    </span>
  );
}

/** "Schedule taken out": on shows each rank as if every opponent were average. */
export function ScheduleSwitch({ on, onChange, sport, label = "Schedule taken out", bare = false }: { on: boolean; onChange: (v: boolean) => void; sport: string; label?: string; bare?: boolean }) {
  return (
    <button type="button" aria-pressed={on} aria-label={bare ? "Schedule taken out" : undefined} onClick={() => { onChange(!on); track("schedule_toggle", { on: !on, sport }); }}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 text-[13px] ${bare ? "" : "rounded-full border px-3.5 hover:bg-muted/50"}`}>
      <span aria-hidden className={`relative inline-block h-5 w-[34px] shrink-0 rounded-full transition-colors motion-reduce:transition-none ${on ? "bg-[var(--hot)]" : "bg-muted-foreground/40"}`}>
        <span className={`absolute top-[3px] size-3.5 rounded-full bg-background transition-[left] duration-200 motion-reduce:transition-none ${on ? "left-[17px]" : "left-[3px]"}`} />
      </span>
      {label}
    </button>
  );
}

export type Chip = { id: string; label: string };

/** The stats a page ranks by. A locked chip is a stat this competition leaves out: shown, never pickable. `scroll`: one
 *  row that scrolls sideways inside itself (the phone), never the page. */
export function StatChips({ stats, value, onChange, locked, sport, scroll = false }: {
  stats: Chip[]; value: string; onChange: (id: string) => void; locked: Set<string>; sport: string; scroll?: boolean;
}) {
  return (
    <div role="group" aria-label="Rank by" className={scroll ? "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" : "flex flex-wrap gap-2"}>
      {stats.map((s) => {
        const off = locked.has(s.id), on = s.id === value && !off;
        return (
          <button key={s.id} type="button" aria-pressed={on} disabled={off} title={off ? `${s.label}: not ranked in this competition yet` : undefined}
            onClick={() => { onChange(s.id); track("league_stat_pick", { sport, part: partOf(s.id).key }); }}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors motion-reduce:transition-none ${
              on ? "border-foreground bg-foreground text-background" : off ? "cursor-not-allowed border-dashed text-muted-foreground" : "hover:bg-muted/60"}`}>
            {off ? <Lock aria-hidden className="size-3.5" /> : <StatGlyph trait={s.id} size={20} className={`rounded-md border-0 ${on ? "bg-background/15 text-background" : "bg-transparent"}`} />}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/** One rank on a short horizontal rail, best on the right, with the rank beside it. */
export function RankDot({ rank, of, on = false, className = "" }: { rank: number | null | undefined; of: number; on?: boolean; className?: string }) {
  const p = rank ? (of - rank) / Math.max(1, of - 1) : null;
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span aria-hidden className="relative h-3 min-w-16 flex-1">
        <span className="absolute inset-x-0 top-[5px] h-0.5 rounded-full bg-[var(--viz-axis)]" />
        {p != null && <span className={`absolute top-0 size-3 -translate-x-1/2 rounded-full transition-[left] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${on ? "bg-[var(--hot)]" : "bg-foreground"}`} style={{ left: `${p * 100}%` }} />}
      </span>
      <span className={`tabular w-10 text-right font-mono text-xs ${on ? "text-[var(--hot)]" : "text-muted-foreground"}`}>{rank ? ord(rank) : "—"}</span>
    </span>
  );
}

/** A band's mark: the Champions League places blue, the drop amber (dashed for a play-off), the knockout play-off ink. */
export const BAND_INK: Record<BandKind, string> = {
  europe: "var(--viz-pos)", r16: "var(--viz-pos)", kpo: "var(--foreground)", out: "var(--status-warning)", down: "var(--status-warning)", playoff: "var(--status-warning)",
};
export function BandMark({ kind, className = "" }: { kind: BandKind | null | undefined; className?: string }) {
  if (!kind) return null;
  return <span aria-hidden className={`inline-block w-[3px] rounded-full ${className}`}
    style={kind === "playoff" ? { backgroundImage: `repeating-linear-gradient(${BAND_INK.playoff} 0 3px, transparent 3px 5px)` } : { background: BAND_INK[kind] }} />;
}

/** Every soccer competition with a page, as pills: the current one filled. */
export function CompetitionPills({ current, codes }: { current: string; codes: string[] }) {
  return (
    <nav aria-label="Competition" className="flex flex-wrap gap-2">
      {COMPETITIONS.filter((c) => codes.includes(c.code)).map((c) => (
        <Link key={c.code} href={`/league/soccer/${c.code}`} aria-current={c.code === current ? "page" : undefined} onClick={() => track("league_competition_pick", { sport: "soccer" })}
          className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors motion-reduce:transition-none ${c.code === current ? "border-foreground bg-foreground font-semibold text-background" : "hover:bg-muted/60"}`}>
          {c.name}
        </Link>
      ))}
    </nav>
  );
}

/** The same list as a select, for the phone. */
export function CompetitionSelect({ current, codes }: { current: string; codes: string[] }) {
  const router = useRouter();
  return (
    <label className="pl-label grid gap-1.5 text-[11px] text-muted-foreground">Competition
      <select value={current} onChange={(e) => { track("league_competition_pick", { sport: "soccer" }); router.push(`/league/soccer/${e.target.value}`); }}
        className="h-11 w-full rounded-xl border bg-background px-3 font-sans text-[15px] tracking-normal text-foreground normal-case">
        {COMPETITIONS.filter((c) => codes.includes(c.code)).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
    </label>
  );
}

/** The League picker every league page carries. */
export function LeaguePicker({ value }: { value: string }) {
  const router = useRouter();
  return <SportPicker sports={LEAGUE_SPORTS} value={value} all={false} label="League" onChange={(s) => s && router.push(`/league/${s}`)} />;
}
