"use client";

// How the numbers are made, with the one formula a reader can play with. No data is loaded here.
import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Duel, RankShift } from "@/components/ebk/Charts";
import { Reveal } from "@/components/motion/Reveal";
import { ord } from "@/lib/ebk";
import { HOME } from "@/lib/site";

const SIDES = { home: "ATK", away: "DEF", names: { ATK: "Offense", DEF: "Defense" } };
const RULES = [
  ["Mismatch", "An attacking trait in the top third of the league meets the resisting trait in the bottom third (an edge of 0.45 or more) with enough sample behind both."],
  ["Schedule mirage", "A rank that drops once the strength of the opponents faced is taken out: the number was built against a soft slate."],
  ["Better than it looks", "The reverse: a middling rank earned against a hard slate, which rises after the adjustment."],
  ["The real thing", "A top-fifth or bottom-fifth rank that stays there after the adjustment."],
  ["Player edge", "A player ranked high at his position in a kind of production, against a defense ranked low at stopping exactly that."],
  ["Opposite ends", "The same trait, where the two teams sit at least 60 percentile points apart."],
  ["The whole board", "The count of matchups each side wins, over every matchup measured with a usable sample."],
  ["Form", "Scoring in the last three games against the season, read against the strength of those three opponents. Always flagged as a small sample."],
  ["Simulation", "For the NFL: the share of twenty thousand simulated games each side wins, and the middle 80% of the margin."],
];

function Slider({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span className="flex justify-between"><span>{label}</span><span className="tabular text-foreground">{ord(value)} of {max}</span></span>
      <input type="range" min={1} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--hot)]" />
    </label>
  );
}

export default function Models() {
  const of = 30;
  const [a, setA] = useState(4), [r, setR] = useState(26);
  const [raw, setRaw] = useState(6), [sos, setSos] = useState(27);
  const pa = 1 - (a - 1) / (of - 1), pr = 1 - (r - 1) / (of - 1);
  const edge = pa + (1 - pr) - 1;
  // An illustration of the direction of the adjustment only: a soft slate (high sos rank) pushes the rank down.
  const adj = Math.max(1, Math.min(of, Math.round(raw + ((sos - (of + 1) / 2) / of) * 10)));
  return (
    <main className="mx-auto grid max-w-5xl gap-12 px-4 py-6 sm:py-10">
      <PageHeader title="How it works" size="lg" eyebrow={<span>Method</span>}
        lede="Three ideas produce every page on this site: put each trait on a league scale, take the schedule out, and compare what one side does with what the other side allows." />

      <section className="grid gap-5 border-t pt-5 lg:grid-cols-2 lg:gap-10">
        <Reveal className="grid content-start gap-3">
          <span className="pl-display text-6xl text-[var(--hot)]">01</span>
          <h2 className="pl-display text-4xl">One scale for everything</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Points per drive, turnover rate and expected goals have nothing in common until each becomes a league rank. Every trait is turned into a percentile where 100 is the best team in the league <i>at that thing</i>, so a defense that allows few points is high, not low.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">Only games before the one being broken down are used, and the sample (plays, drives or games) is printed with every number.</p>
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
          <p className="text-sm leading-relaxed text-muted-foreground">When the two ranks disagree, the adjusted one is the better guide, and the gap is a finding of its own.</p>
        </Reveal>
        <Reveal delay={0.1} className="pl-reading grid content-start gap-4 rounded-3xl border p-5">
          <h3 className="pl-label text-muted-foreground">Try it: a rank against its schedule</h3>
          <Slider label="Raw rank" value={raw} onChange={setRaw} max={of} />
          <Slider label="Schedule difficulty (1 = hardest)" value={sos} onChange={setSos} max={of} />
          <RankShift seen raw={raw} adj={adj} of={of} color={HOME.ink} />
          <p className="text-xs text-muted-foreground">This demo shows the direction only. The real adjustment uses each opponent&apos;s measured strength, not a rank.</p>
        </Reveal>
      </section>

      <section className="grid gap-5 border-t pt-5">
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
      </section>

      <section className="grid gap-3 border-t pt-5">
        <h2 className="pl-display text-4xl">What this is not</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">It is not a forecast of record and not advice. A percentile says what a team has done, against whom; the simulation says what those rates imply when played out many times. Injuries, weather and a coach&apos;s plan are not in the numbers unless they have already shown up in the games.</p>
      </section>
    </main>
  );
}
