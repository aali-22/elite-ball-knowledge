"use client";

// One game as a story you scroll, not tabs of tables: the read on the whole board, the findings one at a time with the
// chart that shows each, the matchup diagram, both identities, the players, and how the game is simulated to go.
// Everything is computed (api/public/analytics.py); nothing here is an opinion, a pick or a price.
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { InsightCard, sidesOf } from "@/components/ebk/Cards";
import { BalanceBar, Duel, EdgeLadder, FormRibbon, IdentityRails, InsightViz, Landscape, MarginDist, inkOf } from "@/components/ebk/Charts";
import { Reveal, SplitHeading } from "@/components/motion/Reveal";
import { ScrollScene, Seen } from "@/components/motion/Scroll";
import { Scene } from "@/components/tactics/Scene";
import { CountUp } from "@/components/viz/CountUp";
import { KIND, SPORT, ord, playerHref, teamHref, useBoard, useLeague, when } from "@/lib/ebk";
import { AWAY, HOME, LAB } from "@/lib/site";

function Chapter({ n, title, lede, children }: { n: string; title: string; lede?: string; children: React.ReactNode }) {
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

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useBoard(id);
  const b = q.data;
  const league = useLeague(b?.sport ?? "nba");
  const [pick, setPick] = useState(0);
  const sides = useMemo(() => (b ? sidesOf(b) : null), [b]);
  const edges = useMemo(() => (b ? [...b.matchups].sort((x, y) => Math.abs(y.edge) * y.confidence - Math.abs(x.edge) * x.confidence) : []), [b]);

  useEffect(() => { if (b) document.title = `${b.label} · Elite Ball Knowledge`; }, [b]);

  if (q.isLoading) return <main className="mx-auto grid max-w-6xl gap-4 px-4 py-10"><div className="h-40 animate-pulse rounded-3xl bg-muted" /><div className="h-80 animate-pulse rounded-3xl bg-muted" /></main>;
  if (!b || !sides) {
    return (
      <main className="mx-auto grid max-w-3xl gap-3 px-4 py-16">
        <h1 className="pl-display text-5xl">No breakdown for this game</h1>
        <p className="text-sm text-muted-foreground">Breakdowns are built the day before a game, for the NBA, the NFL and the top soccer leagues.</p>
        <div className="flex gap-3">
          <Link href="/games" className="pl-label underline decoration-[var(--hot)] decoration-2 underline-offset-4">All games</Link>
          {LAB && <Link href={`/lab/${id.startsWith("soc") ? "match" : "game"}/${id}`} className="pl-label text-muted-foreground underline underline-offset-4">Open in the Lab</Link>}
        </div>
      </main>
    );
  }
  const hn = sides.names[sides.home], an = sides.names[sides.away];
  const w = when(b.start);
  const story = b.insights.slice(0, 5), rest = b.insights.slice(5);
  const balance = b.insights.find((f) => f.kind === "balance");
  const sim = b.simulation as Record<string, unknown> | null;
  const homeSide = { code: sides.home, name: hn, color: HOME.hex }, awaySide = { code: sides.away, name: an, color: AWAY.hex };
  const labels = Object.fromEntries(b.traits.map((t) => [t.id, t.label]));
  const stars = b.player_matchups.filter((e) => e.edge > 0 && e.attack.rank && e.resist.rank).sort((x, y) => y.edge * y.confidence - x.edge * x.confidence).slice(0, 6);
  const homeWin = typeof sim?.home_win === "number" ? sim.home_win : null;
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <main className="mx-auto grid max-w-6xl gap-12 px-4 py-6 sm:gap-16 sm:py-10">
      {/* ---- head ---- */}
      <header className="grid gap-5">
        <div className="pl-label flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
          <Link href="/games" className="hover:text-foreground">Games</Link><span>/</span>
          <span>{SPORT[b.sport] ?? b.sport}</span>{w && <><span>·</span><span>{w.day}, {w.time}</span></>}
        </div>
        <h1 className="grid gap-1" aria-label={b.label}>
          <Link href={teamHref(b.sport, sides.away)} className="group w-fit">
            <SplitHeading as="h2" text={an} className="pl-display text-[clamp(2.8rem,11vw,8rem)] decoration-[var(--side-b)] decoration-4 underline-offset-8 group-hover:underline" />
          </Link>
          <span className="pl-label text-muted-foreground">{b.sport === "soccer" ? "versus" : "at"}</span>
          <Link href={teamHref(b.sport, sides.home)} className="group w-fit">
            <SplitHeading as="h2" text={hn} className="pl-display text-[clamp(2.8rem,11vw,8rem)] decoration-[var(--side-a)] decoration-4 underline-offset-8 group-hover:underline" />
          </Link>
        </h1>
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
          <Reveal className="grid gap-1">
            <span className="pl-label text-[10px] text-muted-foreground">Matchups measured</span>
            <span className="pl-display text-5xl"><CountUp value={b.matchups.length} /></span>
          </Reveal>
          <Reveal delay={0.06} className="grid gap-1">
            <span className="pl-label text-[10px] text-muted-foreground">Findings</span>
            <span className="pl-display text-5xl"><CountUp value={b.insights.length} /></span>
          </Reveal>
          <Reveal delay={0.12} className="grid gap-1">
            <span className="pl-label text-[10px] text-muted-foreground">{homeWin != null ? `${homeWin >= 0.5 ? hn : an} in simulations` : "Traits per team"}</span>
            <span className="pl-display text-5xl">{homeWin != null ? <CountUp value={Math.round(Math.max(homeWin, 1 - homeWin) * 100)} format={(v) => `${v.toFixed(0)}%`} /> : <CountUp value={b.home.traits.length} />}</span>
          </Reveal>
        </div>
        {balance && (
          <Reveal className="pl-reading grid gap-3 rounded-3xl border p-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-8 sm:p-7">
            <div className="grid gap-1.5">
              <span className="pl-label text-[10px] text-muted-foreground">The whole board</span>
              <p className="pl-matchup text-2xl sm:text-3xl">{balance.title}</p>
              <p className="text-sm text-muted-foreground">{balance.claim}</p>
            </div>
            <Seen>{(seen) => <InsightViz f={balance} sides={sides} seen={seen} labels={labels} />}</Seen>
          </Reveal>
        )}
        {b.notes.map((x) => <p key={x} className="rounded-xl border-l-2 border-[var(--status-warning)] bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{x}</p>)}
      </header>

      {/* ---- findings, one at a time ---- */}
      {story.length > 0 && (
        <Chapter n={num()} title="What decides it" lede="The strongest findings on this board, written by rule from its numbers. Scroll: the chart redraws for each one.">
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
                <span className="pl-label w-fit rounded-full px-2 py-1 text-[10px] text-background" style={{ background: inkOf(sides, f.team) === "var(--viz-muted)" ? "var(--foreground)" : inkOf(sides, f.team) }}>{f.team ? sides.names[f.team] ?? f.team : "Both sides"}</span>
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
        <Chapter n={num()} title="Where it tilts" lede="Each row is one way an offense meets a defense. Pick a row to see it drawn.">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
            <div className="pl-reading rounded-3xl border p-4 sm:p-5"><Seen>{(seen) => <EdgeLadder edges={edges} sides={sides} pick={pick} onPick={setPick} seen={seen} />}</Seen></div>
            <div className="grid gap-4 lg:sticky lg:top-16">
              <Scene key={`${edges[pick].mechanism}:${edges[pick].attack_team}`} edge={edges[pick]} home={homeSide} away={awaySide} />
              {edges[pick].attack && edges[pick].resist && (
                <div className="pl-reading rounded-2xl border p-4">
                  <Duel seen sides={sides} attackLabel={labels[edges[pick].attack!.trait] ?? "Attack"} resistLabel={labels[edges[pick].resist!.trait] ?? "Defense"}
                    attack={{ team: edges[pick].attack_team, rank: edges[pick].attack!.adj_rank ?? edges[pick].attack!.rank, of: edges[pick].attack!.of, percentile: edges[pick].attack!.adj_percentile ?? edges[pick].attack!.percentile }}
                    resist={{ team: edges[pick].resist_team, rank: edges[pick].resist!.adj_rank ?? edges[pick].resist!.rank, of: edges[pick].resist!.of, percentile: edges[pick].resist!.adj_percentile ?? edges[pick].resist!.percentile }} />
                </div>
              )}
            </div>
          </div>
        </Chapter>
      )}

      {/* ---- identities ---- */}
      <Chapter n={num()} title="Who they are" lede="Every trait we compute for both teams on one scale. The widest gaps come first; a long line between two dots is a real difference.">
        <div className="pl-reading rounded-3xl border p-4 sm:p-6">
          <Seen>{(seen) => <IdentityRails home={b.home.traits} away={b.away.traits} meta={b.traits} sides={sides} seen={seen} limit={12} />}</Seen>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[b.away, b.home].map((t) => (
            <Reveal key={t.team} className="pl-reading grid gap-3 rounded-3xl border p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="pl-matchup text-2xl" style={{ boxShadow: `inset 0 -0.14em 0 ${inkOf(sides, t.team)}` }}>{sides.names[t.team]}</h3>
                <Link href={teamHref(b.sport, t.team)} className="pl-label text-[10px] text-muted-foreground hover:text-foreground">Team page →</Link>
              </div>
              <Seen>{(seen) => <FormRibbon games={t.opponents} seen={seen} />}</Seen>
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
        <Chapter n={num()} title="Who it runs through" lede="Players whose production ranks high at their position, against a defense that ranks low at stopping exactly that.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stars.map((e, i) => (
              <Reveal key={`${e.player_id}:${e.mechanism}`} delay={i * 0.04} className="pl-reading grid content-start gap-3 rounded-2xl border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={playerHref(e.player_id)} className="pl-matchup text-xl hover:underline">{e.player}</Link>
                  <span className="pl-label text-[10px] text-muted-foreground">{e.position} · {sides.names[e.team] ?? e.team}</span>
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
                    <p className="text-sm leading-relaxed"><b className="pl-label mr-1.5 text-[10px] text-muted-foreground">If</b>{a.if_branch}.</p>
                    <p className="text-sm leading-relaxed"><b className="pl-label mr-1.5 text-[10px] text-muted-foreground">Then</b>{a.then_branch}.</p>
                  </Reveal>
                ))}
              </div>
            </div>
          )}
        </Chapter>
      )}

      {/* ---- simulation ---- */}
      {sim && Array.isArray(sim.margin_dist) && (
        <Chapter n={num()} title="How it plays out" lede="The game played twenty thousand times, drive by drive, from each team's own scoring rates. A model's inference, not a forecast of record.">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center">
            <div className="pl-reading rounded-3xl border p-4 sm:p-6"><MarginDist sim={sim} home={hn} away={an} /></div>
            <Reveal className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1 border-l pl-3"><span className="pl-label text-[10px] text-muted-foreground">{an} average</span><span className="pl-display text-5xl"><CountUp value={Number(sim.away_pts ?? 0)} format={(v) => v.toFixed(1)} /></span></div>
                <div className="grid gap-1 border-l pl-3"><span className="pl-label text-[10px] text-muted-foreground">{hn} average</span><span className="pl-display text-5xl"><CountUp value={Number(sim.home_pts ?? 0)} format={(v) => v.toFixed(1)} /></span></div>
              </div>
              {homeWin != null && <Seen>{(seen) => <BalanceBar seen={seen} home={`${hn} win`} away={`${an} win`} homeWins={Math.round(homeWin * 100)} awayWins={Math.round((1 - homeWin) * 100)} />}</Seen>}
              <p className="text-xs leading-relaxed text-muted-foreground">Shares are out of 100 simulated games. The spread of the histogram is the honest part: one game can land almost anywhere inside it.</p>
            </Reveal>
          </div>
        </Chapter>
      )}

      <footer className="grid gap-1 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        <p>{b.method}</p>
        <p>Built {new Date(b.built_at).toLocaleString()} · <Link href="/picklab/sources" className="underline underline-offset-2">Sources and method</Link></p>
      </footer>
    </main>
  );
}
