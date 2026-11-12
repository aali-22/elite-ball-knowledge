"use client";

// Tonight's board: every game of the day in one list. Each row says who the model favours and which way the matchups
// lean; open it for the three things that decide the game, one line each, and a way into the full breakdown. Rows are
// native disclosures, so they open without any script.
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Seen } from "@/components/motion/Scroll";
import { gameHref, when, type Finding, type SlateGame } from "@/lib/ebk";
import { frame, reason } from "@/lib/framing";
import { useLocalTime } from "@/lib/localTime";
import { AWAY, HOME } from "@/lib/site";
import { Crest } from "./Crest";
import { RankRail } from "./RankRail";
import { StatGlyph, partOf } from "./StatGlyph";

function Row({ g, reasons, open }: { g: SlateGame; reasons: Finding[]; open: boolean }) {
  const local = useLocalTime();
  const w = when(g.start, g.time_tbd, local);
  const fav = g.model ? (g.model.team === g.home.team ? g.home : g.away) : null;
  const lean = g.lean === g.home.team ? g.home.name : g.lean === g.away.team ? g.away.name : null;
  const tilt = Math.max(-1, Math.min(1, g.tilt));
  const told = reasons.map((f) => ({ f, r: reason(f.insight, g), fr: frame(f.insight, g) }));
  const parts = [...new Map(told.map(({ r }) => [partOf(r.trait).key, r.trait ?? ""])).values()];
  return (
    <details open={open} className="group border-t">
      <summary className="grid cursor-pointer list-none gap-2 py-3 [&::-webkit-details-marker]:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="grid min-w-0 gap-1">
            {[{ t: g.away, ink: AWAY.ink, at: false }, { t: g.home, ink: HOME.ink, at: true }].map(({ t, ink, at }) => (
              <span key={t.team} className="flex min-w-0 items-center gap-2">
                {at && <span className="pl-label w-5 shrink-0 text-center text-[10px] text-muted-foreground">at</span>}
                {!at && <span className="w-5 shrink-0" />}
                <Crest sport={g.sport} team={t.team} name={t.name} size={22} color={ink} />
                <span className="pl-matchup min-w-0 truncate text-lg">{t.name}</span>
              </span>
            ))}
          </div>
          <div className="grid justify-items-end gap-0.5">
            {fav && g.model ? (
              <>
                <span className="pl-display tabular text-3xl leading-none">{Math.round(g.model.p * 100)}%</span>
                <span className="pl-label text-[10px] text-muted-foreground">{fav.name} to win</span>
              </>
            ) : <span className="pl-label text-[10px] text-muted-foreground">No model yet</span>}
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="grid gap-1">
            <div className="relative h-1.5 rounded-full bg-muted" title={`Which way the matchups lean: left ${g.away.name}, right ${g.home.name}`}>
              <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--card)]" />
              <span className="absolute inset-y-0 rounded-full" style={{ [tilt >= 0 ? "left" : "right"]: "50%", width: `${Math.max(2, Math.abs(tilt) * 50)}%`, background: tilt >= 0 ? HOME.ink : AWAY.ink }} />
            </div>
            <span className="pl-label flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              <span>{lean ? `Matchups favour ${lean}` : "Matchups: even"}{w ? ` · ${w.time === "time to be confirmed" ? "time to be confirmed" : w.time}` : ""}</span>
              {/* what the reasons inside are about, as pictures; hidden once the row is open and says them in full */}
              <span aria-hidden className="flex gap-1 group-open:hidden">{parts.map((t) => <StatGlyph key={t} trait={t} size={20} className="rounded-md" />)}</span>
            </span>
          </div>
          <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
        </div>
      </summary>
      <div className="grid gap-2 pb-4 pl-0 sm:pl-7">
        {told.length > 0 ? (
          <ol className="grid">
            {told.map(({ f, r, fr }) => (
              <li key={f.insight.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-dashed py-2 first:border-t-0">
                <StatGlyph trait={r.trait} size={34} className="rounded-lg" />
                <span className="grid min-w-0 gap-0.5">
                  <span className="pl-label text-[10px] text-muted-foreground">{partOf(r.trait).name}</span>
                  <span className="text-sm leading-snug">{r.text}</span>
                  {fr.shape === "plain" && r.nums && <span className="tabular text-xs text-muted-foreground">{r.nums}</span>}
                </span>
                <Seen>{(seen) => <RankRail i={f.insight} g={g} sport={g.sport} seen={seen} height={76} bare />}</Seen>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-muted-foreground">The breakdown has the matchups in full.</p>}
        <Link href={gameHref(g.event_id)} className="pl-label inline-flex min-h-10 items-center gap-2 justify-self-start text-[10px] underline decoration-[var(--hot)] decoration-2 underline-offset-4">
          Open the game <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </details>
  );
}

/** The day's games, in start order. The first row opens by itself so the pattern is clear. */
export function TonightBoard({ games, findings }: { games: SlateGame[]; findings: Finding[] }) {
  const by = new Map<string, Finding[]>();
  for (const f of findings) by.set(f.event_id, [...(by.get(f.event_id) ?? []), f]);
  return (
    <div className="grid gap-x-10 lg:grid-cols-2 lg:items-start">
      {games.map((g, i) => <Row key={g.event_id} g={g} open={i === 0} reasons={(by.get(g.event_id) ?? []).sort((a, b) => b.insight.score - a.insight.score).slice(0, 3)} />)}
    </div>
  );
}
