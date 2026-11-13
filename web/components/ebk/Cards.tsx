"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { ArrowUpRight } from "lucide-react";
import { Seen } from "@/components/motion/Scroll";
import { KIND, SPORT, crestName, gameHref, when, type Insight, type SlateGame } from "@/lib/ebk";
import { frame, readings } from "@/lib/framing";
import { useLocalTime } from "@/lib/localTime";
import { AWAY, HOME } from "@/lib/site";
import { InsightViz, type Sides } from "./Charts";
import { Crest } from "./Crest";
import { RankRail } from "./RankRail";
import { ViewLink } from "./Shell";
import { StatGlyph, partOf } from "./StatGlyph";

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

/** One game on the slate: who plays, who the model favours, and the first thing to know about it as a picture: the
 *  part of the game it is about, its two numbers, and where those ranks sit in the league. The whole card is one link. */
export function GameTile({ g, className = "" }: { g: SlateGame; className?: string }) {
  const local = useLocalTime();
  const w = when(g.start, g.time_tbd, local);
  // two readings, kept apart: the model's win share (top right) and the matchup count (the bar and its words)
  const r = readings(g), fav = r.fav, lean = r.leanText;
  // soccer is written home first ("Leeds v Tottenham"); the others away first ("Bucks at Knicks")
  const order = g.sport === "soccer" ? [{ t: g.home, ink: HOME.ink, i: 1 }, { t: g.away, ink: AWAY.ink, i: 0 }] : [{ t: g.away, ink: AWAY.ink, i: 0 }, { t: g.home, ink: HOME.ink, i: 1 }];
  const fr = g.headline ? frame(g.headline, g) : null;
  const part = fr ? partOf(fr.trait) : null;
  // the other findings, one picture per part of the game (the headline's own part isn't repeated)
  const more = [...new Map((g.also ?? []).map((t) => [partOf(t).key, t])).entries()].filter(([k]) => k !== part?.key).map(([, t]) => t);
  const rest = Math.max(0, g.findings - (fr ? 1 : 0));
  return (
    <ViewLink href={gameHref(g.event_id)} className={`group pl-reading relative grid content-between gap-4 overflow-hidden rounded-3xl border p-4 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-foreground/40 sm:p-5 ${className}`}>
      <div className="grid gap-3.5">
        <div className="pl-label flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{SPORT[g.sport] ?? g.sport}{w ? ` · ${w.day} · ${w.time}` : " · date to come"}{w?.started ? " · started" : ""}</span>
          <ArrowUpRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h3 className="grid min-w-0 gap-2" aria-label={g.sport === "soccer" ? `${g.home.name} v ${g.away.name}` : `${g.away.name} at ${g.home.name}`}>
            {order.map(({ t, ink, i }, at) => (
              <span key={t.team} className="flex min-w-0 items-center gap-3">
                {/* the second row is the home side (the first, in soccer): a small word says so, since two stacked names don't */}
                <Crest sport={g.sport} team={t.team} name={t.name} size={38} color={ink} style={{ viewTransitionName: crestName(g.event_id, i) }} />
                {at === 1 && <span aria-hidden className="pl-label -mr-1 shrink-0 text-[10px] text-muted-foreground">{g.sport === "soccer" ? "v" : "at"}</span>}
                <span className="pl-matchup min-w-0 truncate text-2xl sm:text-[1.7rem]" style={{ boxShadow: `inset 0 -0.12em 0 ${ink}` }}>{t.name}</span>
              </span>
            ))}
          </h3>
          {fav && g.model && (
            <p className="grid justify-items-end gap-0.5" title={r.modelNote}>
              <span className="pl-display tabular text-4xl leading-none">{Math.round(g.model.p * 100)}%</span>
              <span className="pl-label max-w-[7.5rem] text-right text-[10px] text-muted-foreground"><span className="text-foreground">{r.modelFrom}</span><br />{fav} to win</span>
            </p>
          )}
        </div>
        {g.headline && fr && part && (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t pt-3.5">
            <div className="grid content-start gap-2">
              <span className="flex items-center gap-2.5">
                <StatGlyph trait={fr.trait} size={36} />
                <span className="pl-label min-w-0 text-[10px] leading-snug text-muted-foreground">{fr.shape === "plain" ? KIND[g.headline.kind] : <>{part.name}<br /><span className="text-foreground">{KIND[g.headline.kind]}</span></>}</span>
              </span>
              <p className={`pl-display leading-[0.95] ${fr.shape === "plain" || fr.headline.length > 26 ? "text-xl" : "text-[1.7rem]"}`}>{fr.headline}</p>
              <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{fr.shape === "plain" ? fr.meaning : fr.stat}</p>
            </div>
            <Seen>{(seen) => <RankRail i={g.headline!} g={g} sport={g.sport} seen={seen} />}</Seen>
          </div>
        )}
      </div>
      <div className="grid gap-1.5">
        <div className="relative h-1.5 rounded-full bg-muted" data-bar={r.bar.toFixed(2)} title={`${lean}${r.counted ? `: ${r.counted}` : ""}. Left is ${g.away.name}, right ${g.home.name}.`}>
          <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--surface,var(--background))]" />
          {r.bar !== 0 && <span className="absolute inset-y-0 rounded-full" style={{ [r.bar > 0 ? "left" : "right"]: "50%", width: `${Math.abs(r.bar) * 50}%`, background: r.bar > 0 ? HOME.ink : AWAY.ink }} />}
        </div>
        <div className="pl-label flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{lean}</span>
            {r.differ && <span data-differ className="rounded-full border border-foreground/40 px-1.5 py-0.5 text-foreground" title={r.differNote}>Not the model&rsquo;s favourite</span>}
            {r.oldText && <span title="Too few games this season: these numbers and ranks are last season's, among last season's teams">{r.oldText}</span>}
          </span>
          {rest > 0 && (
            <span className="flex items-center gap-1" title={`${rest} more ${rest === 1 ? "finding" : "findings"}${more.length ? `: ${more.map((t) => partOf(t).name).join(", ")}` : ""}`}>
              <span className="sr-only">{rest} more {rest === 1 ? "finding" : "findings"}{more.length ? `: ${more.map((t) => partOf(t).name).join(", ")}` : ""}</span>
              <span aria-hidden>+{rest}</span>
              {more.slice(0, 4).map((t) => <StatGlyph key={t} trait={t} size={22} className="rounded-md" />)}
            </span>
          )}
        </div>
      </div>
    </ViewLink>
  );
}
