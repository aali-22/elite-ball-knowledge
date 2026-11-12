"use client";

// An analyst as a mark and a record, the same wherever analysts appear: initials in a circle (analysts have no logo
// and PickLab shows no photo of them), the name and outlet, and the record with its sample always beside it.
import { outlet, signed, MIN_PRICED, type PickRecords } from "@/lib/public";

type Rec = PickRecords["experts"][number];

export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function Avatar({ name, size = 36, lead = false, square = false }: { name: string; size?: number; lead?: boolean; square?: boolean }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center bg-muted font-semibold ${square ? "rounded-lg" : "rounded-full"}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), boxShadow: lead ? "0 0 0 2px var(--hot)" : "inset 0 0 0 1px var(--border)" }}>
      {initialsOf(name)}
    </span>
  );
}

/** "12-8 · +3.2u (10 priced)": won-lost, then units only when enough picks listed a price to mean anything. */
export function RecordLine({ r, className = "" }: { r: Rec; className?: string }) {
  return (
    <span className={`tabular ${className}`} title={`${r.picks} graded picks, ${r.priced} with a listed price, last 30 days`}>
      {r.won}-{r.lost}{r.push ? `-${r.push}` : ""}
      {r.priced >= MIN_PRICED ? <> · <b className="font-semibold">{signed(r.units)}u</b> <span className="text-muted-foreground">({r.priced} priced)</span></> : <span className="text-muted-foreground"> · {r.picks} graded</span>}
    </span>
  );
}

export function AnalystChip({ r, lead = false }: { r: Rec; lead?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={r.label} size={lead ? 44 : 34} lead={lead} />
      <span className="grid min-w-0">
        <span className={`truncate font-medium ${lead ? "text-base" : "text-sm"}`}>{r.label}</span>
        <span className="truncate text-xs text-muted-foreground">{outlet(r.site_id)} · <RecordLine r={r} className="text-foreground" /></span>
      </span>
    </span>
  );
}
