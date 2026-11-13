"use client";

import { useEffect, useState } from "react";
import { sportLabel, useSiteMeta, type SiteMeta } from "@/lib/ebk";
import { fmtDateTime, useLocalTime } from "@/lib/localTime";

const STALE_H = 36;  // two missed builds: past this the line stops sounding routine
const WHEN: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
const DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/** "3 hours ago", in plain words. Only ever worked out in the browser: the server's clock is not the reader's. */
function ago(hours: number): string {
  if (hours < 1) return "under an hour ago";
  if (hours < 48) return `${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** The line under the footer: when the data was last built, and how long ago that is. `meta` is what the server
 *  could find out; null means the browser asks. Nothing is drawn until one of them knows. */
export function FreshLine({ meta }: { meta: SiteMeta | null }) {
  const local = useLocalTime();
  const asked = useSiteMeta(!meta?.built_at);
  const built = meta?.built_at ?? asked.data?.built_at ?? null;
  const boards = meta?.boards ?? asked.data?.boards ?? {};
  // the age is state, set after the page is live and once a minute after, so the server's HTML and the browser's
  // first draw agree (both say only the absolute time)
  const [hours, setHours] = useState<number | null>(null);
  useEffect(() => {
    if (!built) return;
    const tick = () => setHours((Date.now() - new Date(built).getTime()) / 3_600_000);
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [built]);
  if (!built || Number.isNaN(new Date(built).getTime())) return null;
  const stale = hours != null && hours > STALE_H;
  const leagues = Object.entries(boards).sort().map(([sport, at]) => `${sportLabel(sport)} ${fmtDateTime(at, DAY, local)}`).join(" · ");
  return (
    <div className="border-t" data-fresh={stale ? "stale" : "ok"}>
      <p className="pl-label mx-auto max-w-7xl px-4 py-3 text-[10px] text-muted-foreground" title={leagues ? `Newest game board per league: ${leagues}` : undefined}>
        {stale ? "Data last updated " : "Data as of "}
        <time dateTime={built} className="text-foreground">{fmtDateTime(built, WHEN, local)}</time>
        {hours != null && <span> · {ago(hours)}</span>}
        {stale && <span className="text-foreground"> · The daily update is late, so today&rsquo;s games and numbers may be missing.</span>}
      </p>
    </div>
  );
}
