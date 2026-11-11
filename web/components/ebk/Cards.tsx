"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { ArrowUpRight } from "lucide-react";
import { Seen } from "@/components/motion/Scroll";
import { KIND, SPORT, crestName, gameHref, when, type Insight, type SlateGame } from "@/lib/ebk";
import { AWAY, HOME } from "@/lib/site";
import { InsightViz, type Sides } from "./Charts";
import { Crest } from "./Crest";
import { ViewLink } from "./Shell";

export const KIND_TONE: Record<Insight["kind"], "neutral" | "red" | "orange" | "blue" | "green" | "purple" | "teal" | "yellow" | "pink"> = {
  mismatch: "red", mirage: "orange", hidden: "teal", real: "green", star: "purple", clash: "blue", balance: "neutral", form: "yellow", sim: "pink",
};

export const sidesOf = (g: { home: { team: string; name?: string | null }; away: { team: string; name?: string | null } }): Sides => ({
  home: g.home.team, away: g.away.team, names: { [g.home.team]: g.home.name || g.home.team, [g.away.team]: g.away.name || g.away.team },
});

/** A finding: what kind it is, the sentence, the chart that shows it, and how much sample is behind it. */
export function InsightCard({ f, sides, big = false, className = "" }: { f: Insight; sides: Sides; big?: boolean; className?: string }) {
  return (
    <article className={`pl-reading grid content-start gap-3 rounded-2xl border p-4 sm:p-5 ${className}`}>
      <header className="flex flex-wrap items-center gap-2">
        <Badge label={KIND[f.kind]} variant={KIND_TONE[f.kind]} />
        {f.small_sample && <span title="The numbers behind this rest on a small sample"><Badge label="Small sample" variant="warning" /></span>}
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
  const lean = Math.abs(tilt) < 0.06 ? "Matchups: even" : `Matchups lean ${tilt > 0 ? g.home.name : g.away.name}`;
  // soccer is written home first ("Leeds v Tottenham"); the others away first ("Bucks at Knicks")
  const order = g.sport === "soccer" ? [{ t: g.home, ink: HOME.ink, i: 1 }, { t: g.away, ink: AWAY.ink, i: 0 }] : [{ t: g.away, ink: AWAY.ink, i: 0 }, { t: g.home, ink: HOME.ink, i: 1 }];
  return (
    <ViewLink href={gameHref(g.event_id)} className={`group pl-reading relative grid content-between gap-4 overflow-hidden rounded-3xl border p-4 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-foreground/40 sm:p-5 ${className}`}>
      <div className="grid gap-3">
        <div className="pl-label flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{SPORT[g.sport] ?? g.sport}{w ? ` · ${w.day} · ${w.time}` : " · date to come"}{w?.started ? " · started" : ""}</span>
          <ArrowUpRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        <h3 className="grid gap-2">
          {order.map(({ t, ink, i }) => (
            <span key={t.team} className="flex min-w-0 items-center gap-3">
              <Crest sport={g.sport} team={t.team} name={t.name} size={38} color={ink} style={{ viewTransitionName: crestName(g.event_id, i) }} />
              <span className="pl-matchup min-w-0 truncate text-2xl sm:text-[1.7rem]" style={{ boxShadow: `inset 0 -0.12em 0 ${ink}` }}>{t.name}</span>
            </span>
          ))}
        </h3>
        {g.headline && <p className="line-clamp-3 text-sm leading-snug text-muted-foreground"><b className="font-medium text-foreground">{g.headline.title}.</b> {g.headline.claim}</p>}
      </div>
      <div className="grid gap-1">
        <div className="relative h-1.5 rounded-full bg-muted" title={`${lean}. How many offense-against-defense matchups each side wins, weighted by sample. Left is the away side, right the home side.`}>
          <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--card)]" />
          <span className="absolute inset-y-0 rounded-full" style={{ [tilt >= 0 ? "left" : "right"]: "50%", width: `${Math.abs(tilt) * 50}%`, background: tilt >= 0 ? HOME.ink : AWAY.ink }} />
        </div>
        <div className="pl-label flex justify-between text-[9px] text-muted-foreground"><span>{lean}</span><span>{g.findings} findings</span></div>
      </div>
    </ViewLink>
  );
}
