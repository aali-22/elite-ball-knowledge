"use client";

// Analyst records: every public pick that reads as a bet, graded against the final score. Sort by what matters to you,
// narrow to one sport, and hide the records too small to mean anything. Two samples sit in every row and are labelled:
// all graded picks (the record and hit rate) and the picks that listed a price (units and ROI).
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { usePageTitle } from "@/lib/title";
import { useUrlState } from "@/lib/urlState";
import { Picker } from "@/components/ebk/Controls";
import { Skeleton } from "@/components/ui/skeleton";
import { DataNote } from "@/components/ebk/DataNote";
import { LoadError } from "@/components/ebk/LoadError";
import { Avatar } from "@/components/public/Analyst";
import { MIN_GRADED, MIN_PRICED, isDesk as desk, outlet, pct, signed, usePublicRecords, type PickRecords } from "@/lib/public";

const MIN = MIN_GRADED;
type Row = PickRecords["experts"][number];
type Sort = "units" | "roi" | "hit" | "picks";

const value = (r: Row, s: Sort) => (s === "units" ? (r.priced >= MIN_PRICED ? r.units : -Infinity) : s === "roi" ? (r.priced >= MIN_PRICED ? r.roi ?? -Infinity : -Infinity)
  : s === "hit" ? (r.picks >= MIN ? r.hit_pct ?? -Infinity : -Infinity) : r.picks);

/** One row per analyst (or outlet), in rank order: the mark, the record, and the units as a bar that leans right for a
 *  profit and left for a loss, on one scale for the whole list. Both samples are always written out beside the name. */
function Rows({ rows, site, ranked = false }: { rows: Row[]; site?: boolean; ranked?: boolean }) {
  const scale = Math.max(1, ...rows.filter((r) => r.priced > 0).map((r) => Math.abs(r.units)));
  return (
    <ol className="divide-y rounded-2xl border">
      {rows.map((r, i) => {
        const thin = r.picks < MIN, noPrice = r.priced === 0, fewPriced = r.priced > 0 && r.priced < MIN_PRICED;
        const up = r.units >= 0, w = noPrice ? 0 : (Math.abs(r.units) / scale) * 50;
        const lead = ranked && i === 0;
        return (
          <li key={r.key} className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[1.4rem_auto_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] sm:px-4 ${thin ? "text-muted-foreground" : ""}`}>
            <span className="tabular hidden text-xs text-muted-foreground sm:block">{ranked ? i + 1 : ""}</span>
            <Avatar name={r.label} size={lead ? 46 : 36} lead={lead} square={site} />
            <div className="grid min-w-0">
              <span className={`truncate font-medium text-foreground ${lead ? "pl-matchup text-xl" : ""}`}>{r.label}</span>
              <span className="truncate text-xs text-muted-foreground">{site ? "" : `${outlet(r.site_id)} · `}{r.picks} graded · {noPrice ? "no prices listed" : `${r.priced} priced`}{thin ? " · small sample" : ""}</span>
            </div>
            <div className="tabular col-span-2 flex items-baseline gap-2 text-sm sm:col-span-1 sm:justify-end">
              <span>{r.won}-{r.lost}-{r.push}</span><span className="text-muted-foreground">hit {pct(r.hit_pct)}</span>
            </div>
            <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:col-span-1" title={noPrice ? "None of these picks listed a price, so there are no units to count" : `One unit per pick at the price the analyst listed: ${r.priced} of ${r.picks} picks listed one`}>
              <span className="relative block h-2.5 rounded-full bg-muted">
                <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--surface,var(--background))]" />
                {!noPrice && <span className="absolute inset-y-0 rounded-full" style={{ [up ? "left" : "right"]: "50%", width: `${Math.max(w, 1)}%`, background: up ? "var(--status-good)" : "var(--status-critical)", opacity: fewPriced ? 0.45 : 1 }} />}
              </span>
              <span className="tabular w-[7.5rem] text-right text-sm">
                {noPrice ? <span className="text-xs text-muted-foreground">no units</span>
                  : <><b className={lead ? "pl-display text-2xl leading-none" : "font-semibold"}>{signed(r.units)}u</b> <span className="text-xs text-muted-foreground">{r.roi == null ? "" : `${signed(r.roi * 100)}%${fewPriced ? "*" : ""}`}</span></>}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function PublicExpertsPage() {
  usePageTitle("Analyst records · PickLab");
  // the filters live in the address, so a view of the table can be shared
  const [days, setDays] = useUrlState<"30" | "90">("days", "30", ["30", "90"]);
  const [sport, setSport] = useUrlState<"all" | "nfl" | "nba" | "ncaaf">("sport", "all", ["all", "nfl", "nba", "ncaaf"]);
  const [sort, setSort] = useUrlState<Sort>("sort", "units", ["units", "roi", "hit", "picks"]);
  const [solid, setSolid] = useState(true);
  const { data, isLoading, isError, refetch } = usePublicRecords(Number(days), sport === "all" ? undefined : sport);
  const people = useMemo(() => (data?.experts ?? []).filter((r) => !desk(r.label) && r.picks > 0), [data]);
  const money = sort === "units" || sort === "roi";
  const experts = useMemo(() => people.filter((r) => !solid || r.picks >= MIN)
    .sort((a, b) => value(b, sort) - value(a, sort) || b.picks - a.picks), [people, sort, solid]);
  const ranked = money ? experts.filter((r) => r.priced >= MIN_PRICED) : experts;
  const rest = money ? experts.filter((r) => r.priced < MIN_PRICED) : [];
  const hidden = people.length - experts.length;
  return (
    <div className="grid gap-8">
      <PageHeader size="sm" title="Analyst records" eyebrow="Graded against final scores"
        lede="Every public pick that reads as a bet, written down when it was made and graded when the game ended." />
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
      {isError && !data && <LoadError what="the records" retry={() => refetch()} />}
      {data && (
        <>
          <section className="grid gap-2">
            <h2 className="pl-label text-muted-foreground">By outlet</h2>
            <Rows rows={data.sites} site />
          </section>
          <section className="grid gap-2">
            <h2 className="pl-label text-muted-foreground">By analyst · {experts.length}{hidden > 0 ? ` shown, ${hidden} with fewer than ${MIN} graded picks hidden` : ""}</h2>
            {ranked.length > 0 && <Rows rows={ranked} ranked />}
            {rest.length > 0 && (
              <>
                <h3 className="pl-label mt-3 text-[10px] text-muted-foreground">Too few priced picks to rank by money · {rest.length}</h3>
                <Rows rows={[...rest].sort((a, b) => b.picks - a.picks)} />
              </>
            )}
            {experts.length ? null : <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No analyst has {MIN} graded picks in this window yet. Untick the box to see the small samples.</p>}
          </section>
          <DataNote summary="How to read a row">
            <span className="block">The bar is units: one unit staked per pick at the price the analyst listed, right of the middle for a profit, left for a loss, on one scale for the list. The percentage beside it is the return on those units.</span>
            <span className="block">Two samples sit in every row. The record and hit rate count every graded pick; units and return count only picks that listed a price, so they can rest on far fewer. An asterisk marks a return from under {MIN_PRICED} priced picks; some outlets list no prices at all. A bet counts once per analyst however many articles repeat it.</span>
            <span className="block">{data.method}</span>
          </DataNote>
        </>
      )}
    </div>
  );
}
