"use client";

// How the numbers are made, with the one formula a reader can play with. No data is loaded here.
import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { TrackRecordSection } from "@/components/ebk/TrackRecord";
import { Onward } from "@/components/ebk/Onward";
import { Duel, RankShift } from "@/components/ebk/Charts";
import { Reveal } from "@/components/motion/Reveal";
import { ord } from "@/lib/ebk";
import { HOME } from "@/lib/site";

const SIDES = { home: "ATK", away: "DEF", names: { ATK: "Offense", DEF: "Defense" } };
const RULES = [
  ["Mismatch", "An edge of 0.45 or more by the formula above, with a sample of at least 40% of a full one behind both traits. That is, for example, a top-third offense against a bottom-third defense, or an average offense against the league's worst."],
  ["Schedule mirage", "A top-third rank that falls at least a tenth of the league once the opponents are taken out, built against one of the easiest third of schedules."],
  ["Better than it looks", "A rank that rises at least a tenth of the league into the top half once the opponents are taken out, earned against one of the hardest third of schedules."],
  ["The real thing", "A top-fifth or bottom-fifth rank that stays there after the adjustment."],
  ["Player edge", "A player in the top fifth at his position in a kind of production, against a defense in the bottom two fifths at stopping it (an edge of 0.5 or more)."],
  ["Opposite ends", "The same trait, where the two teams sit at least 60 percentile points apart on the ranks shown (with the schedule taken out where it can be)."],
  ["The whole board", "The count of matchups each side wins with an edge of at least 0.10 and a sample of at least 30% of a full one; the rest are called too close. A side is named when it wins 60% or more of the counted matchups; anything closer is an even board. The matchup table's own table view lists each row's sample and whether it was counted."],
  ["Form", "Scoring in the last three games against the season, with the strength of those three opponents. Always flagged as a small sample."],
  ["Simulation", "NFL: the game played drive by drive twenty thousand times from each team's own rates. NBA: the site's own rating model, built before tip-off, turned into a full spread of final scores whose width was fitted to past seasons' results. Neither sees injuries or lineups. How their win shares have held up is counted in the record at the bottom of this page."],
];
const NOTES = [
  ["How many show", "A game shows at most three mismatches, three player edges and two of each other kind, strongest first, and one finding per trait and team. Everything else that qualifies is still in the game's matchup table."],
  ["Which season", "A breakdown uses this season's numbers once both teams have played 10 games; until then the whole breakdown uses last season's, and says so. This season's teams are ranked only against each other; a team still on last season's numbers keeps last season's ranks and is marked."],
  ["Sample", "Each matchup's sample is shown as a share of a full one: 20 games in the NBA, 300 plays in the NFL. Under 50% a finding is labelled a small sample."],
  ["Offense and defense as one number", "A team's offense or defense percentile is the league percentile of its points measure, with the schedule taken out: points per 100 possessions in the NBA, points per drive in the NFL. It is not an average of every trait, because many traits (three-point volume, pace, blitz rate) describe how a team plays, not how well."],
  ["Which players", "Player ranks are within a position, among each team's regulars with at least half the team's games: its eight most-used players by minutes in the NBA; its top two backs, three receivers and two tight ends in the NFL. Three-point % also needs one attempt a game. Quarterbacks aren't covered yet. A rank such as \"3rd of 103 guards\" is among those players, on the teams with this season's numbers."],
  ["Order", "Findings are listed strongest first: the size of the gap, scaled down for a small sample, with a weight by kind (a mismatch counts most, form least)."],
  ["Records and results", "A team's record and result strip run through its latest breakdown, and say which date that is; a game's \"last 5\" is fetched when the page is built, so it can be a game ahead."],
  ["Usage rate (proxy)", "A player's share of his team's shot attempts, free-throw trips and turnovers while he plays, from box scores (play-by-play usage isn't collected)."],
];

function Slider({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span className="flex justify-between"><span>{label}</span><span className="tabular text-foreground">{ord(value)} of {max}</span></span>
      <input type="range" min={1} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--hot)]" />
    </label>
  );
}

