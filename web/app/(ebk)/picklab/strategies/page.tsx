"use client";

// PickLab's own record: the allowlisted paper strategies (single bets, flat 1 unit, price frozen at selection), stats
// recomputed over the picks whose inputs are all public (api/public/router.py). Retrospective backtests never appear.
import { PageHeader } from "@/components/common/PageHeader";
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

function StrategyCard({ s }: { s: PublicStrategy }) {
  const st = s.stats;
  return (
    <article className="pl-reading grid gap-4 rounded-xl border p-4 sm:p-5">
      <header className="grid gap-1">
        <h2 className="pl-matchup text-2xl">{s.name}</h2>
        <p className="text-sm text-muted-foreground">{s.description}</p>
      </header>
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
        <ul className="divide-y text-sm">
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
      )}
    </article>
  );
}

export default function PublicStrategiesPage() {
  const { data, isLoading } = usePublicStrategies();
  const shown = (data ?? []).filter((s) => s.stats.picks > 0);
  return (
    <div className="grid gap-8">
      <PageHeader title="Our record" eyebrow="Paper picks, 1 unit each"
        lede="PickLab's own strategies, run every day: single bets at the price seen when they were picked, graded on results and against the closing line. Two controls (favourites and random picks) show what luck looks like. No backtests here." />
      <dl className="grid gap-x-8 gap-y-2 rounded-2xl border p-4 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
        <div><dt className="pl-label text-[10px] text-foreground">Units</dt><dd>Profit or loss at one unit staked per pick, at the price taken.</dd></div>
        <div><dt className="pl-label text-[10px] text-foreground">Hit vs market</dt><dd>How often the picks won, next to how often the market expected them to win at the prices taken. Beating the second number is the point.</dd></div>
        <div><dt className="pl-label text-[10px] text-foreground">Avg CLV</dt><dd>Closing-line value: how much better the price taken was than the last price before the game. Positive means the market moved toward the pick.</dd></div>
        <div><dt className="pl-label text-[10px] text-foreground">Controls</dt><dd>Two strategies with no idea behind them (favourites, and random picks). A real strategy has to beat them to mean anything.</dd></div>
      </dl>
      {isLoading && <Skeleton className="h-64 rounded-xl" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((s) => (
          <div key={s.id} className="contents">
            <StrategyCard s={s} />
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
