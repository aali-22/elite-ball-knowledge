"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { GameTile } from "@/components/ebk/Cards";
import { Reveal } from "@/components/motion/Reveal";
import { SPORT, useSlate, when, type Slate } from "@/lib/ebk";

export default function Games() {
  const slate = useSlate(undefined, 10);
  const [sport, setSport] = useState<string | null>(null);
  const days = useMemo(() => {
    const out = new Map<string, Slate["games"]>();
    for (const g of slate.data?.games ?? []) {
      if (sport && g.sport !== sport) continue;
      const key = when(g.start)?.day ?? "Date to be confirmed";
      out.set(key, [...(out.get(key) ?? []), g]);
    }
    return [...out];
  }, [slate.data?.games, sport]);
  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:py-10">
      <PageHeader title="Games" size="lg" eyebrow={<span>Every game with a breakdown</span>}
        lede="Each card opens a full breakdown: both identities, every matchup, and the findings the numbers support. The bar shows which way the board leans."
        right={<div className="flex flex-wrap gap-1" role="group" aria-label="Sport">
          {[null, ...(slate.data?.sports ?? [])].map((s) => (
            <button key={s ?? "all"} type="button" aria-pressed={sport === s} onClick={() => setSport(s)}
              className={`pl-label rounded-full px-3 py-1.5 text-[10px] ${sport === s ? "bg-foreground text-background" : "border text-muted-foreground hover:text-foreground"}`}>{s ? SPORT[s] ?? s : "All"}</button>
          ))}
        </div>} />
      {slate.isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-56 animate-pulse rounded-3xl bg-muted" />)}</div>}
      {slate.isError && <p className="text-sm text-muted-foreground">The slate couldn&apos;t be loaded. Try again in a moment.</p>}
      {!slate.isLoading && !slate.isError && !days.length && <p className="text-sm text-muted-foreground">No games with a breakdown right now.</p>}
      {days.map(([day, games]) => (
        <section key={day} className="grid gap-3">
          <h2 className="pl-label border-t pt-3 text-muted-foreground">{day} · {games.length} {games.length === 1 ? "game" : "games"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g, i) => <Reveal key={g.event_id} delay={Math.min(i, 6) * 0.04}><GameTile g={g} className="h-full min-h-52" /></Reveal>)}
          </div>
        </section>
      ))}
    </main>
  );
}
