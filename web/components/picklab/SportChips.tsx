"use client";

// The leagues on a page as pills, each with how many games it has there. One tap narrows the page to a league.
import { sportLabel } from "@/lib/ebk";

const SHORT: Record<string, string> = { ncaaf: "CFB" };
const pill = (on: boolean) => `pl-label inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[11px] ${on ? "bg-foreground text-background" : "border text-muted-foreground hover:text-foreground"}`;

export function SportChips({ counts, total, value, onChange }: { counts: Record<string, number>; total: number; value: string | null; onChange: (s: string | null) => void }) {
  const sports = Object.keys(counts);
  if (sports.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="League">
      <button type="button" aria-pressed={!value} onClick={() => onChange(null)} className={pill(!value)}>All<span className="tabular">{total}</span></button>
      {sports.map((s) => (
        <button key={s} type="button" aria-pressed={value === s} onClick={() => onChange(value === s ? null : s)} className={pill(value === s)}>
          {SHORT[s] ?? sportLabel(s)}<span className="tabular">{counts[s]}</span>
        </button>
      ))}
    </div>
  );
}
