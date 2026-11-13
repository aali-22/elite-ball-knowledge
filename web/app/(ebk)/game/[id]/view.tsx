"use client";

// One game: the head (who, when, the read on the whole board), then the board told as a scroll (components/ebk/BoardView).
// Everything is computed (the analytics API); nothing here is an opinion, a pick or a price.
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { BoardView } from "@/components/ebk/BoardView";
import { sidesOf } from "@/components/ebk/Cards";
import { InsightViz } from "@/components/ebk/Charts";
import { Crest } from "@/components/ebk/Crest";
import { DataNote } from "@/components/ebk/DataNote";
import { FinalScore } from "@/components/ebk/FinalScore";
import { GameExtras } from "@/components/ebk/GameExtras";
import { LoadError } from "@/components/ebk/LoadError";
import { Onward } from "@/components/ebk/Onward";
import { ShareButton } from "@/components/ebk/ShareButton";
import { ViewLink } from "@/components/ebk/Shell";
import { Reveal, SplitHeading } from "@/components/motion/Reveal";
import { Seen } from "@/components/motion/Scroll";
import { CountUp } from "@/components/viz/CountUp";
import { SPORT, crestName, slug, teamHref, useBoard, useGameTree, when } from "@/lib/ebk";
import { fmtDateTime, useLocalTime } from "@/lib/localTime";
import { AWAY, HOME, LAB } from "@/lib/site";

