"use client";

// Every finding on the slate in one place, strongest first: pick a kind and a sport, open the game it came from.
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { InsightCard, sidesOf } from "@/components/ebk/Cards";
import { SportPicker } from "@/components/ebk/Controls";
import { Crest } from "@/components/ebk/Crest";
import { ViewLink } from "@/components/ebk/Shell";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/viz/CountUp";
import { useUrlChoice, useUrlState } from "@/lib/urlState";
import { KIND, SPORT, gameHref, useFindings, useSlate, when, type Insight } from "@/lib/ebk";
import { LoadError } from "@/components/ebk/LoadError";
import { SeasonNote } from "@/components/ebk/SeasonNote";
import { useLocalTime } from "@/lib/localTime";

type Kind = Insight["kind"] | "all";
const ORDER: Insight["kind"][] = ["mismatch", "star", "mirage", "hidden", "real", "clash", "sim", "form"];

export function FindingsView() {
  const local = useLocalTime();
  const [sport, setSport] = useUrlChoice("sport");
  const [kind, setKind] = useUrlState<Kind>("kind", "all", ["all", ...ORDER]);
  const slate = useSlate(undefined, 5);
  const q = useFindings(sport, kind === "all" ? null : kind);
  const kinds = q.data?.kinds ?? {};
  const total = Object.values(kinds).reduce((a, b) => a + b, 0);
  const have = ORDER.filter((k) => kinds[k]);
  const [more, setMore] = useState(24);
  // a kind that the chosen sport doesn't have is never left selected out of sight
  useEffect(() => { if (q.data && kind !== "all" && !q.data.kinds[kind]) setKind("all"); }, [q.data, kind, setKind]);
  useEffect(() => { setMore(24); }, [sport, kind]);
  const list = q.data?.findings ?? [];
  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:py-10">
      <PageHeader title="Findings" size="lg" eyebrow={<span>What the numbers noticed</span>}
        lede="Every finding on the games coming up, strongest first (the size of the gap, scaled down for a small sample). Each one is a fixed rule over a game's computed numbers, shown with the chart behind it and a link to the full breakdown."
        right={<SportPicker sports={slate.data?.sports ?? []} value={sport} onChange={setSport} />} />
      <div className="grid gap-4 border-t pt-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="grid gap-1"><span className="pl-display text-6xl"><CountUp value={total} /></span><span className="pl-label text-[10px] text-muted-foreground">Findings on the slate</span></div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {(["all", ...have] as Kind[]).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={`pl-label inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-2 text-[10px] ${kind === k ? "bg-foreground text-background" : "border text-muted-foreground hover:text-foreground"}`}>
              {k === "all" ? "All" : KIND[k]}<span className="tabular">{k === "all" ? total : kinds[k]}</span>
            </button>
          ))}
        </div>
      </div>
      {(!sport || sport === "nba") && <SeasonNote className="-mt-2" />}
      {q.isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>}
      {q.isError && <LoadError what="the findings" retry={() => q.refetch()} />}
      {q.data && !q.data.findings.length && <p className="text-sm text-muted-foreground">Nothing of that kind on the slate right now.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, more).map((f, i) => (
          <Reveal key={`${f.event_id}:${f.insight.id}`} delay={Math.min(i, 8) * 0.03} className="grid">
            <ViewLink href={gameHref(f.event_id)} className="group grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-2xl border transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-foreground/40">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2">
                {(f.sport === "soccer" ? [f.home, f.away] : [f.away, f.home]).map((t) => <Crest key={t.team} sport={f.sport} team={t.team} name={t.name} size={20} />)}
                <span className="pl-label min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{f.label}</span>
                <span className="pl-label shrink-0 text-[10px] text-muted-foreground">{SPORT[f.sport] ?? f.sport}{when(f.start) ? ` · ${when(f.start, false, local)!.day}` : ""}</span>
              </div>
              <InsightCard f={f.insight} sides={sidesOf(f)} className="rounded-none border-0" />
            </ViewLink>
          </Reveal>
        ))}
      </div>
      {list.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-t pt-5">
          <span className="pl-label text-muted-foreground">Showing {Math.min(more, list.length)} of {list.length}</span>
          {more < list.length && <button type="button" onClick={() => setMore((n) => n + 24)} className="pl-label min-h-10 rounded-full border px-5 hover:bg-muted">Show 24 more</button>}
        </div>
      )}
    </main>
  );
}
