"""Findings from one tactical board, by rule (no model, no AI): what a reader should notice first, and why.

Each rule reads the board's computed traits, matchup edges, schedule chains, player edges and simulation, and writes one
plain sentence with the numbers behind it and the chart that shows it. Nothing is estimated here: a number in a finding
is a number already on the board (rank, league size, sample), so a finding can be checked against the page it sits on.

Rules (thresholds are judgment calls, kept in one place below):
  mismatch   the widest percentile gap between an attacking trait and the trait that resists it
  mirage     a rank that falls once the schedule is taken out      (board chain "schedule_inflated")
  hidden     a rank that rises once the schedule is taken out      (board chain "schedule_hidden")
  real       an extreme rank that survives the schedule adjustment (board chain "schedule_confirmed")
  star       a player whose production rank meets a defense that is bad at stopping it
  clash      the same trait, where the two teams sit at opposite ends of the league
  balance    how many of the board's matchups each side wins
  form       the last three games against the season, read against who they were played against
  sim        the simulation's win share and the range of its margin (NFL)
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from schemas.tactics import InferenceChain, MatchupEdge, PlayerMatchupEdge, TacticalReport, TeamIdentity, TraitValue
from tactics.ontology import SPORTS, mechanisms, player_mechanisms, traits

Kind = Literal["mismatch", "mirage", "hidden", "real", "star", "clash", "balance", "form", "sim"]

MIN_EDGE = 0.45  # a mismatch worth leading with: about the top third against the bottom third
MIN_CONF = 0.4
STAR_EDGE = 0.5
CLASH_GAP = 0.6  # percentile gap on the same trait
SMALL_N = 0.5  # findings under this confidence are labelled a small sample
WEIGHT = {"mismatch": 1.0, "sim": 0.95, "mirage": 0.9, "hidden": 0.9, "star": 0.85, "balance": 0.8, "clash": 0.75,
          "real": 0.6, "form": 0.5}
CHAIN_KIND = {"schedule_inflated": "mirage", "schedule_hidden": "hidden", "schedule_confirmed": "real", "form": "form"}
ALWAYS = ("sim", "balance")
PER_KIND = {"mismatch": 3, "mirage": 2, "hidden": 2, "real": 2, "star": 3, "clash": 2, "balance": 1, "form": 2, "sim": 1}


class InsightNumber(BaseModel):
    label: str
    team: str | None = None
    value: float | None = None
    rank: int | None = None
    of: int | None = None
    percentile: float | None = None  # 0..1, 1 = best for that team
    n: int | None = None  # the sample behind it


class Insight(BaseModel):
    id: str
    kind: Kind
    team: str | None = None  # the side the finding is about ("both" never: None when it is about the game)
    title: str  # 3-7 words
    claim: str  # one plain sentence a reader can check against the numbers
    detail: str | None = None
    numbers: list[InsightNumber] = []
    viz: dict = {}  # {"type": "duel" | "rank_shift" | "balance" | "form" | "dist" | "split", ...} for the page's chart
    strength: float  # 0..1: how big the effect is
    confidence: float  # 0..1: the samples behind it
    small_sample: bool = False
    score: float = 0.0


def _ord(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


POSITIONS = {"G": "guards", "F": "forwards", "C": "centers", "WR": "receivers", "TE": "tight ends", "RB": "running backs",
             "QB": "quarterbacks"}


def _lc(label: str) -> str:
    """'Offensive rating' → 'offensive rating', but 'TE targets allowed' and 'Shooting (eFG%)' keep their capitals."""
    return " ".join(w if (w.isupper() and len(w) <= 3) or any(c.isupper() for c in w[1:]) else w.lower() for w in label.split())


def _sched(rank: int | None, of: int | None) -> str:
    """'the easiest schedule', 'the 3rd-hardest schedule': a rank of 28 of 30 in difficulty is said as the 3rd-easiest."""
    if not rank or not of:
        return ""
    if rank == 1:
        return "the hardest schedule"
    if rank == of:
        return "the easiest schedule"
    return f"the {_ord(rank)}-hardest schedule" if rank <= of / 2 else f"the {_ord(of - rank + 1)}-easiest schedule"


def _pct(tv: TraitValue | None) -> float | None:
    return None if tv is None else tv.adj_percentile if tv.adj_percentile is not None else tv.percentile


def _rank(tv: TraitValue) -> int | None:
    return tv.adj_rank or tv.rank


def _num(label: str, tv: TraitValue) -> InsightNumber:
    return InsightNumber(label=label, team=tv.team, value=tv.value, rank=_rank(tv), of=tv.of, percentile=_pct(tv), n=tv.n)


def _label(sport: str, trait_id: str) -> str:
    spec = traits(sport).get(trait_id) if sport in SPORTS else None
    return spec.label if spec else trait_id.rsplit(".", 1)[-1].replace("_", " ")


def _names(rep: TacticalReport) -> dict[str, str]:
    return {t.team: t.name or t.team for t in (rep.home, rep.away) if t}


def _mismatches(rep: TacticalReport, nm) -> list[Insight]:
    mechs, out = mechanisms(rep.sport), []
    for e in rep.matchups:
        a, r = e.attack, e.resist
        if a is None or r is None or _rank(a) is None or _rank(r) is None or abs(e.edge) < MIN_EDGE or e.confidence < MIN_CONF:
            continue
        win, lose = (e.attack_team, e.resist_team) if e.edge > 0 else (e.resist_team, e.attack_team)
        al, rl = _lc(_label(rep.sport, a.trait)), _lc(_label(rep.sport, r.trait))
        claim = (f"{nm(e.attack_team)} rank {_ord(_rank(a))} of {a.of} in {al}; {nm(e.resist_team)} rank {_ord(_rank(r))} "
                 f"of {r.of} in {rl}. {nm(win)} should win this part of the game.")
        mech = mechs.get(e.mechanism)
        out.append(Insight(
            id=f"mismatch:{e.mechanism}:{e.attack_team}", kind="mismatch", team=win, title=f"{e.label}: {nm(win)}",
            claim=claim, detail=mech.description if mech else None,
            numbers=[_num(_label(rep.sport, a.trait), a), _num(_label(rep.sport, r.trait), r)],
            viz={"type": "duel", "mechanism": e.mechanism, "scene": e.scene, "attack_team": e.attack_team,
                 "resist_team": e.resist_team, "edge": e.edge, "loser": lose},
            strength=round(min(1.0, abs(e.edge)), 2), confidence=e.confidence))
    return out


def _from_chain(rep: TacticalReport, c: InferenceChain, nm) -> Insight | None:
    kind = CHAIN_KIND.get(c.kind)
    if kind is None:
        return None
    if kind == "form":
        team = rep.home if rep.home and rep.home.team == c.team else rep.away
        last = [o for o in (team.opponents if team else []) if o.result][-5:]
        return Insight(id=f"form:{c.team}", kind="form", team=c.team, title=c.title,
                       claim=f"{c.steps[0].text}. {c.conclusion}", detail=c.steps[1].text if len(c.steps) > 1 else None,
                       numbers=[InsightNumber(label="Last 3 scoring", team=c.team, value=c.steps[0].value, n=c.steps[0].n)],
                       viz={"type": "form", "team": c.team, "games": [o.model_dump(mode="json") for o in last]},
                       strength=c.strength, confidence=c.confidence)
    raw, sched, adj = (c.steps + [None, None, None])[:3]
    if raw is None or raw.trait is None:
        return None
    tv = _find(rep, c.team, raw.trait)
    label = _label(rep.sport, raw.trait)
    to = adj.rank if adj is not None and adj.rank is not None else raw.rank
    slate = _sched(sched.rank if sched else None, raw.of)
    if kind == "real":  # the rank that survives the adjustment leads; the raw one is the aside
        claim = (f"{nm(c.team)} rank {_ord(to)} of {raw.of} in {_lc(label)} with the schedule taken out"
                 + (f" ({_ord(raw.rank)} before)" if to != raw.rank else "") + (f", against {slate}." if slate else "."))
    else:  # mirage / hidden: the move between the two ranks is the finding, so both are named
        claim = (f"{nm(c.team)} rank {_ord(raw.rank)} of {raw.of} in {_lc(label)} on raw numbers"
                 + (f", built against {slate}" if slate else "") + f". With the schedule taken out they rank {_ord(to)}.")
    verdict = c.title.rsplit(": ", 1)[-1] if ": " in c.title else {"mirage": "flattered by the schedule", "hidden": "better than it looks"}.get(kind, "the real thing")
    return Insight(
        id=f"{kind}:{raw.trait}:{c.team}", kind=kind, team=c.team, title=f"{nm(c.team)} {_lc(label)}: {verdict}", claim=claim, detail=c.conclusion,
        numbers=[InsightNumber(label=label, team=c.team, value=raw.value, rank=to if kind == "real" else raw.rank, of=raw.of, n=raw.n,
                               percentile=tv.percentile if tv else None)],
        viz={"type": "rank_shift", "team": c.team, "trait": raw.trait, "raw_rank": raw.rank,
             "adj_rank": adj.rank if adj else None, "of": raw.of, "sos_rank": sched.rank if sched else None},
        strength=c.strength, confidence=c.confidence)


def _find(rep: TacticalReport, team: str, trait_id: str) -> TraitValue | None:
    t = rep.home if rep.home and rep.home.team == team else rep.away
    return next((x for x in (t.traits if t else []) if x.trait == trait_id), None)


def _stars(rep: TacticalReport, nm) -> list[Insight]:
    mechs, out, seen = player_mechanisms(rep.sport), [], set()
    for e in sorted(rep.player_matchups, key=lambda x: -x.edge * x.confidence):
        if e.edge < STAR_EDGE or e.confidence < MIN_CONF or e.player_id in seen or e.attack.rank is None or e.resist.rank is None:
            continue
        seen.add(e.player_id)
        al, rl = _lc(_label(rep.sport, e.attack.trait)), _lc(_label(rep.sport, e.resist.trait))
        mech = mechs.get(e.mechanism)
        out.append(Insight(
            id=f"star:{e.player_id}:{e.mechanism}", kind="star", team=e.team, title=f"{e.player} vs {nm(e.opponent)}",
            claim=(f"{e.player} ranks {_ord(e.attack.rank)} of {e.attack.of} {POSITIONS.get(e.position, e.position + 's')} in {al}; {nm(e.opponent)} rank "
                   f"{_ord(_rank(e.resist))} of {e.resist.of} in {rl}."),
            detail=mech.description if mech else None,
            numbers=[InsightNumber(label=_label(rep.sport, e.attack.trait), team=e.team, value=e.attack.value,
                                   rank=e.attack.rank, of=e.attack.of, n=e.attack.n), _num(_label(rep.sport, e.resist.trait), e.resist)],
            viz={"type": "duel", "mechanism": e.mechanism, "player_id": e.player_id, "player": e.player,
                 "attack_team": e.team, "resist_team": e.opponent, "edge": e.edge},
            strength=round(min(1.0, e.edge), 2), confidence=e.confidence))
    return out


def _clashes(rep: TacticalReport, nm) -> list[Insight]:
    if not rep.home or not rep.away:
        return []
    away = {t.trait: t for t in rep.away.traits}
    out = []
    for h in rep.home.traits:
        a = away.get(h.trait)
        if a is None or h.percentile is None or a.percentile is None or h.rank is None or a.rank is None:
            continue
        gap = h.percentile - a.percentile
        if abs(gap) < CLASH_GAP:
            continue
        hi, lo = (h, a) if gap > 0 else (a, h)
        label = _label(rep.sport, h.trait)
        out.append(Insight(
            id=f"clash:{h.trait}", kind="clash", team=hi.team, title=f"Opposite ends: {_lc(label)}",
            claim=f"{nm(hi.team)} rank {_ord(_rank(hi))} of {hi.of} in {_lc(label)}; {nm(lo.team)} rank {_ord(_rank(lo))}.",
            numbers=[_num(label, hi), _num(label, lo)],
            viz={"type": "split", "trait": h.trait, "high": hi.team, "low": lo.team},
            strength=round(min(1.0, abs(gap)), 2), confidence=min(1.0, (min(h.n or 0, a.n or 0)) / 8) if rep.sport != "nfl" else 0.8))
    return out


def _balance(rep: TacticalReport, nm) -> list[Insight]:
    edges = [e for e in rep.matchups if e.confidence >= 0.3 and abs(e.edge) >= 0.1]
    if len(edges) < 4 or not rep.home or not rep.away:
        return []
    h, a = rep.home.team, rep.away.team
    wins = {h: 0, a: 0}
    for e in edges:
        wins[e.attack_team if e.edge > 0 else e.resist_team] += 1
    lead, trail = (h, a) if wins[h] >= wins[a] else (a, h)
    share = wins[lead] / len(edges)
    close = len(rep.matchups) - len(edges)
    rest = ("" if close <= 0 else " One more is too close, or rests on too small a sample, to call." if close == 1
            else f" The other {close} are too close, or rest on too small a sample, to call.")
    if share < 0.6:
        title = "An even board"
        claim = f"{nm(h)} win {wins[h]} and {nm(a)} win {wins[a]} of the {len(edges)} matchups with a clear edge.{rest}"
    else:
        title = f"{nm(lead)} win most matchups"
        claim = f"{nm(lead)} win {wins[lead]} of the {len(edges)} matchups with a clear edge; {nm(trail)} win {wins[trail]}.{rest}"
    conf = sum(e.confidence for e in edges) / len(edges)
    return [Insight(id="balance", kind="balance", team=lead if share >= 0.6 else None, title=title, claim=claim,
                    numbers=[InsightNumber(label="Matchups won", team=t, value=wins[t], of=len(edges)) for t in (h, a)],
                    viz={"type": "balance", "home": h, "away": a, "home_wins": wins[h], "away_wins": wins[a], "of": len(edges)},
                    strength=round(abs(share - 0.5) * 2, 2), confidence=round(conf, 2))]


def _sim(rep: TacticalReport, nm) -> list[Insight]:
    s = rep.simulation or {}
    hw, q = s.get("home_win"), s.get("margin_p10_p50_p90")
    if hw is None or not q or len(q) != 3 or not rep.home or not rep.away:
        return []
    fav, p = (rep.home.team, hw) if hw >= 0.5 else (rep.away.team, 1 - hw)
    lo, mid, hi = (q if hw >= 0.5 else [-q[2], -q[1], -q[0]])
    return [Insight(
        id="sim", kind="sim", team=fav, title=f"{nm(fav)} win {round(p * 100)}% of simulations",
        claim=(f"In {s.get('n_sims', 0):,} simulated games {nm(fav)} win {round(p * 100)}%, by {abs(round(mid))} in the middle "
               f"game; one in ten ends {'worse than a ' + str(abs(round(lo))) + '-point loss' if lo < 0 else 'closer than ' + str(round(lo))}."),
        detail="A drive-by-drive simulation from each team's own scoring rates. Model inference, not a prediction of record.",
        numbers=[InsightNumber(label="Win share", team=fav, value=round(p, 3)),
                 InsightNumber(label="Median margin", team=fav, value=round(mid, 1))],
        viz={"type": "dist", "favourite": fav, "p10": lo, "p50": mid, "p90": hi},
        strength=round(abs(p - 0.5) * 2, 2), confidence=0.7)]


def insights(rep: TacticalReport, limit: int = 10) -> list[Insight]:
    """The board's findings, strongest first, at most a few per rule so one lopsided game doesn't read as one idea."""
    if rep.status != "ready" or not rep.home or not rep.away:
        return []
    names = _names(rep)
    nm = lambda t: names.get(t, t)  # noqa: E731
    found = _mismatches(rep, nm) + _stars(rep, nm) + _clashes(rep, nm) + _balance(rep, nm) + _sim(rep, nm)
    found += [x for x in (_from_chain(rep, c, nm) for c in rep.inferences) if x]
    for f in found:
        f.small_sample = f.confidence < SMALL_N
        f.score = round(WEIGHT[f.kind] * f.strength * (0.4 + 0.6 * f.confidence), 4)
    found.sort(key=lambda f: (-f.score, f.id))
    out, per, seen = [], {}, set()
    lead = [next((f for f in found if f.kind == k), None) for k in ALWAYS]  # the game-level reads are always on the page
    for f in [x for x in lead if x] + found:
        trait = f.viz.get("trait") or f.viz.get("mechanism")
        if f in out or per.get(f.kind, 0) >= PER_KIND[f.kind] or (trait and (trait, f.team) in seen):
            continue
        per[f.kind] = per.get(f.kind, 0) + 1
        seen.add((trait, f.team))
        out.append(f)
    return sorted(out[:limit], key=lambda f: (-f.score, f.id))
