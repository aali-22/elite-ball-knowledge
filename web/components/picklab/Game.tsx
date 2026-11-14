"use client";

// A game as PickLab shows it, at four sizes: the card (up next), the row (started, or followed), the score tile
// (finished) and the pieces they share: the two teams, the star that follows a game, and who took which side.
import { Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Crest } from "@/components/ebk/Crest";
import { sportLabel } from "@/lib/ebk";
import { useExcerpts } from "@/lib/excerpts";
import { localTime } from "@/lib/format";
import { awayName, dayKey, dayLabel, finalScore, homeName, labGameHref, phaseOf, plural, ranked, sideSplit, tally } from "@/lib/picklab";
import type { PublicGame, PublicPick } from "@/lib/public";
import { AWAY, HOME } from "@/lib/site";
import { useLab, useViewer } from "./Context";
import { PickLine } from "./Pick";

type Find = (eventId: string, p: PublicPick) => ReturnType<ReturnType<typeof useExcerpts>["find"]>;

/** The two teams, one under the other, each with its mark. `size`: the name's size in px. */
export function Teams({ g, size = 26 }: { g: PublicGame; size?: number }) {
  const mark = Math.round(size * 1.1);
  return (
    <span className="grid gap-1.5">
      {[{ code: g.away, name: awayName(g), ink: AWAY.ink }, { code: g.home, name: homeName(g), ink: HOME.ink }].map((t) => (
        <span key={t.code} className="flex min-w-0 items-center gap-2.5">
          <Crest sport={g.sport} team={t.code} name={t.name} size={mark} color={t.ink} />
          <span className="pl-matchup min-w-0 truncate" style={{ fontSize: size }}>{t.name}</span>
        </span>
      ))}
    </span>
  );
}

/** Both marks overlapped and the matchup on one line: a row's way of naming a game. */
function OneLine({ g }: { g: PublicGame }) {
  return (
    <>
      <span className="flex shrink-0">
        <Crest sport={g.sport} team={g.away} name={awayName(g)} size={26} color={AWAY.ink} />
        <Crest sport={g.sport} team={g.home} name={homeName(g)} size={26} color={HOME.ink} className="-ml-1.5" />
      </span>
      <span className="pl-matchup min-w-0 flex-1 truncate text-xl">{awayName(g)} at {homeName(g)}</span>
    </>
  );
}

export function FollowStar({ g, labelled = false }: { g: PublicGame; labelled?: boolean }) {
  const { following } = useLab();
  const on = following.has(g.event_id);
  const name = `${awayName(g)} at ${homeName(g)}`;
  return (
    <button type="button" aria-pressed={on} aria-label={`${on ? "Following" : "Follow"} ${name}`} title={on ? "Following: tap to stop" : "Follow this game"}
      onClick={() => following.toggle(g.event_id, g.start)}
      className={labelled
        ? `pl-label inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-[11px] ${on ? "border-[var(--hot)]/60 bg-[var(--hot-soft)]" : "text-muted-foreground hover:text-foreground"}`
        : `-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full ${on ? "" : "text-muted-foreground hover:text-foreground"}`}>
      <Star aria-hidden className="size-5" style={on ? { color: "var(--hot)" } : undefined} fill={on ? "currentColor" : "none"} strokeWidth={1.6} />
      {labelled && (on ? "Following" : "Follow")}
    </button>
  );
}

