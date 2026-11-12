"use client";

// A board as a story you scroll: the findings one at a time with the chart that shows each, the matchup diagram, both
// identities, the players, and how the game is simulated to go. Used by a real game's page and by the what-if compare.
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { InsightCard, sidesOf } from "@/components/ebk/Cards";
import { BalanceBar, Duel, EdgeLadder, FormRibbon, IdentityRails, InsightViz, Landscape, MarginDist, inkOf } from "@/components/ebk/Charts";
import { Crest, Face } from "@/components/ebk/Crest";
import { Reveal } from "@/components/motion/Reveal";
import { ScrollScene, Seen } from "@/components/motion/Scroll";
import { Scene } from "@/components/tactics/Scene";
import { CountUp } from "@/components/viz/CountUp";
import { KIND, ord, playerHref, teamHref, useLeague, type Board } from "@/lib/ebk";
import { AWAY, HOME } from "@/lib/site";

export function Chapter({ n, title, lede, children }: { n: string; title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-t pt-5">
      <Reveal className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-end sm:gap-6">
        <span className="pl-display text-6xl text-[var(--hot)] sm:text-8xl">{n}</span>
        <div className="grid gap-1.5">
          <h2 className="pl-display text-4xl sm:text-6xl">{title}</h2>
          {lede && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{lede}</p>}
        </div>
      </Reveal>
      {children}
    </section>
  );
}