export function GameView({ id }: { id: string }) {
  const local = useLocalTime();
  const q = useBoard(id);
  const b = q.data;
  const tree = useGameTree(id, !!b && (b.sport === "nba" || b.sport === "nfl"));
  const sides = useMemo(() => (b ? sidesOf(b) : null), [b]);
  useEffect(() => { if (b) document.title = `${b.label} · Elite Ball Knowledge`; }, [b]);

  if (q.isLoading) return <main className="mx-auto grid max-w-7xl gap-4 px-4 py-10"><div className="h-40 animate-pulse rounded-3xl bg-muted" /><div className="h-80 animate-pulse rounded-3xl bg-muted" /></main>;
  if (q.isError) return <main className="mx-auto grid max-w-3xl px-4 py-16"><LoadError what="this game" retry={() => q.refetch()} /></main>;
  if (!b || !sides) {
    return (
      <main className="mx-auto grid max-w-3xl gap-3 px-4 py-16">
        <h1 className="pl-display text-5xl">No breakdown for this game</h1>
        <p className="text-sm text-muted-foreground">Breakdowns are built the day before a game, for the NBA and the NFL.</p>
        <div className="flex gap-3">
          <Link href="/games" className="pl-label underline decoration-[var(--hot)] decoration-2 underline-offset-4">All games</Link>
          {LAB && <Link href={`/lab/${id.startsWith("soc") ? "match" : "game"}/${id}`} className="pl-label text-muted-foreground underline underline-offset-4">Open in the Lab</Link>}
        </div>
      </main>
    );
  }
  const hn = sides.names[sides.home], an = sides.names[sides.away];
  const w = when(b.start, b.time_tbd, local);
  const balance = b.insights.find((f) => f.kind === "balance");
  const sim = b.simulation as Record<string, unknown> | null;
  const labels = Object.fromEntries(b.traits.map((t) => [t.id, t.label]));
  const homeWin = typeof sim?.home_win === "number" ? sim.home_win : null;
  const awayWin = homeWin == null ? null : typeof sim?.away_win === "number" ? sim.away_win : 1 - homeWin;
  // the model's win shares: the simulation where there is one (NFL), else the score model's paths (NBA)
  const node = (k: string) => tree.data?.nodes.find((n) => n.id === k)?.p ?? null;
  const model = homeWin != null ? { h: homeWin, a: awayWin!, from: "in simulations" } : node("w:home") != null && node("w:away") != null ? { h: node("w:home")!, a: node("w:away")!, from: "in the score model" } : null;
  // the win share and the matchup count are two different readings; when they point different ways the page says so
  const modelTeam = model ? (model.h >= model.a ? sides.home : sides.away) : null;
  const apart = !!model && !!balance?.team && balance.team !== modelTeam;  // an even board names nobody: nothing to differ from
  const built = fmtDateTime(b.built_at, { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }, local);
  // days off before this game, from each side's last played game (a 0 is the second night of a back-to-back)
  const rest = b.start && !w?.started ? [b.away, b.home].flatMap((t) => {
    const days = b.rest?.[t.team];
    return days != null ? [{ team: t.team, name: sides.names[t.team], days }] : [];
  }) : [];

  return (
    <main className="mx-auto grid max-w-7xl gap-12 px-4 py-6 sm:gap-16 sm:py-10">
      {/* ---- head ---- */}
      <header className="grid gap-5">
        <div className="pl-label flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
          <Link href="/games" className="hover:text-foreground">Games</Link><span>/</span>
          <span>{SPORT[b.sport] ?? b.sport}</span>{w ? <><span>·</span><span>{w.day}, {w.time}</span></> : <><span>·</span><span>Date to come</span></>}
          <ShareButton url={`/game/${slug(b.event_id)}`} title={b.label} kind="game" sport={b.sport} className="-my-2 ml-auto" />
        </div>
        {b.result ? <FinalScore b={b} sides={sides} /> : w?.started && (
          <p className="rounded-xl border border-[var(--hot)]/50 bg-[var(--hot-soft)] px-3 py-2 text-sm">
            This game has started or finished. The breakdown below is as it stood before the start; the final score is added with the next data update.
          </p>
        )}
        {b.notes.map((x) => (
          <p key={x} className="flex gap-2 rounded-xl border border-[var(--status-warning)]/60 bg-[color-mix(in_oklab,var(--status-warning)_12%,transparent)] px-3 py-2.5 text-sm leading-relaxed">
            <span aria-hidden className="pl-label shrink-0 pt-0.5 text-[10px]">Read first</span><span>{x}</span>
          </p>
        ))}
        <h1 className="grid gap-2" aria-label={b.label}>
          {(b.sport === "soccer" ? [{ t: sides.home, name: hn, ink: HOME.ink, i: 1 }, { t: sides.away, name: an, ink: AWAY.ink, i: 0 }]
            : [{ t: sides.away, name: an, ink: AWAY.ink, i: 0 }, { t: sides.home, name: hn, ink: HOME.ink, i: 1 }]).map(({ t, name, ink, i }, at) => (
            <span key={t} className="contents">
              {at === 1 && <span className="pl-label pl-[calc(clamp(3rem,9vw,6.5rem)+1rem)] text-muted-foreground">{b.sport === "soccer" ? "versus" : "at"}</span>}
              <ViewLink href={teamHref(b.sport, t)} className="group flex w-fit max-w-full items-center gap-4">
                <Crest sport={b.sport} team={t} name={name} color={ink} eager className="!size-[clamp(3rem,9vw,6.5rem)] shrink-0"
                  style={{ viewTransitionName: crestName(b.event_id, i) }} size={104} />
                <SplitHeading as="h2" text={name} className="pl-display min-w-0 text-[clamp(2.4rem,9.5vw,7rem)] decoration-4 underline-offset-8 group-hover:underline" />
              </ViewLink>
            </span>
          ))}
        </h1>
        <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
          {model && (
            <Reveal className="col-span-2 grid gap-1 sm:col-span-1">
              <span className="pl-label text-[10px] text-muted-foreground">{model.h >= model.a ? hn : an} win {model.from}</span>
              <span className="pl-display text-5xl"><CountUp value={Math.round(Math.max(model.h, model.a) * 100)} format={(v) => `${v.toFixed(0)}%`} /></span>
            </Reveal>
          )}
          <Reveal delay={0.06} className="grid gap-1">
            <span className="pl-label text-[10px] text-muted-foreground">Findings</span>
            <span className="pl-display text-5xl"><CountUp value={b.insights.filter((f) => f.kind !== "balance").length} /></span>
          </Reveal>
          <Reveal delay={0.12} className="grid gap-1">
            <span className="pl-label text-[10px] text-muted-foreground" title="Every way one side's offense meets the other's defense that the data can measure. Some are too close to call.">Matchups measured</span>
            <span className="pl-display text-5xl"><CountUp value={b.matchups.length} /></span>
          </Reveal>
        </div>
        <p className="text-xs text-muted-foreground">Numbers as of {built}, from games before this one. Injuries and lineups are not in them.</p>
        {rest.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Rest before this game">
            {rest.map((r) => (
              <li key={r.team} className={`pl-label rounded-full border px-3 py-1.5 text-[10px] ${r.days === 0 ? "border-[var(--hot)] text-foreground" : "text-muted-foreground"}`}>
                {r.name}: {r.days === 0 ? "second night of a back-to-back" : `${r.days} ${r.days === 1 ? "day" : "days"} rest`}
              </li>
            ))}
          </ul>
        )}
        {balance && (
          <Reveal className="pl-reading grid gap-3 rounded-3xl border p-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-8 sm:p-7">
            <div className="grid gap-1.5">
              <span className="pl-label text-[10px] text-muted-foreground">The whole board</span>
              <p className="pl-matchup text-2xl sm:text-3xl">{balance.title}</p>
              <p className="text-sm text-muted-foreground">{balance.claim}</p>
              {apart && model && modelTeam && (
                <DataNote summary={`Why this differs from the ${Math.round(Math.max(model.h, model.a) * 100)}% above`} className="pt-1">
                  <span>The count asks who is better in more parts of the game, each part weighing the same. The {model.from === "in simulations" ? "simulation" : "score model"} plays the score out from each team&apos;s scoring and stopping rates, so a few parts weigh far more. They are separate readings and can point different ways; here they do.</span>
                </DataNote>
              )}
            </div>
            <Seen>{(seen) => <InsightViz f={balance} sides={sides} seen={seen} labels={labels} />}</Seen>
          </Reveal>
        )}
      </header>

      <BoardView b={b} after={(from) => <GameExtras b={b} sides={sides} from={from} />} />

      <Onward links={[
        ...(b.sport === "soccer" ? [] : [{ href: `/compare?sport=${b.sport}&a=${slug(sides.home)}&b=${slug(sides.away)}`, label: "These two teams as of today" }]),
        { href: teamHref(b.sport, sides.away), label: an }, { href: teamHref(b.sport, sides.home), label: hn }, { href: "/games", label: "All games" }]} />
      <footer className="grid gap-1 text-xs leading-relaxed text-muted-foreground">
        <p>{b.method}</p>
        <p>Built {built} · <Link href="/models" className="underline underline-offset-2">How it works</Link> · <Link href="/sources" className="underline underline-offset-2">Sources</Link></p>
      </footer>
    </main>
  );
}