/** Who took which team on the spread or to win. `names`: list them under each bar (a game's own page). */
export function SplitBar({ g, names = false }: { g: PublicGame; names?: boolean }) {
  const s = useMemo(() => sideSplit(g), [g]);
  const a = s.away.length, h = s.home.length, n = a + h;
  if (!n) return null;
  if (names) {
    return (
      <div className="grid gap-3">
        <span className="pl-label text-[10px] text-muted-foreground">Who they take · {plural(n, "named analyst")}</span>
        {[{ label: awayName(g), who: s.away, ink: AWAY.ink }, { label: homeName(g), who: s.home, ink: HOME.ink }].map((x) => (
          <div key={x.label} className="grid gap-1">
            <div className="flex justify-between text-sm"><span>{x.label}</span><span className="tabular">{x.who.length}</span></div>
            <span className="block h-2 rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(x.who.length / n) * 100}%`, background: x.ink }} /></span>
            {x.who.length > 0 && <span className="text-xs text-muted-foreground">{x.who.join(" · ")}</span>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="tabular flex items-center gap-2 font-mono text-[11px] text-muted-foreground" title="Named analysts on each team, on the spread or to win">
      <span className={a >= h ? "text-foreground" : ""}>{g.away} {a}</span>
      <span className="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full bg-muted">
        <span className="h-full rounded-full" style={{ width: `${(a / n) * 100}%`, background: AWAY.ink }} />
        <span className="h-full flex-1 rounded-full" style={{ background: h ? HOME.ink : "transparent" }} />
      </span>
      <span className={h >= a ? "text-foreground" : ""}>{g.home} {h}</span>
    </div>
  );
}

const SHOWN = 3;  // picks on a card before "Open game"

export function GameCard({ g, find }: { g: PublicGame; find: Find }) {
  const top = useMemo(() => ranked(g.picks).slice(0, SHOWN), [g]);
  const more = g.picks.length - top.length;
  const href = labGameHref(g.event_id);
  return (
    <article className="pl-reading grid content-start gap-3 rounded-2xl border px-4 pb-4 pt-1">
      <div className="pl-label flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="min-w-0 truncate">{sportLabel(g.sport)} · {localTime(g.start)} · {plural(g.picks.length, "pick")}</span>
        <FollowStar g={g} />
      </div>
      {/* no prefetch: every page of this section is drawn per person, and a slate of cards would ask for all of them */}
      <Link href={href} prefetch={false} className="-mt-2 rounded-lg hover:opacity-85"><Teams g={g} /></Link>
      <SplitBar g={g} />
      <ul className="divide-y border-t">{top.map((p, i) => <PickLine key={`${p.text}-${i}`} p={p} sport={g.sport} why={find(g.event_id, p)} compact />)}</ul>
      <Link href={href} prefetch={false} className="pl-label flex min-h-11 items-center justify-center rounded-xl bg-foreground text-[11px] text-background hover:opacity-90">
        Open game{more > 0 ? ` · ${more} more` : ""}
      </Link>
    </article>
  );
}

/** A game on one line: the ones you follow, and the ones that have started. */
export function GameRow({ g, day = false }: { g: PublicGame; day?: boolean }) {
  const score = finalScore(g), over = phaseOf(g) === "done";
  return (
    <Link href={labGameHref(g.event_id)} prefetch={false} className="flex min-h-14 items-center gap-2.5 px-3 py-2 hover:bg-muted/50">
      <OneLine g={g} />
      <span className="tabular shrink-0 text-right font-mono text-[11px] leading-snug text-muted-foreground">
        {over && score ? <span className="text-foreground">{score.away}–{score.home}</span> : `${day ? `${dayLabel(dayKey(g.start)).date.split(",")[0]} ` : ""}${localTime(g.start)}`}
        <br />{plural(g.picks.length, "pick")}
      </span>
    </Link>
  );
}

/** A finished game, small: the score when a graded pick states it, and how the picks on it did. */
export function DoneTile({ g }: { g: PublicGame }) {
  const s = finalScore(g), t = tally(g);
  const rows = [{ code: g.away, pts: s?.away, won: !!s && s.away > s.home }, { code: g.home, pts: s?.home, won: !!s && s.home > s.away }];
  return (
    <Link href={labGameHref(g.event_id)} prefetch={false} className="tabular grid gap-1 rounded-xl border bg-card/60 px-3 py-2.5 font-mono text-[13px] hover:bg-muted/60"
      title={`${awayName(g)} at ${homeName(g)}`}>
      {rows.map((r) => (
        <span key={r.code} className={`flex justify-between gap-2 ${r.won ? "font-semibold" : "text-muted-foreground"}`}><span className="truncate">{r.code}</span><span>{r.pts ?? ""}</span></span>
      ))}
      <span className="mt-1 text-[11px] text-muted-foreground">{t.won + t.lost ? `${t.won} won · ${t.lost} lost` : plural(g.picks.length, "pick")}</span>
    </Link>
  );
}

const NEXT_SHOWN = 6, DONE_SHOWN = 8;
const more = "pl-label min-h-11 justify-self-start rounded-xl border px-4 text-[11px] text-muted-foreground hover:text-foreground";

/** One day: its games up next as cards, the started ones as rows, the finished ones as score tiles. */
export function DaySection({ day, games, now }: { day: string; games: PublicGame[]; now: number }) {
  const { owner } = useViewer();
  const [allNext, setAllNext] = useState(false), [allDone, setAllDone] = useState(false);
  const { next, live, done } = useMemo(() => {
    const out = { next: [] as PublicGame[], live: [] as PublicGame[], done: [] as PublicGame[] };
    for (const g of games) out[phaseOf(g, now)].push(g);
    out.done.reverse();  // the latest result first
    return out;
  }, [games, now]);
  const cards = allNext ? next : next.slice(0, NEXT_SHOWN), tiles = allDone ? done : done.slice(0, DONE_SHOWN);
  const ids = useMemo(() => cards.map((g) => g.event_id), [cards]);
  const { find } = useExcerpts(ids, owner);
  const label = dayLabel(day);
  return (
    <section className="grid gap-4" aria-label={`${label.title}, ${label.date}`}>
      <h2 className="sticky top-12 z-20 -mx-4 flex items-baseline gap-3 border-y bg-background px-4 py-2.5">
        <span className="pl-display text-3xl sm:text-5xl">{label.title}</span>
        <span className="pl-label flex-1 text-muted-foreground">{label.date}</span>
        <span className="pl-label text-muted-foreground">{next.length ? `Up next · ${next.length}` : plural(games.length, "game")}</span>
      </h2>
      {cards.length > 0 && <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((g) => <GameCard key={g.event_id} g={g} find={find} />)}</div>}
      {next.length > cards.length && <button type="button" onClick={() => setAllNext(true)} className={more}>Show {next.length - cards.length} more up next</button>}
      {live.length > 0 && (
        <div className="grid gap-2">
          <h3 className="pl-label flex items-center gap-2 text-muted-foreground"><span aria-hidden className="size-1.5 rounded-full bg-[var(--hot)]" />Started · {live.length}</h3>
          <div className="pl-reading grid divide-y overflow-hidden rounded-2xl border sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-3">{live.map((g) => <GameRow key={g.event_id} g={g} />)}</div>
        </div>
      )}
      {done.length > 0 && (
        <div className="grid gap-2">
          <h3 className="pl-label text-muted-foreground">Finished · {done.length}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">{tiles.map((g) => <DoneTile key={g.event_id} g={g} />)}</div>
          {done.length > tiles.length && <button type="button" onClick={() => setAllDone(true)} className={more}>Show {done.length - tiles.length} more</button>}
        </div>
      )}
    </section>
  );
}
