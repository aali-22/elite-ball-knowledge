"use client";

// The front door: what the site is in one line over a moving diagram, tonight's games, the sharpest findings told one
// at a time as you scroll, and the whole league on one plot. Everything is read from /api/public/analytics.
import { ArrowDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { InsightCard, GameTile, sidesOf } from "@/components/ebk/Cards";
import { SportPicker } from "@/components/ebk/Controls";
import { InsightViz, Landscape } from "@/components/ebk/Charts";
import { Reveal, SplitHeading } from "@/components/motion/Reveal";
import { Parallax, ScrollScene, Seen } from "@/components/motion/Scroll";
import { Strip } from "@/components/motion/Strip";
import { useClock } from "@/components/tactics/fields";
import { SCENES } from "@/components/tactics/scenes";
import { CountUp } from "@/components/viz/CountUp";
import { KIND, SPORT, gameHref, useLeague, useSlate, type SlateGame } from "@/lib/ebk";
import { AWAY, HOME, SITE } from "@/lib/site";

const HERO_SCENES = ["nba.half_court", "nfl.deep_shot", "soccer.press_trap", "nba.transition", "nfl.run_funnel", "soccer.set_piece"];

function HeroScene() {
  const clock = useClock(5200);
  const [i, setI] = useState(0);
  const View = SCENES[HERO_SCENES[i % HERO_SCENES.length]];
  return (
    <button type="button" onClick={() => setI((v) => v + 1)} aria-label="An animated diagram of a play. Activate to show another." className="block w-full overflow-hidden rounded-3xl border opacity-90 transition-opacity hover:opacity-100">
      {View && <View t={clock.t} win a={HOME.hex} d={AWAY.hex} aLabel="Attack" dLabel="Defense" />}
    </button>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="grid gap-1 border-l pl-4">
      <span className="pl-display text-5xl sm:text-6xl"><CountUp value={value} /></span>
      <span className="pl-label text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function Home() {
  const slate = useSlate(undefined, 5);
  const games = useMemo(() => slate.data?.games ?? [], [slate.data]);
  const sports = slate.data?.sports ?? [];
  const [sport, setSport] = useState<string | null>(null);
  // "All" means every sport gets on the strip: the soonest game of each first, then the rest in order
  const shown = useMemo(() => {
    if (sport) return games.filter((g) => g.sport === sport);
    const lead = new Map<string, SlateGame>();
    for (const g of games) if (!lead.has(g.sport)) lead.set(g.sport, g);
    const first = [...lead.values()];
    return [...first, ...games.filter((g) => !first.includes(g))].slice(0, 14).sort((a, b) => (a.start ?? "9").localeCompare(b.start ?? "9"));
  }, [games, sport]);
  // The story: the strongest headline per game, best first, one per kind where possible so the scroll isn't one idea.
  const story = useMemo(() => {
    const ranked = games.filter((g): g is SlateGame & { headline: NonNullable<SlateGame["headline"]> } => !!g.headline && g.headline.kind !== "balance" && (!sport || g.sport === sport))
      .sort((a, b) => b.headline.score - a.headline.score);
    const seen = new Set<string>(), out: typeof ranked = [];
    for (const g of ranked) if (!seen.has(g.headline.kind) && out.length < 4) { seen.add(g.headline.kind); out.push(g); }
    for (const g of ranked) if (out.length < 4 && !out.includes(g)) out.push(g);
    return out;
  }, [games, sport]);
  const leagueSport = sports.includes("nba") ? "nba" : sports.includes("nfl") ? "nfl" : sports[0] ?? "nba";
  const [lg, setLg] = useState<string | null>(null);
  const league = useLeague(lg ?? leagueSport);
  const findings = games.reduce((n, g) => n + g.findings, 0);

  return (
    <main>
      {/* ---- hero ---- */}
      <section className="relative mx-auto grid max-w-7xl gap-8 px-4 pt-8 pb-10 sm:pt-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-12">
        <div className="grid gap-5">
          <p className="pl-label text-[var(--hot)]">Sports analytics, shown not told</p>
          <SplitHeading text="Elite Ball Knowledge" className="pl-display text-[clamp(3.4rem,12.4vw,9.4rem)]" />
          <Reveal delay={0.25}>
            <p className="max-w-xl text-lg leading-snug text-muted-foreground sm:text-xl">
              Who each team really is, where the next game tilts, and what the numbers say decides it. Every claim sits next
              to the chart behind it.
            </p>
          </Reveal>
          <Reveal delay={0.3} className="flex flex-wrap gap-2">
            <Link href="/games" className="pl-label inline-flex items-center gap-2 rounded-full bg-[var(--hot)] px-5 py-3 text-[var(--hot-ink)]">Upcoming games <ArrowRight className="size-4" /></Link>
            <a href="#story" className="pl-label inline-flex items-center gap-2 rounded-full border px-5 py-3 hover:bg-muted">Scroll the story <ArrowDown className="size-4" /></a>
          </Reveal>
        </div>
        <Parallax amount={28}><HeroScene /></Parallax>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 pb-12 sm:grid-cols-4">
        <Stat value={games.length} label="Games broken down" />
        <Stat value={findings} label="Findings, written by rule" />
        <Stat value={sports.length} label={sports.length === 1 ? "Sport on the slate" : "Sports on the slate"} />
        <Stat value={0} label="Sentences written by AI" />
      </section>

      {/* ---- slate ---- */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
          <h2 className="pl-display text-4xl sm:text-6xl">On the slate</h2>
          <SportPicker sports={sports} value={sport} onChange={setSport} />
        </div>
        {slate.isLoading && <div className="h-56 animate-pulse rounded-3xl bg-muted" />}
        {slate.isError && <p className="text-sm text-muted-foreground">The slate couldn&apos;t be loaded. Try again in a moment.</p>}
        {!slate.isLoading && !shown.length && !slate.isError && <p className="text-sm text-muted-foreground">No games with a breakdown right now. Boards are built the day before each game.</p>}
        {shown.length > 0 && (
          <Strip label="Games">
            {shown.slice(0, 14).map((g, i) => (
              <Reveal key={g.event_id} delay={i * 0.04} x={24} y={0} className="w-[82vw] max-w-[22rem] shrink-0 snap-start">
                <GameTile g={g} className="h-full min-h-56" />
              </Reveal>
            ))}
          </Strip>
        )}
        <Link href="/games" className="pl-label justify-self-start underline decoration-[var(--hot)] decoration-2 underline-offset-4">Every game →</Link>
      </section>

      {/* ---- the story ---- */}
      {story.length > 0 && (
        <section id="story" className="mx-auto max-w-7xl scroll-mt-16 px-4 pt-10">
          <div className="grid gap-2 border-t pt-4">
            <h2 className="pl-display text-4xl sm:text-6xl">What the numbers noticed</h2>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">The strongest finding on each of {story.length} {sport ? `${SPORT[sport] ?? sport} ` : ""}games coming up, each with the chart behind it.</p>
          </div>
          <ScrollScene steps={story}
            visual={(i) => {
              const g = story[i];
              return (
                <div key={g.event_id} className="pl-reading grid w-full max-w-xl gap-4 rounded-3xl border p-5 sm:p-7">
                  <div className="pl-label flex justify-between text-[10px] text-muted-foreground"><span>{KIND[g.headline.kind]}</span><span>{i + 1} / {story.length}</span></div>
                  <p className="pl-matchup text-2xl sm:text-3xl">{g.headline.title}</p>
                  <Seen>{(seen) => <InsightViz f={g.headline} sides={sidesOf(g)} seen={seen} labels={{}} />}</Seen>
                </div>
              );
            }}
            step={(g, i) => (
              <div className="grid max-w-md gap-3 py-6">
                <span className="pl-display text-7xl text-[var(--hot)] sm:text-8xl">{String(i + 1).padStart(2, "0")}</span>
                <p className="pl-label text-[10px] text-muted-foreground">{SPORT[g.sport] ?? g.sport} · {g.label}</p>
                <p className="text-lg leading-snug sm:text-xl">{g.headline.claim}</p>
                {g.headline.detail && <p className="text-sm leading-relaxed text-muted-foreground">{g.headline.detail}</p>}
                <Link href={gameHref(g.event_id)} aria-label={`Open the full breakdown of ${g.label}`} className="pl-label inline-flex min-h-10 items-center justify-self-start rounded-full border px-4 text-[10px] hover:bg-muted">Open the full breakdown →</Link>
              </div>
            )} />
        </section>
      )}

      {/* ---- league ---- */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
          <h2 className="pl-display text-4xl sm:text-6xl">The league, on one plot</h2>
          <SportPicker sports={sports} value={lg ?? leagueSport} onChange={(v) => setLg(v)} all={false} label="League" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center">
          <div className="pl-reading rounded-3xl border p-4 sm:p-6">
            {league.data ? <Seen>{(seen) => <Landscape teams={league.data!.teams} sport={league.data!.sport} seen={seen} />}</Seen> : <div className="h-80 animate-pulse rounded-2xl bg-muted" />}
          </div>
          <Reveal className="grid gap-3">
            <p className="text-lg leading-snug">Each dot is a team. Right is a better offense, up is a better defense, and the top-right corner is where contenders live.</p>
            <p className="text-sm leading-relaxed text-muted-foreground">Positions are the average league percentile of every trait we compute for that side of the ball, with the strength of the schedule taken out where it can be. Pick a dot to open the team.</p>
            <Link href={`/league/${lg ?? leagueSport}`} className="pl-label justify-self-start underline decoration-[var(--hot)] decoration-2 underline-offset-4">Explore the league →</Link>
          </Reveal>
        </div>
      </section>

      {/* ---- more findings ---- */}
      {games.length > 4 && (
        <section className="mx-auto grid max-w-7xl gap-4 px-4 pt-12">
          <h2 className="pl-display border-t pt-4 text-4xl sm:text-6xl">More from the board</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.filter((g) => g.headline && g.headline.kind !== "balance" && (!sport || g.sport === sport) && !story.includes(g as never)).slice(0, 6).map((g, i) => (
              <Reveal key={g.event_id} delay={i * 0.05}>
                <Link href={gameHref(g.event_id)} aria-label={`${g.label}: ${g.headline!.title}`} className="grid h-full gap-2 transition-transform duration-300 hover:-translate-y-0.5">
                  <span className="pl-label text-[10px] text-muted-foreground">{SPORT[g.sport] ?? g.sport} · {g.label}</span>
                  <InsightCard f={g.headline!} sides={sidesOf(g)} className="h-full" />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pt-14 sm:grid-cols-2">
        {[{ href: "/findings", k: "Every finding", t: "Browse what the numbers noticed", d: "Mismatches, schedule mirages, player edges: filter by kind and sport, strongest first." },
          { href: "/compare", k: "What if", t: "Put any two teams together", d: "Pick two teams and get the full breakdown as if they met today." }].map((c, i) => (
          <Reveal key={c.href} delay={i * 0.06}>
            <Link href={c.href} className="group grid h-full gap-2 rounded-3xl border p-6 transition-colors hover:border-foreground/40 sm:p-8">
              <span className="pl-label text-[10px] text-[var(--hot)]">{c.k}</span>
              <span className="pl-display text-3xl sm:text-4xl">{c.t}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{c.d}</span>
              <ArrowRight aria-hidden className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-4">
        <Reveal className="grid gap-3 rounded-3xl border p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
          <div className="grid gap-2">
            <p className="pl-label text-[10px] text-muted-foreground">Also on {SITE.short}</p>
            <h2 className="pl-display text-4xl sm:text-5xl">PickLab: who is actually right?</h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">Public analysts make picks every day. PickLab writes each one down and grades it against the final score, so a record is a fact you can look up.</p>
          </div>
          <Link href="/picklab/experts" className="pl-label inline-flex items-center gap-2 justify-self-start rounded-full border px-5 py-3 hover:bg-muted">See the records <ArrowRight className="size-4" /></Link>
        </Reveal>
      </section>
    </main>
  );
}
