"use client";

// Expert leaderboard: the free sites' experts, every pick PickLab could read as a bet graded from final results
// (feeds/grading.py over the public sites only). Data about the sources, not a recommendation. Samples always shown.
import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { pct, signed, usePublicRecords, type PickRecords } from "@/lib/public";

const MIN = 10; // graded picks before a record is more than a small sample (grading.MIN_SAMPLE)
type Row = PickRecords["experts"][number];

function Table({ rows, site }: { rows: Row[]; site?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="pl-label text-left text-[10px] text-muted-foreground">
          <tr className="border-b">
            <th className="p-3 font-normal">{site ? "Site" : "Expert"}</th>
            <th className="p-3 text-right font-normal">W-L-P</th>
            <th className="p-3 text-right font-normal">Hit</th>
            <th className="p-3 text-right font-normal" title="1 unit per pick at the odds the expert listed">Units</th>
            <th className="p-3 text-right font-normal">ROI</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.key} className={r.picks < MIN ? "text-muted-foreground" : ""}>
              <td className="p-3">
                <div className="font-medium text-foreground">{r.label}</div>
                {!site && <div className="text-xs text-muted-foreground">{siteName(r.site_id)}{r.picks < MIN && " · small sample"}</div>}
              </td>
              <td className="p-3 text-right font-mono tabular-nums">{r.won}-{r.lost}-{r.push}</td>
              <td className="p-3 text-right font-mono tabular-nums">{pct(r.hit_pct)}</td>
              <td className="p-3 text-right font-mono tabular-nums" title={`${r.priced} picks with listed odds`}>
                {r.priced ? signed(r.units) : "—"}<span className="ml-1 text-xs text-muted-foreground">({r.priced})</span>
              </td>
              <td className="p-3 text-right font-mono tabular-nums">{r.roi == null ? "—" : `${signed(r.roi * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SITES: Record<string, string> = { covers: "Covers", bettingpros: "BettingPros", actionnetwork: "Action Network" };
const siteName = (id?: string | null) => (id && SITES[id]) || id || "";

export default function PublicExpertsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = usePublicRecords(days);
  // ranked: real samples first, then by hit rate; units can't rank sites that list no odds (Covers)
  const experts = [...(data?.experts ?? [])].sort((a, b) =>
    Number(b.picks >= MIN) - Number(a.picks >= MIN) || (b.hit_pct ?? 0) - (a.hit_pct ?? 0) || b.picks - a.picks);
  return (
    <div className="grid gap-8">
      <PageHeader title="Experts" eyebrow="Graded by PickLab"
        lede="Every pick we could read as a bet, graded from final results. A bet counts once per expert however many articles repeat it. Fewer than ten graded picks is a small sample."
        right={
          <div className="flex gap-1" role="group" aria-label="Window">
            {[30, 90].map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}
                className={`pl-label rounded-full border px-3 py-1.5 text-[11px] ${days === d ? "border-foreground bg-foreground text-background" : "text-muted-foreground"}`}>{d} days</button>
            ))}
          </div>
        } />
      {isLoading && <Skeleton className="h-64 rounded-xl" />}
      {data && (
        <>
          <section className="grid gap-2">
            <h2 className="pl-label text-muted-foreground">By site</h2>
            <Table rows={data.sites} site />
          </section>
          <section className="grid gap-2">
            <h2 className="pl-label text-muted-foreground">By expert · {experts.length}</h2>
            <Table rows={experts} />
          </section>
          <p className="max-w-2xl text-xs text-muted-foreground">{data.method}</p>
        </>
      )}
    </div>
  );
}
