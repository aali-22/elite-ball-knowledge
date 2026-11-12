"use client";

// Which game a card is about, logos first: "[logo] Commanders at [logo] Giants · 8:15 PM". A plain line with no link of
// its own, so it can sit inside a card that is itself a link or be wrapped in one.
import { when } from "@/lib/ebk";
import type { Teams } from "@/lib/framing";
import { useLocalTime } from "@/lib/localTime";
import { Crest } from "./Crest";

export function MatchupLine({ g, sport, start, size = 26, day = false, className = "", children }: {
  g: Teams; sport: string; start?: string | null; size?: number; day?: boolean; className?: string; children?: React.ReactNode;  // day: say the day, not the hour (a list across several days)
}) {
  const local = useLocalTime();
  const w = start ? when(start, false, local) : null;
  // soccer is written home first ("Leeds v Tottenham"); the others away first ("Bucks at Knicks")
  const [first, second, word] = sport === "soccer" ? [g.home, g.away, "v"] : [g.away, g.home, "at"];
  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`}>
      <Crest sport={sport} team={first.team} name={first.name || first.team} size={size} />
      <span className="font-medium">{first.name || first.team}</span>
      <span className="pl-label text-[10px] text-muted-foreground">{word}</span>
      <Crest sport={sport} team={second.team} name={second.name || second.team} size={size} />
      <span className="font-medium">{second.name || second.team}</span>
      {(w || children) && (
        <span className="pl-label inline-flex items-center gap-1 text-[10px] text-muted-foreground group-hover:text-foreground">
          {w ? (day || w.time === "time to be confirmed" ? w.day : w.time) : ""}{children}
        </span>
      )}
    </span>
  );
}
