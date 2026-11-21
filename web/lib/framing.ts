// What a finding's card says, written by rule from the finding's own numbers: the stat it is about, a headline of its
// two numbers, one line on what they mean, and which chart shape fits it. One place, so the home deck, a game's tile,
// tonight's board and every other card say the same thing about the same finding. No "use client": the server uses it too.
import type { Insight } from "./ebk";
import { ord } from "./ordinal";

export type Teams = { home: { team: string; name?: string | null; carried?: boolean }; away: { team: string; name?: string | null; carried?: boolean } };
export type Num = Insight["numbers"][number];
export type Viz = { type?: string; raw_rank?: number; adj_rank?: number | null; of?: number; sos_rank?: number | null; team?: string; trait?: string;
  player?: string; player_id?: string; attack_team?: string; resist_team?: string };

/** Which picture a finding's numbers make: one stat moved by the schedule, one stat with both teams at opposite ends,
 *  a player against a defense, two different stats against each other, or none (a finding without league ranks). */
export type Shape = "shift" | "clash" | "player" | "pair" | "plain";
export type Frame = { shape: Shape; stat: string; trait?: string | null; headline: string; meaning: string };

export const vizOf = (i: Insight) => i.viz as Viz;
export const nameIn = (g: Teams, team?: string | null) => (team === g.home.team ? g.home.name || team : team === g.away.team ? g.away.name || team : team ?? "") as string;

function sched(rank?: number | null, of?: number | null) {
  if (!rank || !of || rank > of) return null;
  if (rank === 1) return "the hardest schedule";
  if (rank === of) return "the easiest schedule";
  return rank <= of / 2 ? `the ${ord(rank)}-hardest schedule` : `the ${ord(of - rank + 1)}-easiest schedule`;
}

const sentence = (s?: string | null) => (s ?? "").split(/(?<=[.!?])\s/)[0] ?? "";

/** What a card leads with. The lines describe what the ranks say ("on the numbers"); none promises a result.
 *  A finding without two league ranks (the simulation, the whole board, form) keeps its own
 *  title and first sentence: it is never forced into "Nth meets Nth". */
export function frame(i: Insight, g: Teams): Frame {
  const v = vizOf(i), [a, b] = i.numbers;
  if (v.type === "rank_shift" && v.raw_rank && v.of) {
    const adj = v.adj_rank ?? v.raw_rank, s = sched(v.sos_rank, v.of);
    return {
      shape: "shift", stat: `${nameIn(g, v.team)} · ${a?.label ?? ""}`, trait: v.trait ?? a?.trait,
      headline: adj === v.raw_rank ? `${ord(adj)}, schedule or not.` : `${ord(v.raw_rank)} as played. ${ord(adj)} without the schedule.`,
      meaning: i.kind === "real" ? `${ord(adj)} of ${v.of} whatever the schedule: a real ${adj <= v.of / 2 ? "strength" : "weakness"}.`
        : `They've faced ${s ?? "an unusual schedule"}. Against an average one they'd rank ${ord(adj)}, ${adj < v.raw_rank ? "higher" : "lower"} than it looks.`,
    };
  }
  if (!a?.rank || !b?.rank) return { shape: "plain", stat: i.title, trait: a?.trait ?? b?.trait, headline: i.title, meaning: sentence(i.claim) };
  if (v.type === "split") return { shape: "clash", stat: a.label ?? i.title, trait: a.trait, headline: `${ord(a.rank)} and ${ord(b.rank)}.`, meaning: `Same stat, opposite ends of the league: on the numbers, this part of the game is ${nameIn(g, a.team)}'s.` };
  if (v.player) return { shape: "player", stat: `${v.player} vs ${nameIn(g, b.team)}`, trait: a.trait, headline: `${ord(a.rank)} meets ${ord(b.rank)}.`, meaning: `${v.player} is the matchup to watch: few defenses rank lower at stopping what ${v.player.split(" ").at(-1)} does.` };
  return { shape: "pair", stat: i.title, trait: b.trait ?? a.trait, headline: `${ord(a.rank)} meets ${ord(b.rank)}.`, meaning: `On the numbers, ${nameIn(g, i.team)} have the edge in this part of the game.` };
}

/** One reason in a list: a line and the two numbers behind it. */
export function reason(i: Insight, g: Teams): { text: string; nums: string; trait?: string | null } {
  const v = vizOf(i), [a, b] = i.numbers;
  if (v.type === "rank_shift" && v.raw_rank) {
    const kind = i.kind === "mirage" ? "flattered by the schedule" : i.kind === "hidden" ? "better than it looks" : "the real thing";
    return { text: `${nameIn(g, v.team)} ${(a?.label ?? "").toLowerCase()}: ${kind}`, nums: `${ord(v.raw_rank)} → ${ord(v.adj_rank ?? v.raw_rank)}`, trait: v.trait ?? a?.trait };
  }
  return { text: i.title, nums: a?.rank && b?.rank ? `${ord(a.rank)} v ${ord(b.rank)}` : "", trait: i.numbers.at(-1)?.trait };
}