export function BoardView({ b, after }: { b: Board; after?: (from: number) => React.ReactNode }) {
  const league = useLeague(b.sport);
  const [pick, setPick] = useState(0);
  const sides = useMemo(() => sidesOf(b), [b]);
  const edges = useMemo(() => [...b.matchups].sort((x, y) => Math.abs(y.edge) * y.confidence - Math.abs(x.edge) * x.confidence), [b]);
  const hn = sides.names[sides.home], an = sides.names[sides.away];
  const story = b.insights.filter((f) => f.kind !== "balance").slice(0, 5), rest = b.insights.filter((f) => f.kind !== "balance").slice(5);
  const sim = b.simulation as Record<string, unknown> | null;
  const homeSide = { code: sides.home, name: hn, color: HOME.hex }, awaySide = { code: sides.away, name: an, color: AWAY.hex };
  const labels = Object.fromEntries(b.traits.map((t) => [t.id, t.label]));
  // Players in the top third at their position, one card each (their best matchup), three a side so neither team
  // crowds the other out.
  const stars = useMemo(() => {
    const best = new Map<string, Board["player_matchups"][number]>();
    for (const e of [...b.player_matchups].sort((x, y) => y.edge * y.confidence - x.edge * x.confidence)) {
      if (e.edge <= 0 || !e.attack.rank || !e.attack.of || !e.resist.rank || e.attack.rank > e.attack.of / 3) continue;
      if (!best.has(e.player_id)) best.set(e.player_id, e);
    }
    const side = (t: string) => [...best.values()].filter((e) => e.team === t).slice(0, 3);
    return [...side(sides.away), ...side(sides.home)];
  }, [b.player_matchups, sides]);
  const homeWin = typeof sim?.home_win === "number" ? sim.home_win : null;
  const at = Math.min(pick, Math.max(0, edges.length - 1));
  // where the list and its drawing are stacked (below `lg`), picking a row brings the drawing into view: it is the
  // answer to the tap, and it sits a screen below the list
  const drawn = useRef<HTMLDivElement>(null);
  const choose = (i: number) => {
    setPick(i);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => drawn.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" }));
    }
  };
  // chapter numbers: only chapters that are on the page get one, and the chapters after the board carry on from it
  const has = [story.length > 0, edges.length > 0, true, stars.length > 0, !!(sim && Array.isArray(sim.margin_dist))];
  const no = (i: number) => String(has.slice(0, i + 1).filter(Boolean).length).padStart(2, "0");
  const shown = has.filter(Boolean).length;
  return (
    <>
      {/* ---- findings, one at a time ---- */}
      {story.length > 0 && (
        <Chapter n={no(0)} title="What decides it" lede="The strongest findings on this board, written by rule from its numbers, each with the chart that shows it.">
          <ScrollScene steps={story}
            visual={(i) => {
              const f = story[i];
              return (
                <div key={f.id} className="pl-reading grid w-full max-w-xl gap-4 rounded-3xl border p-5 sm:p-7">
                  <div className="pl-label flex justify-between text-[10px] text-muted-foreground"><span>{KIND[f.kind]}</span><span>{i + 1} / {story.length}</span></div>
                  <p className="pl-matchup text-2xl sm:text-3xl">{f.title}</p>
                  <Seen>{(seen) => <InsightViz f={f} sides={sides} seen={seen} labels={labels} />}</Seen>
                  {f.small_sample && <p className="pl-label text-[10px] text-muted-foreground">Small sample: read it as a lean, not a fact</p>}
                </div>
              );
            }}
            step={(f, i) => (
              <div className="grid max-w-md gap-3 py-6">
                <span className="pl-label inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] text-muted-foreground" title="Who this finding is about">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: inkOf(sides, f.team) }} />About {f.team ? sides.names[f.team] ?? f.team : "both sides"}</span>
                <p className="text-xl leading-snug sm:text-2xl">{f.claim}</p>
                {f.detail && <p className="text-sm leading-relaxed text-muted-foreground">{f.detail}</p>}
                <span className="pl-label text-[10px] text-muted-foreground">Finding {i + 1} of {story.length}</span>
              </div>
            )} />
          {rest.length > 0 && <div className="grid gap-4 sm:grid-cols-2">{rest.map((f, i) => <Reveal key={f.id} delay={i * 0.05}><InsightCard f={f} sides={sides} className="h-full" /></Reveal>)}</div>}
        </Chapter>
      )}

      {/* ---- matchups ---- */}
      {edges.length > 0 && (
        <Chapter n={no(1)} title="Where it tilts" lede="Each row is one way an offense meets a defense. Pick a row to see it drawn.">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
            <div className="pl-reading rounded-3xl border p-4 sm:p-5"><Seen>{(seen) => <EdgeLadder edges={edges} sides={sides} pick={at} onPick={choose} seen={seen} />}</Seen></div>
            <div ref={drawn} className="grid scroll-mt-28 gap-4 lg:sticky lg:top-16">
              <Scene key={`${edges[at].mechanism}:${edges[at].attack_team}`} edge={edges[at]} home={homeSide} away={awaySide} />
              {edges[at].attack && edges[at].resist && (
                <div className="pl-reading rounded-2xl border p-4">
                  <Duel seen sides={sides} attackLabel={labels[edges[at].attack!.trait] ?? "Attack"} resistLabel={labels[edges[at].resist!.trait] ?? "Defense"}
                    attack={{ team: edges[at].attack_team, rank: edges[at].attack!.adj_rank ?? edges[at].attack!.rank, of: edges[at].attack!.of, percentile: edges[at].attack!.adj_percentile ?? edges[at].attack!.percentile }}
                    resist={{ team: edges[at].resist_team, rank: edges[at].resist!.adj_rank ?? edges[at].resist!.rank, of: edges[at].resist!.of, percentile: edges[at].resist!.adj_percentile ?? edges[at].resist!.percentile }} />
                </div>
              )}
            </div>
          </div>
        </Chapter>
      )}

      {/* ---- identities ---- */}
      <Chapter n={no(2)} title="Who they are" lede="Every trait we compute for both teams on one scale. The widest gaps come first; a long line between two dots is a real difference.">
        <div className="pl-reading rounded-3xl border p-4 sm:p-6">
          <Seen>{(seen) => <IdentityRails home={b.home.traits} away={b.away.traits} meta={b.traits} sides={sides} seen={seen} limit={12} />}</Seen>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[b.away, b.home].map((t) => (
            <Reveal key={t.team} className="pl-reading grid gap-3 rounded-3xl border p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="flex items-center gap-2.5"><Crest sport={b.sport} team={t.team} name={sides.names[t.team]} size={30} color={inkOf(sides, t.team)} />
                  <span className="pl-matchup text-2xl" style={{ boxShadow: `inset 0 -0.14em 0 ${inkOf(sides, t.team)}` }}>{sides.names[t.team]}</span></h3>
                <Link href={teamHref(b.sport, t.team)} className="pl-label -my-2 inline-flex min-h-10 shrink-0 items-center text-[10px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Team page →</Link>
              </div>
              <Seen>{(seen) => <FormRibbon games={t.opponents} seen={seen} sport={b.sport} />}</Seen>
            </Reveal>
          ))}
        </div>
        {league.data && league.data.teams.length > 4 && (
          <div className="pl-reading rounded-3xl border p-4 sm:p-6">
            <Seen>{(seen) => <Landscape teams={league.data!.teams} sport={b.sport} focus={[sides.home, sides.away]} seen={seen} height={340} />}</Seen>
          </div>
        )}
      </Chapter>

      {/* ---- players ---- */}
      {stars.length > 0 && (
        <Chapter n={no(3)} title="Who it runs through" lede="Players in the top third at their position in a kind of production, against how the other defense ranks at stopping exactly that. Up to three a side.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stars.map((e, i) => (
              <Reveal key={`${e.player_id}:${e.mechanism}`} delay={i * 0.04} className="pl-reading grid content-start gap-3 rounded-2xl border p-4">
                <div className="flex items-center gap-3">
                  <Face playerId={e.player_id} name={e.player} size={46} color={inkOf(sides, e.team)} />
                  <div className="grid min-w-0">
                    <Link href={playerHref(e.player_id)} className="pl-matchup truncate text-xl hover:underline">{e.player}</Link>
                    <span className="pl-label text-[10px] text-muted-foreground">{e.position} · {sides.names[e.team] ?? e.team}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{e.label}</p>
                <Seen>{(seen) => <Duel seen={seen} sides={sides} attackLabel={labels[e.attack.trait] ?? "Production"} resistLabel={labels[e.resist.trait] ?? "Defense"}
                  attack={{ team: e.team, rank: e.attack.rank, of: e.attack.of, label: e.player }}
                  resist={{ team: e.opponent, rank: e.resist.adj_rank ?? e.resist.rank, of: e.resist.of, percentile: e.resist.adj_percentile ?? e.resist.percentile }} />}</Seen>
                <p className="text-[11px] text-muted-foreground">{e.attack.n} games · {ord(e.attack.rank!)} of {e.attack.of} at the position</p>
              </Reveal>
            ))}
          </div>
          {b.adjustments.length > 0 && (
            <div className="grid gap-3">
              <h3 className="pl-label text-muted-foreground">The questions a coach has to answer</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {b.adjustments.map((a, i) => (
                  <Reveal key={a.question} delay={i * 0.05} className="grid content-start gap-2 rounded-2xl border p-4">
                    <p className="pl-matchup text-xl">{a.question}</p>
                    <p className="text-sm leading-relaxed"><b className="pl-label mr-1.5 text-[10px] text-muted-foreground">If</b> {a.if_branch}.</p>
                    <p className="text-sm leading-relaxed"><b className="pl-label mr-1.5 text-[10px] text-muted-foreground">Then</b> {a.then_branch}.</p>
                  </Reveal>
                ))}
              </div>
            </div>
          )}
        </Chapter>
      )}

      {/* ---- simulation ---- */}
      {sim && Array.isArray(sim.margin_dist) && (
        <Chapter n={no(4)} title="How it plays out" lede="The game played twenty thousand times, drive by drive, from each team's own scoring rates. A model's inference, not a forecast of record.">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center">
            <div className="pl-reading rounded-3xl border p-4 sm:p-6"><MarginDist sim={sim} home={hn} away={an} /></div>
            <Reveal className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1 border-l pl-3"><span className="pl-label text-[10px] text-muted-foreground">{an} average</span><span className="pl-display text-5xl"><CountUp value={Number(sim.away_pts ?? 0)} format={(v) => v.toFixed(1)} /></span></div>
                <div className="grid gap-1 border-l pl-3"><span className="pl-label text-[10px] text-muted-foreground">{hn} average</span><span className="pl-display text-5xl"><CountUp value={Number(sim.home_pts ?? 0)} format={(v) => v.toFixed(1)} /></span></div>
              </div>
              {homeWin != null && <Seen>{(seen) => <BalanceBar seen={seen} home={`${hn} win`} away={`${an} win`} homeWins={Math.round(homeWin * 100)} awayWins={Math.round((typeof sim.away_win === "number" ? sim.away_win : 1 - homeWin) * 100)} />}</Seen>}
              <p className="text-xs leading-relaxed text-muted-foreground">The model knows each team&apos;s scoring rates and nothing else: no injuries, no lineups, no betting line. When it sits far from the line analysts are quoting, the likelier reason is something it can&apos;t see, not value.</p>
              <p className="text-xs leading-relaxed text-muted-foreground">Shares are of all simulated games. The spread of the histogram is the honest part: one game can land almost anywhere inside it.</p>
            </Reveal>
          </div>
        </Chapter>
      )}

      {after?.(shown)}
    </>
  );
}
