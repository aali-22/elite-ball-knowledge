"use client";

// PickLab's front page is today: the games you follow first, then each day's games in order (up next as cards, the
// started ones as rows, the finished ones as score tiles). Everything else about a game is on its own page.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { LoadError } from "@/components/ebk/LoadError";
import { LabProvider, useLab } from "@/components/picklab/Context";
import { DaySection, GameRow } from "@/components/picklab/Game";
import { SportChips } from "@/components/picklab/SportChips";
import { Skeleton } from "@/components/ui/skeleton";
import { SPORT_ORDER } from "@/lib/ebk";
import { relative } from "@/lib/format";
import { SLUG, byDay, dayKey, phaseOf, plural } from "@/lib/picklab";
import { usePublicPicks, type PublicGame } from "@/lib/public";
import { usePageTitle } from "@/lib/title";
import { useUrlChoice } from "@/lib/urlState";

const DAYS = 3;  // today and the next two days that have games

function Following({ games }: { games: PublicGame[] }) {
  const { following } = useLab();
  const mine = useMemo(() => games.filter((g) => following.has(g.event_id)).sort((a, b) => a.start.localeCompare(b.start)), [games, following]);
  if (!mine.length) return null;
  return (
    <section className="grid gap-2" aria-label="Games you follow">
      <h2 className="pl-label flex items-center gap-1.5" style={{ color: "var(--hot)" }}><Star aria-hidden className="size-3.5" fill="currentColor" />Following · {mine.length}</h2>
      <div className="pl-reading grid divide-y overflow-hidden rounded-2xl border border-[var(--hot)]/45 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-3">
        {mine.map((g) => <GameRow key={g.event_id} g={g} day />)}
      </div>
    </section>
  );
}

function Today() {
  usePageTitle("Today · PickLab");
  const router = useRouter();
  const old = useSearchParams().get("game");  // the address a game's picks used to have
  useEffect(() => { if (old && SLUG.test(old)) router.replace(`/picklab/game/${old}`); }, [old, router]);
  const [sport, setSport] = useUrlChoice("sport");
  const { data, isLoading, error, refetch } = usePublicPicks();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);  // a game moves from up next to started on its own

  const all = useMemo(() => data?.games ?? [], [data]);
  const today = dayKey(now);
  const days = useMemo(() => {
    const grouped = [...byDay(all)];
    const ahead = grouped.filter(([k]) => k >= today).slice(0, DAYS);
    return ahead.length ? ahead : grouped.slice(-1);  // nothing from today on: the latest day there is
  }, [all, today]);
  const shown = useMemo(() => days.flatMap(([, gs]) => gs), [days]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const g of shown) c[g.sport] = (c[g.sport] ?? 0) + 1;
    return c;
  }, [shown]);
  const sports = useMemo(() => SPORT_ORDER.filter((s) => all.some((g) => g.sport === s)), [all]);
  const todays = all.filter((g) => dayKey(g.start) === today);
  const upNext = todays.filter((g) => phaseOf(g, now) === "next").length;

  return (
    <LabProvider sports={sports}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SportChips counts={counts} total={shown.length} value={sport} onChange={setSport} />
          <span className="pl-label ml-auto text-muted-foreground">
            {data ? <>{todays.length ? `${plural(todays.length, "game")} today${upNext && upNext < todays.length ? ` · ${upNext} up next` : ""}` : "No games today"} · Updated {relative(data.generated_at)}</> : " "}
          </span>
        </div>

        {isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        {error && !data && <LoadError what="today's games" retry={() => refetch()} />}

        <Following games={all.filter((g) => !sport || g.sport === sport)} />

        {days.map(([day, gs]) => {
          const mine = gs.filter((g) => !sport || g.sport === sport);
          return mine.length ? <DaySection key={day} day={day} games={mine} now={now} /> : null;
        })}
        {data && !shown.length && <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No games with picks yet.</p>}

        {data && (
          <Link href="/picklab/games" className="pl-label flex min-h-11 items-center justify-center rounded-xl border text-[11px] hover:bg-muted">
            All games, past and coming
          </Link>
        )}
      </div>
    </LabProvider>
  );
}

export default function TodayPage() {
  return <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}><Today /></Suspense>;
}
