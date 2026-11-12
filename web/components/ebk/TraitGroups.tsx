"use client";

// A team's stats, grouped by the part of the game each belongs to (threes, the glass, the pass rush…) under that part's
// drawing, in the same order on every page. Each row is one stat on the league-percentile scale with its rank; the
// table behind the chart lists every number.
import { ChartFrame } from "@/components/viz/base";
import { fmtValue, ord, pctOf, rankOf, type TraitMeta, type TraitValue } from "@/lib/ebk";
import { StatGlyph, partOf, partOrder, sideOf } from "./StatGlyph";

const ease = "transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
const SIDE: Record<string, string> = { Offense: "Off", Defense: "Def", Game: "Game", Player: "" };

export function TraitGroups({ traits, meta, color, seen }: { traits: TraitValue[]; meta: TraitMeta[]; color: string; seen: boolean }) {
  const spec = new Map(meta.map((m) => [m.id, m]));
  const rows = traits.flatMap((t) => { const m = spec.get(t.trait), p = pctOf(t); return m && p != null ? [{ t, m, p, part: partOf(m.id) }] : []; });
  const groups = [...new Map(rows.map((r) => [r.part.key, r.part])).values()].sort((a, b) => partOrder(a.key) - partOrder(b.key))
    .map((part) => ({ part, rows: rows.filter((r) => r.part.key === part.key).sort((a, b) => b.p - a.p) }));
  return (
    <ChartFrame title="Identity, by part of the game" subtitle="League percentile of each stat, strongest first within its part" sample={`${rows.length} stats`}
      table={{ columns: ["Part of the game", "Stat", "Value as played", "Rank as played", "Rank, schedule taken out", "Sample"], rows: groups.flatMap((g) => g.rows.map((r) => [g.part.name, r.m.label, fmtValue(r.t.value, r.m.measure),
        r.t.rank ? `${ord(r.t.rank)} of ${r.t.of}` : "—", r.t.adj_rank ? `${ord(r.t.adj_rank)} of ${r.t.of}` : "not adjusted", r.t.n ? `n=${r.t.n}` : "—"])) }}>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {groups.map((g, gi) => (
          <section key={g.part.key} className="grid content-start gap-2">
            <h3 className="flex items-center gap-2.5 border-b pb-2">
              <StatGlyph trait={g.rows[0].m.id} size={32} className="rounded-lg" />
              <span className="pl-label text-[11px]">{g.part.name}</span>
            </h3>
            <ul className="grid gap-1.5">
              {g.rows.map((r, i) => (
                <li key={r.m.id} className="grid grid-cols-[minmax(0,1fr)_3.4rem] items-center gap-x-3 gap-y-0.5" title={r.m.description}>
                  <span className="flex min-w-0 items-baseline gap-1.5 text-xs">
                    <span className="truncate">{r.m.label}</span>
                    {SIDE[sideOf(r.m.id)] && <span className="pl-label shrink-0 text-[9px] text-muted-foreground">{SIDE[sideOf(r.m.id)]}</span>}
                  </span>
                  <span className="tabular row-span-2 text-right text-sm">{rankOf(r.t) ? <><b className="pl-display text-lg leading-none">{ord(rankOf(r.t)!)}</b><span className="text-[10px] text-muted-foreground">/{r.t.of}</span></> : "—"}</span>
                  <span className="relative block h-1.5 rounded-full bg-muted">
                    <span className={`absolute inset-y-0 left-0 rounded-full ${ease}`} style={{ width: `${(seen ? Math.max(r.p, 0.02) : 0) * 100}%`, background: color, opacity: 0.35 + 0.65 * r.p, transitionDelay: `${Math.min(gi * 3 + i, 20) * 18}ms` }} />
                    <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--card)]" />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ChartFrame>
  );
}
