"use client";

// A soccer club in two competitions (its league and the Champions League, backlog I29): both tables side by side (place
// of N, points, W-D-L, goal difference, form, the band its place is in), then the stats both competitions rank as
// "same stat, two leagues" rails, with the schedule switch. A stat only one of them ranks is named as such, the reason
// behind a data note. Each competition is its own league: the two dots are against different fields.
import { useState } from "react";
import { DataNote } from "@/components/ebk/DataNote";
import { BandMark, FormChips, ScheduleSwitch } from "@/components/ebk/LeagueBits";
import { StatGlyph } from "@/components/ebk/StatGlyph";
import { ord, type Standing } from "@/lib/ebk";
import { competitionName } from "@/lib/ebk-queries";
import { LEAGUE_NOTES, SOCCER_STATS, bandOf } from "@/lib/framing";
import { Lock } from "lucide-react";

const gd = (n: number | null | undefined) => (n == null ? "—" : n > 0 ? `+${n}` : String(n));
const rankOf = (s: Standing, trait: string, adj: boolean) => {
  const v = s.traits.find((x) => x.trait === trait);
  return (adj ? v?.adj_rank ?? v?.rank : v?.rank) ?? null;
};
const SECOND = "var(--viz-pos)";  // the second competition's mark: a blue square beside the first's round ink dot

function Table({ s }: { s: Standing }) {
  const band = bandOf(s.competition, s.position, s.of);
  return (
    <section className="pl-reading grid content-start gap-3.5 rounded-3xl border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="pl-label text-[11px] font-normal text-muted-foreground">{competitionName(s.competition) ?? s.competition}{s.competition.startsWith("uefa.") ? " · league phase" : ""}</h3>
        <span className="pl-label tabular text-[11px] text-muted-foreground">{s.played ?? 0} played</span>
      </div>
      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2">
        <span className="pl-display text-7xl leading-[0.8] sm:text-[88px]">{s.position ? ord(s.position) : "—"}</span>
        <span className="pb-1.5 text-[15px] text-muted-foreground">of {s.of}</span>
        <span className="ml-auto grid justify-items-end gap-1.5 pb-1">
          <span className="tabular font-mono text-[22px] font-medium">{s.points ?? "—"} <span className="text-xs text-muted-foreground">PTS</span></span>
          <span className="tabular font-mono text-xs text-muted-foreground">{s.wins ?? 0}-{s.draws ?? 0}-{s.losses ?? 0} · GD {gd(s.goal_diff)}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FormChips form={s.form} size={22} />
        {band && <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><BandMark kind={band.kind} className="h-3.5" />{band.short}</span>}
      </div>
    </section>
  );
}

function Rail({ rank, of, square = false }: { rank: number | null; of: number; square?: boolean }) {
  const p = rank ? (of - rank) / Math.max(1, of - 1) : null;
  return (
    <span aria-hidden className="relative block h-3.5">
      <span className="absolute inset-x-0 top-1.5 h-0.5 rounded-full bg-[var(--viz-axis)]" />
      {p != null && <span className={`absolute top-0 size-3.5 -translate-x-1/2 transition-[left] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${square ? "rounded-[3px]" : "rounded-full bg-foreground"}`}
        style={{ left: `${p * 100}%`, background: square ? SECOND : undefined }} />}
    </span>
  );
}

export function TwoCompetitions({ standings }: { standings: Standing[] }) {
  const [adj, setAdj] = useState(false);
  const [a, b] = standings;
  if (!a || !b) return null;
  const nameA = competitionName(a.competition) ?? a.competition, nameB = competitionName(b.competition) ?? b.competition;
  const has = (s: Standing, id: string) => s.traits.some((v) => v.trait === id && v.rank != null);
  const both = SOCCER_STATS.filter((x) => has(a, x.id) && has(b, x.id));
  const onlyA = SOCCER_STATS.filter((x) => has(a, x.id) && !has(b, x.id)), onlyB = SOCCER_STATS.filter((x) => has(b, x.id) && !has(a, x.id));
  const why = [...(onlyA.length ? b.notes : []), ...(onlyB.length ? a.notes : [])];
  return (
    <section aria-label="Two competitions" className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2"><Table s={a} /><Table s={b} /></div>
      {both.length > 0 && (
        <div className="pl-reading grid gap-1.5 rounded-3xl border p-5 sm:p-6">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="pl-display text-3xl leading-none">Same stat, two leagues</h2>
            <ScheduleSwitch on={adj} onChange={setAdj} sport="soccer" />
          </div>
          <div className="pl-label grid grid-cols-[minmax(0,1fr)_76px] gap-x-4 pb-1 text-[10px] text-muted-foreground sm:grid-cols-[170px_minmax(0,1fr)_96px]">
            <span className="hidden sm:block" /><span className="flex justify-between"><span>Worst</span><span>Best</span></span><span className="text-right">Rank</span>
          </div>
          {both.map((x) => {
            const ra = rankOf(a, x.id, adj), rb = rankOf(b, x.id, adj);
            return (
              <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-x-4 gap-y-2 border-t border-[var(--reading-rule,var(--border))] py-3 sm:grid-cols-[170px_minmax(0,1fr)_96px]"
                aria-label={`${x.label}: ${ra ? ord(ra) : "unranked"} of ${a.of} in the ${nameA}, ${rb ? ord(rb) : "unranked"} of ${b.of} in the ${nameB}`}>
                <span className="col-span-2 flex items-center gap-2.5 text-[15px] sm:col-span-1"><StatGlyph trait={x.id} size={24} className="rounded-md" />{x.label}</span>
                <span className="grid gap-3"><Rail rank={ra} of={a.of} /><Rail rank={rb} of={b.of} square /></span>
                <span className="tabular grid gap-2.5 text-right font-mono text-xs">
                  <span>{ra ? ord(ra) : "—"} <span className="text-muted-foreground">/{a.of}</span></span>
                  <span style={{ color: SECOND }}>{rb ? ord(rb) : "—"} <span className="text-muted-foreground">/{b.of}</span></span>
                </span>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2"><span aria-hidden className="size-3 rounded-full bg-foreground" />{nameA}</span>
            <span className="inline-flex items-center gap-2"><span aria-hidden className="size-3 rounded-[3px]" style={{ background: SECOND }} />{nameB}</span>
            <DataNote summary="Two different fields" className="ml-auto">{LEAGUE_NOTES.club}</DataNote>
          </div>
        </div>
      )}
      {(onlyA.length > 0 || onlyB.length > 0) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {[{ xs: onlyA, n: nameA }, { xs: onlyB, n: nameB }].filter((o) => o.xs.length).map((o) => (
            <span key={o.n} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-dashed px-3.5 text-[13px] text-muted-foreground">
              <Lock aria-hidden className="size-3.5" />{o.xs.map((x) => x.label).join(" · ")}: {o.n} only
            </span>
          ))}
          {why.length > 0 && <DataNote summary="Why">{why.join(" ")}</DataNote>}
        </div>
      )}
    </section>
  );
}
