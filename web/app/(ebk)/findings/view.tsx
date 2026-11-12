"use client";

// Every finding on the slate in one place, strongest first: pick a kind and a sport, open the game it came from.
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { SportPicker } from "@/components/ebk/Controls";
import { DataNote } from "@/components/ebk/DataNote";
import { FindingCard, FromGame } from "@/components/ebk/FindingCard";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/viz/CountUp";
import { useUrlChoice, useUrlState } from "@/lib/urlState";
import { KIND, gameHref, useFindings, useSlate, type Insight } from "@/lib/ebk";
import { LoadError } from "@/components/ebk/LoadError";
import { SeasonNote } from "@/components/ebk/SeasonNote";

type Kind = Insight["kind"] | "all";
const ORDER: Insight["kind"][] = ["mismatch", "star", "mirage", "hidden", "real", "clash", "sim", "form"];

export function FindingsView() {
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
        lede="Every finding on the games coming up, strongest first. Open a card's league to see every team on that stat."
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
      <div className="-mt-2 flex flex-wrap items-start gap-2">
        <DataNote summary="How findings are ranked">Strength is the size of the gap between the two numbers, scaled down for a small sample. Each finding is a fixed rule over a game&apos;s computed numbers; nothing here is an opinion.</DataNote>
        {(!sport || sport === "nba") && <SeasonNote />}
      </div>
      {q.isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>}
      {q.isError && <LoadError what="the findings" retry={() => q.refetch()} />}
      {q.data && !q.data.findings.length && <p className="text-sm text-muted-foreground">Nothing of that kind on the slate right now.</p>}
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, more).map((f, i) => (
          <Reveal key={`${f.event_id}:${f.insight.id}`} delay={Math.min(i, 8) * 0.03} className="grid">
            <FindingCard i={f.insight} g={f} sport={f.sport} head={<FromGame g={f} sport={f.sport} href={gameHref(f.event_id)} start={f.start} />} />
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
