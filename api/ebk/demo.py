"""Build a site database of made-up data: `python -m ebk.demo --out site.db` from api/.

Every team, player, analyst, outlet and number here is invented (seeded, so a rebuild is identical). The shapes are the
real ones: traits ranked within a league, schedule-adjusted ranks, matchup edges from the vocabulary's mechanisms, the
deterministic chains, a simulated margin, and the PickLab documents. It exists so the site runs end to end from a
clean checkout and so the tests have something to read.
"""
from __future__ import annotations

import argparse
import math
import random
import zlib
from datetime import UTC, datetime, timedelta
from pathlib import Path

from ebk import store
from ebk.game_extras import public_history, public_tree
from ebk.schemas import (PickRecord, PickRecords, PublicFeed, PublicGame, PublicPick, PublicPolicyRow, PublicSource,
                         PublicSources, PublicStrategy, PublicStrategyPick, StrategyStats)
from schemas.tactics import (InferenceChain, InferenceStep, MatchupEdge, OpponentFaced, PlayerMatchupEdge, PlayerTraitValue,
                             Source, TacticalReport, TeamIdentity, TraitValue)
from tactics.ontology import mechanisms, player_mechanisms, traits

PLACES = ["Harbor City", "Red Mesa", "Pinewood", "Lake Arden", "Iron Valley", "Cedar Falls", "Port Varga", "Sunridge",
          "Northgate", "Old Quarry", "Marlow", "Saltwater", "High Plains", "Brightwater", "Stonebridge", "Calder"]
CODES = ["HBC", "RMS", "PNW", "LKA", "IRV", "CDF", "PVG", "SNR", "NGT", "OQY", "MRL", "SLT", "HPL", "BRW", "STB", "CLD"]
MASCOTS = ["Gulls", "Foxes", "Comets", "Miners", "Herons", "Rams", "Lynx", "Pilots", "Owls", "Stags", "Kites", "Bison",
           "Otters", "Hawks", "Wolves", "Larks"]
FIRST = ["Theo", "Marcus", "Ilya", "Dev", "Jonah", "Rafa", "Kofi", "Anders", "Mateo", "Silas", "Omar", "Felix"]
LAST = ["Vance", "Okafor", "Lindqvist", "Reyes", "Hale", "Moreau", "Tanaka", "Whitlock", "Baptiste", "Novak", "Imani", "Crane"]
OUTLETS = [("baseline", "The Baseline Report"), ("touchline", "Touchline Notes"), ("fourthshort", "Fourth & Short")]
ANALYSTS = ["R. Calloway", "M. Estrada", "J. Whitfield", "P. Okonjo", "S. Lindgren", "D. Marchetti"]
SIZE = {"nba": 12, "nfl": 12, "soccer": 10}
GAMES = {"nba": 12, "nfl": 9, "soccer": 10}  # games already played by each team
BASE = {"rate": (0.42, 0.06), "share": (0.36, 0.05), "share %": (22, 4), "pts/100": (113, 4), "pts/game": (38, 6),
        "poss/game": (99, 3), "per 100": (36, 4), "per 36": (6, 2), "EPA/play": (0.0, 0.09), "yards": (112, 28),
        "points": (22, 4), "count": (2.4, 0.6), "days": (7, 1), "xG/match": (1.4, 0.35), "xG/90": (1.4, 0.35),
        "goals/match": (1.4, 0.4), "passes/action": (11, 2.5)}
SITE = "Demo league data (invented)"


def _stable(*parts: str) -> int:
    """A number from text that is the same on every run (the built-in hash is salted per process)."""
    return zlib.crc32("|".join(parts).encode())


