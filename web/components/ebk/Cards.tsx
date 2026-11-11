"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Seen } from "@/components/motion/Scroll";
import { KIND, SPORT, gameHref, when, type Insight, type SlateGame } from "@/lib/ebk";
import { AWAY, HOME } from "@/lib/site";
import { InsightViz, type Sides } from "./Charts";

export const sidesOf = (g: { home: { team: string; name?: string | null }; away: { team: string; name?: string | null } }): Sides => ({
  home: g.home.team, away: g.away.team, names: { [g.home.team]: g.home.name || g.home.team, [g.away.team]: g.away.name || g.away.team },
});

/** A finding: what kind it is, the sentence, the chart that shows it, and how much sample is behind it. */
export function InsightCard({ f, sides, big = false, className = "" }: { f: Insight; sides: Sides; big?: boolean; className?: string }) {
  return (
    <article className={`pl-reading grid content-start gap-3 rounded-2xl border p-4 sm:p-5 ${className}`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="pl-label rounded-full bg-foreground px-2 py-1 text-[10px] text-background">{KIND[f.kind]}</span>
        {f.small_sample && <span className="pl-label rounded-full border px-2 py-1 text-[10px] text-muted-foreground" title="The numbers behind this rest on a small sample">Small sample</span>}
      </header>
      <h3 className={`pl-matchup ${big ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}>{f.title}</h3>
      <p className={`leading-relaxed ${big ? "text-base" : "text-sm"}`}>{f.claim}</p>
      <Seen>{(seen) => <InsightViz f={f} sides={sides} seen={seen} labels={{}} />}</Seen>
      {f.detail && <p className="border-t pt-2 text-xs leading-relaxed text-muted-foreground">{f.detail}</p>}
    </article>
  );
}

/** One game on the slate: who plays, which way the board tilts, and the first thing to know about it. */
export function GameTile({ g, className = "" }: { g: SlateGame; className?: string }) {
  const w = when(g.start);
  const tilt = Math.max(-1, Math.min(1, g.tilt));
  const lean = Math.abs(tilt) < 0.06 ? "Even board" : `Leans ${tilt > 0 ? g.home.name : g.away.name}`;
  return (
    <Link href={gameHref(g.event_id)} className={`group pl-reading relative grid content-between gap-4 overflow-hidden rounded-3xl border p-4 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-foreground/40 sm:p-5 ${className}`}>
      <div className="grid gap-3">
        <div className="pl-label flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{SPORT[g.sport] ?? g.sport}{w ? ` · ${w.day} · ${w.time}` : ""}</span>
          <ArrowUpRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        <h3 className="pl-matchup text-2xl sm:text-[1.7rem]">
          <span style={{ boxShadow: `inset 0 -0.14em 0 ${AWAY.ink}` }}>{g.away.name}</span>
          <span className="mx-2 text-base text-muted-foreground">{g.sport === "soccer" ? "v" : "@"}</span>
          <span style={{ boxShadow: `inset 0 -0.14em 0 ${HOME.ink}` }}>{g.home.name}</span>
        </h3>
        {g.headline && <p className="line-clamp-3 text-sm leading-snug text-muted-foreground"><b className="font-medium text-foreground">{g.headline.title}.</b> {g.headline.claim}</p>}
      </div>
      <div className="grid gap-1">
        <div className="relative h-1.5 rounded-full bg-muted" title={`${lean}: share of the board's matchups, weighted by sample`}>
          <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--card)]" />
          <span className="absolute inset-y-0 rounded-full" style={{ [tilt >= 0 ? "left" : "right"]: "50%", width: `${Math.abs(tilt) * 50}%`, background: tilt >= 0 ? HOME.ink : AWAY.ink }} />
        </div>
        <div className="pl-label flex justify-between text-[9px] text-muted-foreground"><span>{lean}</span><span>{g.findings} findings</span></div>
      </div>
    </Link>
  );
}