/** A player's edge against a defense (a board's or a player page's matchup row) dressed as a finding, so the same
 *  rank picture draws it: his rank at the position, the defense's rank at stopping it. */
export function playerEdge(e: { player_id: string; player: string; team: string; opponent: string; mechanism: string; label: string; confidence?: number;
  attack: { trait: string; value: number; rank?: number | null; of?: number | null; n: number };
  resist: { trait: string; value?: number | null; adj_value?: number | null; rank?: number | null; adj_rank?: number | null; of?: number | null; percentile?: number | null; adj_percentile?: number | null; n?: number | null } },
  labels: Record<string, string>): Insight {
  return {
    id: `${e.player_id}:${e.mechanism}:${e.opponent}`, kind: "star", title: e.label, claim: "", team: e.team, score: 0, strength: 0, confidence: e.confidence ?? 0, small_sample: false,
    numbers: [
      { label: labels[e.attack.trait] ?? e.label, team: e.team, value: e.attack.value, rank: e.attack.rank ?? null, of: e.attack.of ?? null, percentile: null, n: e.attack.n, trait: e.attack.trait },
      { label: labels[e.resist.trait] ?? "Defense", team: e.opponent, value: e.resist.adj_value ?? e.resist.value ?? null, rank: e.resist.adj_rank ?? e.resist.rank ?? null, of: e.resist.of ?? null,
        percentile: e.resist.adj_percentile ?? e.resist.percentile ?? null, n: e.resist.n ?? null, trait: e.resist.trait },
    ],
    viz: { type: "duel", player: e.player, player_id: e.player_id },
  } as Insight;
}

/** The two readings every game card shows, in one place so the card, the board row and PickLab's line say the same
 *  thing. They are different questions: the model plays the score out and gives a win share; the matchup count asks
 *  who is better in more parts of the game. `bar` is the count as a number from -1 (every matchup to the away side)
 *  to 1 (every one to the home side): what the card draws under its words, so the two can't point opposite ways.
 *  An API that doesn't send the count yet falls back to its weighted tilt, drawn only when it agrees with the words. */
export function readings(g: {
  home: { team: string; name: string; carried?: boolean }; away: { team: string; name: string; carried?: boolean };
  lean?: string | null; tilt: number; model?: { team: string; p: number; source: string } | null;
  agree?: boolean | null; matchups?: { home: number; away: number; of: number } | null;
}) {
  const name = (t?: string | null) => (t === g.home.team ? g.home.name : t === g.away.team ? g.away.name : null);
  const lean = name(g.lean), fav = name(g.model?.team), m = g.matchups;
  const tilt = Math.max(-1, Math.min(1, g.tilt));
  const bar = m?.of ? (m.home - m.away) / m.of : !g.lean ? 0 : (g.lean === g.home.team) === tilt > 0 ? tilt : 0;
  const differ = g.agree != null ? g.agree === false : !!g.model && !!g.lean && g.model.team !== g.lean;
  const counted = m?.of ? `${g.away.name} win ${m.away} and ${g.home.name} win ${m.home} of the ${m.of} matchups with a clear edge` : null;
  const old = [g.away, g.home].filter((t) => t.carried).map((t) => t.name);
  return {
    lean, fav, bar, differ, counted,
    leanText: lean ? `Matchups favour ${lean}` : "Matchups: an even board",
    modelFrom: g.model?.source === "sim" ? "Simulation" : "Score model",
    modelNote: g.model?.source === "sim" ? "The game simulated many times from each team's own rates" : "The site's score model: a spread of final scores from team ratings",
    differNote: fav && lean ? `Two separate readings. The ${g.model?.source === "sim" ? "simulation" : "score model"} plays the score out and makes ${fav} the favourite; the matchup count asks who is better in more parts of the game, each part weighing the same, and names ${lean}.` : "",
    oldText: old.length ? `${old.join(" and ")} on last season's numbers` : "",
  };
}

/** Soccer boards: why a match can have few or no findings, kept behind a data note. */
export const SOCCER_METHOD = {
  summary: "How soccer findings work",
  note: "Ranks use this competition's matches only. Schedule findings wait for eight matches, and a small sample lowers every finding's confidence. Soccer has no player matchups or match simulations.",
  none: "No findings meet the bar for this match yet.",
};

// ---- League pages (backlog I28 / I29) ------------------------------------------------------------------------------

