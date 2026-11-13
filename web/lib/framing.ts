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
