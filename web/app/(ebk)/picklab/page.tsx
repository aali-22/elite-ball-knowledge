"use client";

// The free public view's front page: upcoming games with the free sites' picks (api/public/router.py: allowlisted
// sources, the pick and a link, never the article text). Ads sit between games and in the rail, never inside a card.
import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { PublicPickRow } from "@/components/public/PublicPickRow";
import { Skeleton } from "@/components/ui/skeleton";
import { localDateTime, relative } from "@/lib/format";
import { usePublicPicks, type PublicGame } from "@/lib/public";
import { SPORT_ORDER, sportLabel } from "@/lib/ebk";


function GameCard({ g }: { g: PublicGame }) {
  return (
    <article className="pl-reading grid gap-3 rounded-xl border p-4 sm:p-5">
      <header className="grid gap-1">
        <div className="pl-label flex flex-wrap gap-x-2 text-muted-foreground">
          <span>{sportLabel(g.sport)}</span>{g.slot && g.slot !== sportLabel(g.sport) && <span>· {g.slot}</span>}
          <span className="ml-auto">{g.final ? "Final" : localDateTime(g.start)}</span>
        </div>
        <h2 className="pl-matchup text-2xl sm:text-3xl">{g.away} <span className="text-muted-foreground">at</span> {g.home}</h2>
      </header>
      <ul className="divide-y">{g.picks.map((p, i) => <PublicPickRow key={`${p.text}-${i}`} p={p} />)}</ul>
    </article>
  );
}

export default function PublicPicksPage() {
  const [sport, setSport] = useState<string | undefined>();
  const { data, isLoading, error } = usePublicPicks();
  const sports = useMemo(() => {
    const have = new Set(data?.games.map((g) => g.sport));
    return SPORT_ORDER.filter((s) => have.has(s));
  }, [data]);
  const games = (data?.games ?? []).filter((g) => !sport || g.sport === sport);
  const picks = games.reduce((n, g) => n + g.picks.length, 0);
  return (
    <div className="grid gap-8">
      <PageHeader size="lg" title="Analyst picks" eyebrow={<span>Expert picks from public articles, graded</span>}
        lede={<>What the experts at {data?.sites.join(", ") ?? "free betting sites"} are picking this week, as they wrote
          it, with a link to read why. When a game ends, PickLab grades the pick.</>}
        right={data && <span className="pl-label text-muted-foreground">Updated {relative(data.generated_at)}</span>} />
      {sports.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sport">
          {[undefined, ...sports].map((s) => (
            <button key={s ?? "all"} type="button" onClick={() => setSport(s)} aria-pressed={sport === s}
              className={`pl-label rounded-full border px-3 py-1.5 text-[11px] ${sport === s ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              {s ? sportLabel(s) : "All"}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="grid gap-4">
          {isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          {error && <p className="text-sm text-muted-foreground">The picks couldn&apos;t load. Try again in a minute.</p>}
          {data && !games.length && <p className="text-sm text-muted-foreground">No picks for upcoming games yet.</p>}
          {games.length > 0 && (
            <p className="pl-label text-muted-foreground">{games.length} games · {picks} picks</p>
          )}
          {games.map((g) => (
            <GameCard key={g.event_id} g={g} />
          ))}
        </div>
        <aside className="grid gap-3 rounded-2xl border p-4 text-sm leading-relaxed text-muted-foreground lg:sticky lg:top-16">
          <h2 className="pl-label text-foreground">How to read this</h2>
          <p>Each row is a pick as its analyst wrote it, with the line and price they listed and a link to the article. The reasoning stays on the publisher&apos;s page.</p>
          <p>Once the game ends the pick is graded against the final score. Those grades are what the <Link href="/picklab/experts" className="underline decoration-[var(--hot)] decoration-2 underline-offset-4">records</Link> count.</p>
        </aside>
      </div>
    </div>
  );
}