def _ord(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def _ranks(scores: dict[str, float], good_high: bool) -> dict[str, tuple[int, float]]:
    order = sorted(scores, key=lambda t: scores[t], reverse=good_high)
    n = len(order)
    return {t: (i + 1, round(1 - i / max(1, n - 1), 3)) for i, t in enumerate(order)}


def _league(sport: str, rng: random.Random):
    """Teams, their trait values with raw and schedule-adjusted ranks, and each team's overall strength."""
    n = SIZE[sport]
    names = [f"{PLACES[i]} {MASCOTS[(i * 5 + len(sport)) % len(MASCOTS)]}" for i in range(n)]
    codes = [f"soc:{9000 + i}" if sport == "soccer" else CODES[i] for i in range(n)]
    quality = {c: rng.gauss(0, 1) for c in codes}
    sos = {c: rng.random() for c in codes}  # 1 = hardest slate
    sos_rank = {c: r for c, (r, _) in _ranks(sos, True).items()}
    src = Source(kind="stat", site=SITE, ref=f"{SITE}, {GAMES[sport]} games each")
    values: dict[str, list[TraitValue]] = {c: [] for c in codes}
    for spec in traits(sport).values():
        if not spec.stat or spec.unit == "player" or spec.measure in ("text", "flag"):
            continue
        mean, sd = BASE.get(spec.measure, (0.5, 0.1))
        sign = 1 if spec.good_high else -1
        raw = {c: mean + sign * sd * (0.55 * quality[c] + 0.85 * rng.gauss(0, 1)) for c in codes}
        adj = {c: raw[c] - sign * sd * 0.9 * (0.5 - sos[c]) for c in codes}  # a soft slate flatters, a hard one hides
        r, a = _ranks(raw, spec.good_high), _ranks(adj, spec.good_high)
        for c in codes:
            values[c].append(TraitValue(trait=spec.id, team=c, value=round(raw[c], 4), rank=r[c][0], of=n, percentile=r[c][1],
                                        n=GAMES[sport] * (30 if sport == "nfl" else 1), sources=[src], adj_value=round(adj[c], 4),
                                        adj_rank=a[c][0], adj_percentile=a[c][1], sos=round(sos[c], 3), sos_rank=sos_rank[c]))
    strength = _ranks(quality, True)
    return dict(zip(codes, names, strict=True)), values, strength


def _schedule(team: str, names: dict[str, str], strength, sport: str, now: datetime, rng: random.Random) -> list[OpponentFaced]:
    out, others = [], [c for c in names if c != team]
    top = {"nba": 112, "nfl": 23, "soccer": 1.5}[sport]
    for i in range(GAMES[sport]):
        opp = others[(i * 3 + rng.randrange(len(others))) % len(others)]
        gap = strength[team][1] - strength[opp][1]
        mine = max(0, round(rng.gauss(top * (1 + 0.12 * gap), top * (0.12 if sport != "soccer" else 0.7))))
        theirs = max(0, round(rng.gauss(top * (1 - 0.12 * gap), top * (0.12 if sport != "soccer" else 0.7))))
        if sport != "soccer" and mine == theirs:
            mine += 1
        out.append(OpponentFaced(opponent=opp, name=names[opp] if sport == "soccer" else None, home=i % 2 == 0,
                                 date=now - timedelta(days=(GAMES[sport] - i) * (7 if sport != "nba" else 2)),
                                 score=f"{mine}-{theirs}", result="W" if mine > theirs else "L" if mine < theirs else "D",
                                 strength=strength[opp][1], rank=strength[opp][0]))
    return out


def _players(sport: str, team: str, rng: random.Random) -> list[PlayerTraitValue]:
    out, seen = [], set()
    src = Source(kind="stat", site=SITE, ref=f"{SITE}, players with at least half their team's games")
    pool = {"nba": 60, "nfl": 48}.get(sport, 0)
    for mech in player_mechanisms(sport).values():
        pos = mech.position or ("G" if sport == "nba" else "WR")
        if (pos, mech.attack) in seen:
            continue
        seen.add((pos, mech.attack))
        name = f"{FIRST[rng.randrange(len(FIRST))]} {LAST[rng.randrange(len(LAST))]}"
        pid = f"{sport}:{'p' if sport == 'nba' else '00-'}{_stable(team, pos) % 9_000_000 + 1_000_000}"
        mean, sd = BASE.get(traits(sport)[mech.attack].measure, (50, 15))
        rank = rng.randint(1, pool)
        out.append(PlayerTraitValue(player_id=pid, name=name, team=team, position=pos, trait=mech.attack,
                                    value=round(mean + sd * (1.6 - 3.2 * rank / pool), 2), rank=rank, of=pool, n=GAMES[sport] - 1,
                                    sources=[src]))
    # one identity per player id: the same position shares a name across traits
    by = {}
    for p in out:
        first = by.setdefault(p.player_id, p)
        p.name = first.name
    return out


def _pct(tv: TraitValue) -> float:
    return tv.adj_percentile if tv.adj_percentile is not None else tv.percentile


def _board(sport: str, home: str, away: str, names, values, strength, start: datetime, now: datetime, rng: random.Random) -> TacticalReport:
    by = {t: {v.trait: v for v in values[t]} for t in (home, away)}
    nm = (lambda t: names[t]) if sport == "soccer" else (lambda t: names[t].split()[-1])
    edges = []
    for mech in mechanisms(sport).values():
        for atk, res in ((home, away), (away, home)):
            a, r = by[atk].get(mech.attack), by[res].get(mech.resist)
            if a is None or r is None:
                continue
            edge = round(_pct(a) + (1 - _pct(r)) - 1, 3)
            edges.append(MatchupEdge(mechanism=mech.id, label=mech.label, attack_team=atk, resist_team=res, attack=a, resist=r,
                                     edge=edge, confidence=round(rng.uniform(0.6, 1.0), 2), scene=mech.scene,
                                     summary=f"{nm(atk)} {_ord(a.adj_rank)} of {a.of} vs {nm(res)} {_ord(r.adj_rank)}: edge "
                                             f"{nm(atk) if edge >= 0 else nm(res)} ({edge:+.2f})"))
    chains = []
    for t in (home, away):
        for v in values[t]:
            spec = traits(sport)[v.trait]
            steps = [InferenceStep(text=f"{nm(t)} {spec.label.lower()}: {_ord(v.rank)} of {v.of}", trait=v.trait, team=t,
                                   value=v.value, rank=v.rank, of=v.of, n=v.n, source=v.sources[0]),
                     InferenceStep(text=f"Schedule for this: {_ord(v.sos_rank)}-hardest of {v.of}", trait=v.trait, team=t,
                                   rank=v.sos_rank, of=v.of, n=v.n, source=v.sources[0]),
                     InferenceStep(text=f"Adjusted for opponents faced: {_ord(v.adj_rank)} of {v.of}", trait=v.trait, team=t,
                                   rank=v.adj_rank, of=v.of, n=v.n, source=v.sources[0])]
            shift = v.adj_rank - v.rank
            if shift >= 3 and v.rank <= v.of // 3:
                chains.append(InferenceChain(kind="schedule_inflated", team=t, steps=steps, strength=min(1.0, shift / 6), confidence=0.8,
                                             title=f"{nm(t)} {spec.label.lower()}: flattered by the schedule",
                                             conclusion="Built against a soft slate: expect less against an average one."))
            elif shift <= -3 and v.adj_rank <= v.of // 2:
                chains.append(InferenceChain(kind="schedule_hidden", team=t, steps=steps, strength=min(1.0, -shift / 6), confidence=0.8,
                                             title=f"{nm(t)} {spec.label.lower()}: better than it looks",
                                             conclusion="Earned against a hard slate: the raw rank undersells it."))
    chains.sort(key=lambda c: -c.strength)
    players = {t: _players(sport, t, rng) for t in (home, away)}
    pedges = []
    for mech in player_mechanisms(sport).values():
        for atk, res in ((home, away), (away, home)):
            r = by[res].get(mech.resist)
            p = next((x for x in players[atk] if x.trait == mech.attack and (mech.position is None or x.position == mech.position)), None)
            if p is None or r is None:
                continue
            edge = round((1 - (p.rank - 1) / max(1, p.of - 1)) + (1 - _pct(r)) - 1, 3)
            pedges.append(PlayerMatchupEdge(mechanism=mech.id, label=mech.label, player_id=p.player_id, player=p.name, position=p.position,
                                            team=atk, opponent=res, attack=p, resist=r, edge=edge, confidence=round(rng.uniform(0.6, 1.0), 2),
                                            summary=f"{p.name} {_ord(p.rank)} of {p.of} vs {nm(res)} {_ord(r.adj_rank)} of {r.of}"))
    sim = None
    if sport == "nfl":
        mu = 2.2 + 9 * (strength[home][1] - strength[away][1])
        dist = {x: math.exp(-((x - mu) ** 2) / (2 * 13.5 ** 2)) for x in range(-45, 46)}
        total = sum(dist.values())
        dist = {x: p / total for x, p in dist.items()}
        home_win = sum(p for x, p in dist.items() if x > 0) + 0.5 * dist[0]
        sim = {"model": "demo-drive-sim", "label": "Model inference: drive simulation", "n_sims": 20000, "home": home, "away": away,
               "home_win": round(home_win, 4), "exp_margin": round(mu, 2), "exp_total": 44.5, "home_pts": round(22.25 + mu / 2, 1),
               "away_pts": round(22.25 - mu / 2, 1), "margin_p10_p50_p90": [round(mu - 17.3), round(mu), round(mu + 17.3)],
               "margin_dist": [[x, round(p, 5)] for x, p in dist.items()], "total_dist": []}
    ident = lambda t: TeamIdentity(team=t, name=names[t] if sport == "soccer" else names[t].split()[-1], traits=values[t],  # noqa: E731
                                   opponents=_schedule(t, names, strength, sport, now, rng), players=players[t])
    eid = (f"nba:{start:%Y%m%d}.9{_stable(home, away) % 100000:05d}" if sport == "nba" else
           f"nfl:2026_10_{away}_{home}" if sport == "nfl" else f"soc:{_stable(home, away) % 9_000_000 + 1_000_000}")
    label = f"{names[home]} v {names[away]}" if sport == "soccer" else f"{away} @ {home}"
    return TacticalReport(event_id=eid, sport=sport, created_at=now, status="ready", start=start, label=label, home=ident(home),
                          away=ident(away), matchups=edges, inferences=chains[:8], player_matchups=pedges, simulation=sim,
                          notes=["Demo data: every team, player and number on this page is invented."])


def _extras(db, rep: TacticalReport, start: datetime, strength, rng: random.Random) -> None:
    """A made-up head-to-head history and game-state tree for one NBA or NFL game."""
    h, a = rep.home.team, rep.away.team
    top = 112 if rep.sport == "nba" else 23
    meetings, record = [], {h: 0, a: 0}
    for k in range(4):
        when = start - timedelta(days=120 * (k + 1))
        home, away = (h, a) if k % 2 == 0 else (a, h)
        sh, sa = round(rng.gauss(top * 1.03, top * 0.1)), round(rng.gauss(top, top * 0.1))
        sa += sh == sa
        win = home if sh > sa else away
        record[win] += 1
        meetings.append({"event_id": f"{rep.sport}:demo-{_stable(h, a, str(k)) % 10**8}", "date": f"{when:%Y%m%d}", "start": when, "season": when.year,
                         "season_type": "regular", "home": home, "away": away, "scores": {home: sh, away: sa}, "winner": win, "source": SITE})
    form = {t.team: [{"event_id": f"{rep.sport}:demo-{_stable(t.team, str(i)) % 10**8}", "date": f"{g.date:%Y%m%d}", "start": g.date, "opponent": g.opponent,
                      "home": bool(g.home), "pts_for": int(g.score.split("-")[0]), "pts_against": int(g.score.split("-")[1]),
                      "result": "T" if g.result == "D" else g.result, "source": SITE} for i, g in enumerate(reversed(t.opponents[-5:]))]
            for t in (rep.home, rep.away)}
    doc = public_history({"event_id": rep.event_id, "sport": rep.sport, "home": h, "away": a, "before": start, "meetings": meetings, "form": form, "record": record})
    if doc:
        store.put_doc(db, f"history:{rep.event_id}", doc)
    p_home = (rep.simulation or {}).get("home_win") or min(0.85, max(0.15, 0.5 + 0.35 * (strength[h][1] - strength[a][1])))
    levels = [{"level": 0, "key": "winner", "label": "Who controls the script"}, {"level": 1, "key": "half", "label": "Half-time leader"},
              {"level": 2, "key": "margin", "label": "Final margin"}]
    nodes = []
    for side, team, p in (("home", h, p_home), ("away", a, 1 - p_home)):
        root = f"w:{side}"
        nodes.append({"id": root, "level": 0, "label": f"{team} win", "p": round(p, 4), "p_cond": round(p, 4), "source": "model", "n": 20000})
        for lead, who, share in (("home", h, 0.72 if side == "home" else 0.2), ("level", None, 0.06), ("away", a, 0.22 if side == "home" else 0.74)):
            hid = f"{root}/h:{lead}"
            nodes.append({"id": hid, "level": 1, "parent": root, "label": f"{who} lead at half" if who else "Level at half", "p": round(p * share, 4),
                          "p_cond": share, "source": "fit", "n": 400})
            big = 0.62 if lead == side else 0.3
            for key, label, sh in ((f"m:{side}10", f"{team} by 10+", big), (f"m:{side}1", f"{team} by 1–9", 1 - big)):
                nodes.append({"id": f"{hid}/{key}", "level": 2, "parent": hid, "label": label, "p": round(p * share * sh, 4), "p_cond": sh,
                              "source": "model", "n": 20000})
    tree = public_tree({"event_id": rep.event_id, "sport": rep.sport, "home": h, "away": a, "levels": levels, "nodes": nodes, "made_at": rep.created_at,
                        "sources": [{"id": "model", "label": "Demo simulation", "detail": "Invented numbers in the real shape.", "n": 20000},
                                    {"id": "fit", "label": "Half-time leader given the final margin", "detail": "Invented numbers in the real shape.", "n": 400}]})
    if tree:
        store.put_doc(db, f"tree:{rep.event_id}", tree)


def _record(key: str, label: str, site_id: str | None, rng: random.Random, n: int) -> PickRecord:
    won = sum(rng.random() < 0.53 for _ in range(n))
    push = rng.randint(0, max(1, n // 20))
    lost = n - won - push
    units = round(won * 0.91 - lost, 2)
    return PickRecord(key=key, label=label, site_id=site_id, picks=n, won=won, lost=lost, push=push,
                      hit_pct=round(won / max(1, won + lost), 3), priced=n, units=units, roi=round(units / n, 3), pending=rng.randint(0, 4))


def _picklab(db, boards: list[tuple[TacticalReport, datetime]], now: datetime, rng: random.Random) -> None:
    games = []
    for rep, start in boards:
        h, a = rep.home.name or rep.home.team, rep.away.name or rep.away.team
        picks = []
        for k in range(rng.randint(1, 3)):
            sid, site = OUTLETS[(k + len(games)) % len(OUTLETS)]
            line = rng.choice([-6.5, -3.5, -2.5, 1.5, 3.5, 5.5])
            side = rng.choice([h, a])
            picks.append(PublicPick(text=f"{side} {line:+g}", market=f"{rep.sport}_spread", market_label="Spread", side=side, line=line,
                                    odds=-110, experts=1, sources=[PublicSource(
                                        site=site, site_id=sid, author=ANALYSTS[(k * 2 + len(games)) % len(ANALYSTS)],
                                        title=f"{a} at {h}: three things the numbers say", url=f"https://example.com/{sid}/{len(games)}-{k}",
                                        published_at=now - timedelta(hours=6 + k))]))
        games.append(PublicGame(event_id=rep.event_id, sport=rep.sport, label=rep.label or f"{a} @ {h}", away=a, home=h, start=start, picks=picks))
    feed = PublicFeed(generated_at=now, since=now - timedelta(days=1), games=sorted(games, key=lambda g: g.start), sites=[s for _, s in OUTLETS],
                      method="Demo data: the outlets, analysts and picks are invented. On a real build each pick is a fact read "
                             "from a free article, with a link to it, graded from the final score.")
    store.put_doc(db, "picks", feed.model_dump(mode="json"))
    for days in (7, 30, 90):
        n = max(6, days // 2)
        recs = PickRecords(since=now - timedelta(days=days),
                           sites=[_record(sid, site, sid, rng, n * 2) for sid, site in OUTLETS],
                           experts=[_record(f"{OUTLETS[i % 3][0]}|{nm}", nm, OUTLETS[i % 3][0], rng, n + i) for i, nm in enumerate(ANALYSTS)],
                           markets=[_record(m, m.title(), None, rng, n * 3) for m in ("spread", "total", "moneyline")],
                           method="Demo data. A bet counts once per outlet and once per analyst; units are 1 unit at the listed price.")
        store.put_doc(db, f"records:all:{days}", recs.model_dump(mode="json"))
    strategies = []
    for sid, name, desc in (("control_favorite", "Control: biggest favourite", "A baseline: the biggest favourite on the board, every day."),
                            ("model_edge", "Model edge", "The side the board's matchups favour most, when the price allows.")):
        units, curve, picks = 0.0, [], []
        for d in range(24, 0, -1):
            won = rng.random() < 0.54
            units += 0.91 if won else -1
            curve.append({"date": f"{now - timedelta(days=d):%Y-%m-%d}", "units": round(units, 2), "clv": round(rng.gauss(0.5, 1.5), 2)})
            rep, start = boards[d % len(boards)]
            picks.append(PublicStrategyPick(run_date=curve[-1]["date"], selected_at=now - timedelta(days=d, hours=5), sport=rep.sport,
                                            label=rep.label, start=now - timedelta(days=d), market=f"{rep.sport}_spread", market_label="Spread",
                                            selection=f"{rep.home.name or rep.home.team} -3.5", odds=-110, book="Demo book",
                                            status="won" if won else "lost", units=0.91 if won else -1.0, clv_pct=curve[-1]["clv"] / 100,
                                            reasons=["Demo pick: invented for the sample database."]))
        wins = sum(p.status == "won" for p in picks)
        st = PublicStrategy(id=sid, name=name, description=desc, picks=picks[::-1][:10], stats=StrategyStats(
            picks=24, settled=24, won=wins, lost=24 - wins, units=round(units, 2), roi=round(units / 24, 3), hit_rate=round(wins / 24, 3),
            implied_hit_rate=0.524, avg_clv_pct=0.004, clv_n=24, beat_close=0.54, curve=curve, clv_pcts=[c["clv"] / 100 for c in curve]))
        strategies.append(st)
        store.put_doc(db, f"strategy:{sid}", st.model_dump(mode="json"))
    store.put_doc(db, "strategies", [s.model_dump(mode="json") for s in strategies])
    row = lambda k, n, t, note: PublicPolicyRow(key=k, name=n, tier=t, note=note)  # noqa: E731
    store.put_doc(db, "sources", PublicSources(
        data=[row("demo", SITE, "own", "Invented by ebk/demo.py so the site runs from a clean checkout.")],
        sources=[row(sid, site, "facts", "An invented outlet: picks shown as facts with a link.") for sid, site in OUTLETS],
        strategies=[row(s.id, s.name, "own", s.description) for s in strategies],
        excluded=[{"what": "The analysts' reasoning", "why": "A pick is a fact; the argument for it stays on the publisher's page."},
                  {"what": "AI-written analysis", "why": "Every finding is written by a fixed rule from computed numbers."}]).model_dump(mode="json"))


def build(out: Path, seed: int = 7, now: datetime | None = None) -> dict[str, int]:
    """Write the demo database to `out`; returns how many boards per sport."""
    rng = random.Random(seed)
    now = (now or datetime.now(UTC)).replace(microsecond=0)
    db = store.create(out)
    counts, boards = {}, []
    for sport in ("nba", "nfl", "soccer"):
        names, values, strength = _league(sport, rng)
        codes = list(names)
        rng.shuffle(codes)
        for i in range(0, len(codes) - 1, 2):
            start = now + timedelta(hours=5 + 9 * len(boards) % 70)
            rep = _board(sport, codes[i], codes[i + 1], names, values, strength, start, now, rng)
            store.put_board(db, rep, start)
            if sport in ("nba", "nfl"):
                _extras(db, rep, start, strength, rng)
            boards.append((rep, start))
        counts[sport] = len(codes) // 2
    _picklab(db, boards, now, rng)
    db.commit()
    db.close()
    return counts


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build a site database of invented data.")
    ap.add_argument("--out", type=Path, default=Path("site.db"))
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args(argv)
    counts = build(a.out, a.seed)
    print(f"demo site database → {a.out}: " + ", ".join(f"{n} {s} games" for s, n in counts.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
