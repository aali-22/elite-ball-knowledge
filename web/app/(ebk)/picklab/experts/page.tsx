"use client";

// Analyst records: every public pick that reads as a bet, graded against the final score. Sort by what matters to you,
// narrow to one sport, and hide the records too small to mean anything. Two samples sit in every row and are labelled:
// all graded picks (the record and hit rate) and the picks that listed a price (units and ROI).
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Picker } from "@/components/ebk/Controls";
import { Skeleton } from "@/components/ui/skeleton";
import { pct, signed, usePublicRecords, type PickRecords } from "@/lib/public";

const MIN = 10; // graded picks before a record is more than a small sample
const MIN_PRICED = 10; // priced picks before units and ROI are more than noise
type Row = PickRecords["experts"][number];
type Sort = "units" | "roi" | "hit" | "picks";
const SITES: Record<string, string> = { covers: "Covers", bettingpros: "BettingPros", actionnetwork: "Action Network" };
const siteName = (id?: string | null) => (id && SITES[id]) || id || "";
const isDesk = (r: Row) => /\bstaff\b/i.test(r.label);

const value = (r: Row, s: Sort) => (s === "units" ? (r.priced ? r.units : -Infinity) : s === "roi" ? (r.priced >= MIN_PRICED ? r.roi ?? -Infinity : -Infinity)
  : s === "hit" ? (r.picks >= MIN ? r.hit_pct ?? -Infinity : -Infinity) : r.picks);

function Rows({ rows, site }: { rows: Row[]; site?: boolean }) {
  return (
    <ul className="divide-y rounded-2xl border">
      <li className="pl-label hidden grid-cols-[minmax(0,1fr)_7rem_4rem_7.5rem_5rem] gap-3 px-4 py-2.5 text-[10px] text-muted-foreground sm:grid">
        <span>{site ? "Outlet" : "Analyst"}</span><span className="text-right">Won-lost-push</span><span className="text-right">Hit</span>
        <span className="text-right" title="One unit per pick at the price the analyst listed">Units (priced)</span><span className="text-right">ROI</span>
      </li>
      {rows.map((r) => {
        const thin = r.picks < MIN, noPrice = r.priced === 0, fewPriced = r.priced > 0 && r.priced < MIN_PRICED;
        return (
          <li key={r.key} className={`grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_4rem_7.5rem_5rem] sm:items-center ${thin ? "text-muted-foreground" : ""}`}>
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <div className="truncate font-medium text-foreground">{r.label}</div>
              {!site && <div className="text-xs text-muted-foreground">{siteName(r.site_id)}{thin && " · small sample"}</div>}
            </div>
            <div className="tabular text-sm sm:text-right"><span className="pl-label mr-1.5 text-[9px] text-muted-foreground sm:hidden">Record</span>{r.won}-{r.lost}-{r.push}</div>
            <div className="tabular text-right text-sm"><span className="pl-label mr-1.5 text-[9px] text-muted-foreground sm:hidden">Hit</span>{pct(r.hit_pct)}</div>
            <div className="tabular text-sm sm:text-right" title={noPrice ? "None of these picks listed a price, so there are no units to count" : `${r.priced} of ${r.picks} picks listed a price`}>
              <span className="pl-label mr-1.5 text-[9px] text-muted-foreground sm:hidden">Units</span>
              {noPrice ? <span className="text-xs text-muted-foreground">no prices listed</span> : <>{signed(r.units)} <span className="text-xs text-muted-foreground">({r.priced})</span></>}
            </div>
            <div className="tabular text-right text-sm" title={fewPriced ? `From only ${r.priced} priced picks: too few to read` : undefined}>
              <span className="pl-label mr-1.5 text-[9px] text-muted-foreground sm:hidden">ROI</span>
              {r.roi == null || noPrice ? "—" : fewPriced ? <span className="text-muted-foreground">{signed(r.roi * 100)}%*</span> : `${signed(r.roi * 100)}%`}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function PublicExpertsPage() {
  const [days, setDays] = useState<"30" | "90">("30");
  const [sport, setSport] = useState<"all" | "nfl" | "nba" | "ncaaf">("all");
  const [sort, setSort] = useState<Sort>("units");
  const [solid, setSolid] = useState(true);
  const { data, isLoading } = usePublicRecords(Number(days), sport === "all" ? undefined : sport);
  const people = useMemo(() => (data?.experts ?? []).filter((r) => !isDesk(r) && r.picks > 0), [data]);
  const experts = useMemo(() => people.filter((r) => !solid || r.picks >= MIN)
    .sort((a, b) => value(b, sort) - value(a, sort) || b.picks - a.picks), [people, sort, solid]);
  const hidden = people.length - experts.length;
  return (
    <div className="grid gap-8">
      <PageHeader title="Analyst records" eyebrow="Graded against final scores"
        lede="Every public pick that reads as a bet, written down when it was made and graded when the game ended. A bet counts once per analyst however many articles repeat it." />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
        <Picker label="Window" value={days} onChange={setDays} options={[{ value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
        <Picker label="Sport" value={sport} onChange={setSport} options={[{ value: "all", label: "All" }, { value: "nfl", label: "NFL" }, { value: "nba", label: "NBA" }, { value: "ncaaf", label: "College FB" }]} />
        <Picker label="Sort by" value={sort} onChange={setSort} options={[{ value: "units", label: "Units" }, { value: "roi", label: "ROI" }, { value: "hit", label: "Hit rate" }, { value: "picks", label: "Most picks" }]} />
        <label className="flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={solid} onChange={(e) => setSolid(e.target.checked)} className="size-4 accent-[var(--hot)]" />
          Only {MIN}+ graded picks
        </label>
      </div>
      {isLoading && <Skeleton className="h-64 rounded-xl" />}
      {data && (
        <>
          <section className="grid gap-2">
            <h2 className="pl-label text-muted-foreground">By outlet</h2>
            <Rows rows={data.sites} site />
          </section>
          <section className="grid gap-2">
            <h2 className="pl-label text-muted-foreground">By analyst · {experts.length}{hidden > 0 ? ` shown, ${hidden} with fewer than ${MIN} graded picks hidden` : ""}</h2>
            {experts.length ? <Rows rows={experts} /> : <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No analyst has {MIN} graded picks in this window yet. Untick the box to see the small samples.</p>}
          </section>
          <div className="grid max-w-2xl gap-2 text-xs leading-relaxed text-muted-foreground">
            <p><b className="font-medium text-foreground">Two samples per row.</b> The record and hit rate count every graded pick. Units and ROI count only picks that listed a price (the number in brackets), so they can rest on far fewer picks; an asterisk marks an ROI from under {MIN_PRICED}. Some outlets list no prices at all.</p>
            <p>{data.method}</p>
          </div>
        </>
      )}
    </div>
  );
}