/** The six parts of a soccer game the league page ranks by, in its picker's order. `match`: a match-level stat, read from
 *  each finished match's page, so a competition below the coverage bar leaves it out (its chip is shown locked). */
export const SOCCER_STATS: { id: string; label: string; line: string; match?: boolean }[] = [
  { id: "soccer.off.xg", label: "Chance creation", line: "Expected goals created per match" },
  { id: "soccer.def.xga", label: "Chance prevention", line: "Fewest expected goals allowed per match" },
  { id: "soccer.off.xg_set_piece", label: "Set pieces", line: "Expected goals from set plays", match: true },
  { id: "soccer.def.ppda_proxy", label: "Pressing", line: "Fewest opponent passes per defensive action", match: true },
  { id: "soccer.off.xg_fast_break", label: "Transitions", line: "Expected goals from fast breaks", match: true },
  { id: "soccer.off.finishing", label: "Finishing", line: "Goals scored against expected goals" },
];

export type BandKind = "europe" | "playoff" | "down" | "r16" | "kpo" | "out";
/** A stretch of a table and where it leads. `from` / `to` are places; a negative place counts from the bottom (-1 = last). */
export type Band = { kind: BandKind; from: number; to: number; label: string; short: string; what?: string };
const cl = (n: number): Band => ({ kind: "europe", from: 1, to: n, label: `Top ${n} · Champions League`, short: `Top ${n}: Champions League` });
const down = (n: number): Band => ({ kind: "down", from: -n, to: -1, label: `Bottom ${n} · relegation`, short: `Bottom ${n}: relegation` });
const playoff = (place: number): Band => ({ kind: "playoff", from: place, to: place, label: `${ord(place)} · relegation play-off`, short: `${ord(place)}: relegation play-off` });

/** Where each competition's table places lead. These hold the 2026/27 rules (Champions League places, relegation, the
 *  Bundesliga's and Ligue 1's 16th-place play-off, the Champions League's league-phase cut-offs): check them before each
 *  new season. */
export const BANDS: Record<string, Band[]> = {
  "eng.1": [cl(4), down(3)],
  "esp.1": [cl(4), down(3)],
  "ita.1": [cl(4), down(3)],
  "ger.1": [cl(4), playoff(16), down(2)],
  "fra.1": [cl(3), playoff(16), down(2)],
  "uefa.champions": [
    { kind: "r16", from: 1, to: 8, label: "Round of 16", short: "Top 8: round of 16", what: "Straight into the knockouts" },
    { kind: "kpo", from: 9, to: 24, label: "Knockout play-off", short: "9th–24th: knockout play-off", what: "Two legs for a round-of-16 place" },
    { kind: "out", from: 25, to: 36, label: "Out", short: "25th–36th: out", what: "Season in Europe over" },
  ],
};
/** Matches each club plays in the Champions League's league phase (2026/27 format). */
export const UCL_PHASE_MATCHES = 8;

const place = (p: number, of: number) => (p < 0 ? of + p + 1 : p);
/** The band a table place falls in, if any. */
export const bandOf = (competition: string | null | undefined, position: number | null | undefined, of: number) =>
  position == null ? null : (BANDS[competition ?? ""] ?? []).find((b) => position >= place(b.from, of) && position <= place(b.to, of)) ?? null;
/** "1–8", "18–20", "16th": a band's places in a table of `of`. */
export const bandRange = (b: Band, of: number) => (place(b.from, of) === place(b.to, of) ? ord(place(b.from, of)) : `${place(b.from, of)}–${place(b.to, of)}`);

/** What the league pages keep behind a data note. */
export const LEAGUE_NOTES = {
  soccer: (comp: string) => `Ranks use ${comp} matches only. With the schedule taken out, each club is rated as if its opponents were average; finishing and pressing have no schedule version, so they read as played. Pressing is a proxy: opponent passes in their own half per tackle, interception or foul. Form is the last five ${comp} results, newest on the right.`,
  locked: "Why some stats are locked",
  ucl: (available: number) => `The league phase is one table of 36. Places 1–8 go straight to the round of 16, 9–24 play a two-legged knockout play-off, 25–36 are out. One block per point, out of the ${available} available so far. A country tag means the club is in one of the five domestic tables on this site.`,
  club: "Each competition is its own league: a rank is among that competition's clubs only, so a club's two ranks for the same stat are against different fields.",
  cfb: "Every rank takes the schedule out except the as-played column. A conference's strength is its middle team's rank in net points per drive (points per drive scored minus allowed; with an even number of teams, the midpoint of the two middle ones); the bar runs from its best team to its worst, the tick marks the middle. Schedule: 1st = the hardest of the FBS. Games against lower-division (FCS) teams count in the record and are marked beside it.",
};
