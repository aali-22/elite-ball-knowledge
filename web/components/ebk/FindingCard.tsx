"use client";

// One finding as a card, the same anatomy wherever findings are listed: a drawing of the part of the game it is about,
// its two ranks as the headline, a small ruler with the logos at those ranks, and one line on what it means. The exact
// sentence and how the stats are counted sit in a data note; the whole league, every team on the stat, opens on demand
// (it is one request per stat, so a page of cards never asks for all of them at once). A finding without league ranks
// (the simulation, form) keeps its own chart.
import { ArrowRight, ChevronDown, Lightbulb, Rows3 } from "lucide-react";
import { useState } from "react";
import { Seen } from "@/components/motion/Scroll";
import { track } from "@/lib/analytics";
import { ShareButton, findingUrl } from "./ShareButton";
import { KIND, type Insight } from "@/lib/ebk";
import { frame, type Teams } from "@/lib/framing";
import { InsightViz, type Sides } from "./Charts";
import { DataNote } from "./DataNote";
import { LeagueChart, charted } from "./Edges";
import { MatchupLine } from "./MatchupLine";
import { RankRail } from "./RankRail";
import { ViewLink } from "./Shell";
import { StatGlyph, partOf, sideOf } from "./StatGlyph";

const sidesFrom = (g: Teams): Sides => ({ home: g.home.team, away: g.away.team, names: { [g.home.team]: g.home.name || g.home.team, [g.away.team]: g.away.name || g.away.team } });

/** The game a finding came from, as the card's first line and its way into the breakdown. */
export function FromGame({ g, sport, href, start }: { g: Teams; sport: string; href: string; start?: string | null }) {
  return (
    <ViewLink href={href} className="group -mx-1 flex min-h-9 items-center justify-between gap-2 rounded-lg px-1 hover:bg-muted/60">
      <MatchupLine g={g} sport={sport} start={start} size={20} day className="text-[13px]" />
      <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-foreground" />
    </ViewLink>
  );
}

export function FindingCard({ i, g, sport, head, league = true, share, className = "" }: {
  i: Insight; g: Teams; sport: string; head?: React.ReactNode; league?: boolean; className?: string;
  share?: string;  // the game's address: the card then offers a link to this finding (its preview shows the finding)
}) {
  const fr = frame(i, g), part = partOf(fr.trait), plain = fr.shape === "plain";
  const [open, setOpen] = useState(false);  // the whole-league chart is fetched and drawn only once asked for
  const note = [plain ? null : i.claim, i.detail].filter(Boolean).join(" ");
  return (
    <article className={`pl-reading grid content-start gap-3 rounded-2xl border p-4 sm:p-5 ${className}`}>
      {head && <div className="border-b pb-2">{head}</div>}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="grid content-start gap-2.5">
          <span className="flex items-center gap-2.5">
            <StatGlyph trait={plain ? undefined : fr.trait} size={40} />
            <span className="pl-label min-w-0 text-[10px] leading-snug text-muted-foreground">
              {plain ? <span className="text-foreground">{KIND[i.kind]}</span> : <>{part.name} · {sideOf(fr.trait)}<br /><span className="text-foreground">{KIND[i.kind]}</span></>}
            </span>
          </span>
          <h3 className={`pl-display leading-[0.95] ${plain || fr.headline.length > 26 ? "text-2xl" : "text-[2rem]"}`}>{fr.headline}</h3>
          {!plain && <p className="text-sm leading-snug font-medium">{fr.stat}</p>}
        </div>
        {!plain && <Seen>{(seen) => <RankRail i={i} g={g} sport={sport} seen={seen} height={112} />}</Seen>}
      </div>
      {plain && <Seen>{(seen) => <InsightViz f={i} sides={sidesFrom(g)} seen={seen} labels={{}} />}</Seen>}
      <p className="flex gap-2 text-sm leading-relaxed"><Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--hot)]" /><span>{fr.meaning}</span></p>
      {i.small_sample && <p className="pl-label text-[10px] text-muted-foreground">Small sample: read it as a lean, not a fact</p>}
      {(note || (league && !plain)) && (
        <div className="grid gap-2">
          {note && <DataNote summary="The numbers">{note}</DataNote>}
          {league && !plain && (
            <details className="group/lg" onToggle={(e) => { const on = (e.currentTarget as HTMLDetailsElement).open; setOpen(on); if (on) track("finding_open", { which: "league", kind: i.kind }); }}>
              <summary className="pl-label inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 text-[10px] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <Rows3 aria-hidden className="size-3.5" />
                <span>The whole league</span>
                <ChevronDown aria-hidden className="size-3.5 transition-transform group-open/lg:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="mt-3">{open && <LeagueChart f={charted(sport, g, i.numbers, i.viz as never)} seen small />}</div>
            </details>
          )}
        </div>
      )}
      {share && <ShareButton url={findingUrl(share, i.id)} title={`${fr.headline} ${fr.stat}`} kind="finding" sport={sport} label="Share this finding" className="justify-self-start" />}
    </article>
  );
}