export function ModelsView() {
  const of = 30;
  const [a, setA] = useState(4), [r, setR] = useState(26);
  const [raw, setRaw] = useState(6), [sos, setSos] = useState(27);
  const pa = 1 - (a - 1) / (of - 1), pr = 1 - (r - 1) / (of - 1);
  const edge = pa + (1 - pr) - 1;
  // An illustration of the direction of the adjustment only: a soft slate (high sos rank) pushes the rank down.
  const adj = Math.max(1, Math.min(of, Math.round(raw + ((sos - (of + 1) / 2) / of) * 10)));
  return (
    <main className="mx-auto grid max-w-7xl gap-12 px-4 py-6 sm:py-10">
      <PageHeader title="How it works" size="lg" eyebrow={<span>Method</span>}
        lede="Three ideas produce every page on this site: put each trait on a league scale, take the schedule out, and compare what one side does with what the other side allows." />

      <section className="grid gap-5 border-t pt-5 lg:grid-cols-2 lg:gap-10">
        <Reveal className="grid content-start gap-3">
          <span className="pl-display text-6xl text-[var(--hot)]">01</span>
          <h2 className="pl-display text-4xl">One scale for everything</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Points per drive, turnover rate and expected goals have nothing in common until each becomes a league rank. Every trait is turned into a percentile where 100 is the best team in the league <i>at that thing</i>, so a defense that allows few points is high, not low.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">Only games before the one being broken down are used. The sample behind each number (games or plays, shown as n) is in its chart&apos;s table view, beside the value as played and both ranks: as played, and with the schedule taken out.</p>
        </Reveal>
        <Reveal delay={0.1} className="pl-reading grid content-start gap-4 rounded-3xl border p-5">
          <h3 className="pl-label text-muted-foreground">Try it: the edge of one matchup</h3>
          <Slider label="Offense rank" value={a} onChange={setA} max={of} />
          <Slider label="Defense rank (at stopping it)" value={r} onChange={setR} max={of} />
          <Duel seen sides={SIDES} attackLabel="What the offense does" resistLabel="What the defense allows"
            attack={{ team: "ATK", rank: a, of, percentile: pa }} resist={{ team: "DEF", rank: r, of, percentile: pr }} />
          <p className="tabular rounded-xl bg-muted/60 p-3 text-sm">
            edge = offense percentile + (1 − defense percentile) − 1 = <b>{edge >= 0 ? "+" : "−"}{Math.abs(edge).toFixed(2)}</b>
            <span className="block text-xs text-muted-foreground">{Math.abs(edge) >= 0.45 ? `A mismatch: the ${edge > 0 ? "offense" : "defense"} should win this part of the game.` : "Not far enough apart to call a mismatch."}</span>
          </p>
        </Reveal>
      </section>

      <section className="grid gap-5 border-t pt-5 lg:grid-cols-2 lg:gap-10">
        <Reveal className="grid content-start gap-3">
          <span className="pl-display text-6xl text-[var(--hot)]">02</span>
          <h2 className="pl-display text-4xl">Take the schedule out</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">A team that has only played bad defenses will look like a good offense. For each trait we measure how far each opponent sits from league average on the mirror trait, average that over the opponents faced, and remove it. Then every team is ranked again.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">When the two ranks disagree, the site leads with the adjusted one, and the gap is a finding of its own.</p>
        </Reveal>
        <Reveal delay={0.1} className="pl-reading grid content-start gap-4 rounded-3xl border p-5">
          <h3 className="pl-label text-muted-foreground">Try it: a rank against its schedule</h3>
          <Slider label="Raw rank" value={raw} onChange={setRaw} max={of} />
          <Slider label="Schedule difficulty (1 = hardest)" value={sos} onChange={setSos} max={of} />
          <RankShift seen raw={raw} adj={adj} of={of} color={HOME.ink} />
          <p className="text-xs text-muted-foreground">This demo shows the direction only. The real adjustment uses each opponent&apos;s measured strength, not a rank.</p>
        </Reveal>
      </section>

      <section id="rules" className="grid scroll-mt-20 gap-5 border-t pt-5">
        <Reveal className="grid gap-3">
          <span className="pl-display text-6xl text-[var(--hot)]">03</span>
          <h2 className="pl-display text-4xl">Findings are rules, not opinions</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">No person and no language model writes the findings. Each one is a fixed rule over the board&apos;s numbers, so the same numbers always give the same sentence, and every rank in a sentence is a rank you can find on the page.</p>
        </Reveal>
        <dl className="grid gap-px overflow-hidden rounded-3xl border">
          {RULES.map(([k, v], i) => (
            <Reveal key={k} delay={Math.min(i, 6) * 0.03} className="grid gap-1 bg-card p-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
              <dt className="pl-label pt-0.5 text-[11px]">{k}</dt><dd className="text-sm leading-relaxed text-muted-foreground">{v}</dd>
            </Reveal>
          ))}
        </dl>
        <dl className="grid gap-px overflow-hidden rounded-3xl border">
          {NOTES.map(([k, v]) => (
            <div key={k} className="grid gap-1 bg-card p-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
              <dt className="pl-label pt-0.5 text-[11px]">{k}</dt><dd className="text-sm leading-relaxed text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <TrackRecordSection />

      <section className="grid gap-3 border-t pt-5">
        <h2 className="pl-display text-4xl">What this is not</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">It is not a forecast of record and not advice. A percentile says what a team has done, against whom; the simulation says what those rates imply when played out many times. Injuries, weather and a coach&apos;s plan are not in the numbers unless they have already shown up in the games.</p>
      </section>
      <Onward links={[{ href: "/games", label: "Today's games" }, { href: "/findings", label: "The sharpest findings" }, { href: "/sources", label: "Where the numbers come from" }]} />
    </main>
  );
}
