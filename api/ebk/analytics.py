"""GET /public/analytics/*: the sports-analytics side of the site.

Every route reads finished boards from a source (`use(...)`: the site's own database in ebk/store.py) and computes the
findings of insights/engine.py from them. No outbound request, no model call: the same boards always give the same pages.
"""
from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo
from statistics import fmean
from typing import Protocol

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ebk.game_extras import PublicHistory, PublicTree
from ebk.teams import full_name, nickname
from insights import Insight, insights
from schemas.tactics import (AdjustmentBranch, InferenceChain, MatchupEdge, OpponentFaced, PlayerMatchupEdge,
                             PlayerTraitValue, TacticalReport, TeamIdentity, TraitValue)
from tactics.ontology import SPORTS, mechanisms, player_mechanisms, traits

router = APIRouter(prefix="/public/analytics", tags=["analytics"])

WINDOW_DAYS = 14  # boards built in this window make the slate, the league table and the team / player pages
STARTED_HOURS = 5  # a game stays on the slate this long after its start, then drops off
UNDATED_DAYS = 7  # a board saved without its game's start stays on the slate this long

Dated = tuple[TacticalReport, datetime | None]  # a finished board and its game's start, when known


class Source(Protocol):
    """Where finished boards come from."""

    def boards(self) -> list[Dated]:
        """Every ready board built in the last WINDOW_DAYS days, newest first."""

    def board(self, event_id: str) -> Dated | None:
        """One ready board by its game id, whatever its age."""

    async def extra(self, event_id: str, kind: str) -> dict | None:
        """A stored extra view of a game ("history" or "tree"), already publishable, or None."""

    def stored(self, event_id: str, kind: str) -> dict | None:
        """The same view only where reading it costs nothing (a frozen file); a source that builds views on request
        returns None, so a list of games never triggers a build per game."""


_source: Source | None = None


def use(source: Source) -> None:
    global _source
    _source = source


def _named(rep: TacticalReport) -> TacticalReport:
    """The board with each team's nickname where it only carried its code ("NYG" → "Giants"); findings then read as names."""
    for side in (rep.home, rep.away):
        if side and (not side.name or side.name == side.team):
            side.name = nickname(rep.sport, side.team) or side.team
    return rep


def _boards() -> list[Dated]:
    if _source is None:
        raise RuntimeError("no board source set (ebk.analytics.use)")
    return [(_reconciled(_named(rep)), start) for rep, start in _source.boards()]


def _board(event_id: str) -> Dated | None:
    hit = _source.board(event_id) if _source else None
    return (_reconciled(_named(hit[0])), hit[1]) if hit else None


class TraitMeta(BaseModel):
    id: str
    unit: str
    label: str
    description: str
    measure: str
    good_high: bool


class MechanismMeta(BaseModel):
    id: str
    label: str
    description: str
    attack: str
    resist: str
    scene: str
    level: str


class GameResult(BaseModel):
    home_pts: int
    away_pts: int
    winner: str | None  # None for a tie


class PregameCall(BaseModel):
    source: str  # "score" (the score model), "sim" (the simulation), "lean" (the matchup board)
    model: str  # the method's version
    made_at: datetime
    pick: str | None  # the team called; None = the board was even and made no call
    p: float | None = None  # the win share given to `pick`, for a method that gives one
    backfilled: bool = False  # made before the game, written into the log after it
    right: bool | None = None  # against the result, once there is one (None: no call, a tie, or no result yet)


class PublicBoard(BaseModel):
    event_id: str
    sport: str
    label: str
    start: datetime | None
    built_at: datetime
    home: TeamIdentity
    away: TeamIdentity
    matchups: list[MatchupEdge]
    inferences: list[InferenceChain]
    player_matchups: list[PlayerMatchupEdge]
    adjustments: list[AdjustmentBranch]
    simulation: dict | None
    notes: list[str]
    rest: dict[str, int] = {}  # team → full days off before this game (0 = second night of a back-to-back), where known
    time_tbd: bool = False  # the day is set, the tip time isn't: show the day only
    insights: list[Insight]
    traits: list[TraitMeta]
    mechanisms: list[MechanismMeta]
    result: GameResult | None = None  # the final score, once the game is over and the score is known
    calls: list[PregameCall] = []  # what each method said before the game started (the forecast log), newest per method
    method: str = ("Computed from public box scores and play-by-play before the game's start. Ranks are within the league; "
                   "schedule-adjusted ranks take out the strength of the opponents faced. Findings are written by rule "
                   "from these numbers.")


class SlateTeam(BaseModel):
    team: str
    name: str
    offense: float | None  # mean percentile of the computed offense traits (1 = best)
    defense: float | None
    carried: bool = False  # too few games this season: this team's numbers and ranks are last season's


class ModelWin(BaseModel):
    team: str
    p: float
    source: str  # "sim": the game simulated from each team's rates; "score": the score model's spread of final scores


class MatchupCount(BaseModel):
    home: int  # matchups with a clear edge that the home side wins
    away: int
    of: int


class SlateGame(BaseModel):
    event_id: str
    sport: str
    label: str
    start: datetime | None
    built_at: datetime
    home: SlateTeam
    away: SlateTeam
    tilt: float  # -1..1, + = the home side wins more of the board's matchups (confidence-weighted)
    home_win: float | None  # the simulation's win share where a simulation exists
    away_win: float | None = None
    headline: Insight | None
    findings: int
    also: list[str] = []  # the stats the other findings are about, strongest first: the card draws one picture per part of the game
    time_tbd: bool = False
    lean: str | None = None  # the team the whole-board verdict names, None for an even board (the card says what the page says)
    model: ModelWin | None = None  # the model's favourite and its win share: the number the game page leads with
    # the two readings side by side. The win share (model) plays the score out; the lean counts who is better in more
    # parts of the game. `agree`: True / False when both name a team, None when either doesn't (no model yet, or an
    # even board: nothing to disagree with)
    agree: bool | None = None
    matchups: MatchupCount | None = None  # what the lean is counted from: the card draws this, so its bar and its words say one thing


class Slate(BaseModel):
    generated_at: datetime
    games: list[SlateGame]
    sports: list[str]


class LeagueTeam(BaseModel):
    team: str
    name: str
    wins: int = 0
    losses: int = 0
    draws: int = 0
    offense: float | None
    defense: float | None
    traits: list[TraitValue]
    as_of: datetime
    event_id: str  # the newest board the row was read from
    carried: bool = False  # too few games this season: the team numbers are last season's


class League(BaseModel):
    sport: str
    generated_at: datetime
    teams: list[LeagueTeam]
    traits: list[TraitMeta]
    of: int | None  # league size where the boards state it


class TeamGame(BaseModel):
    event_id: str
    label: str
    start: datetime | None
    opponent: str
    opponent_name: str
    home: bool
    headline: Insight | None


class TeamPage(BaseModel):
    sport: str
    team: str
    name: str
    as_of: datetime
    carried: bool = False
    offense: float | None
    defense: float | None
    traits: list[TraitValue]
    opponents: list[OpponentFaced]
    players: list[PlayerTraitValue]
    games: list[TeamGame]
    findings: list[Insight]  # findings about this team from its newest board
    notes: list[str] = []  # what the reader must know about these numbers (e.g. early season: last season's sample)
    trait_meta: list[TraitMeta]


class PlayerPage(BaseModel):
    player_id: str
    name: str
    sport: str
    team: str
    team_name: str
    position: str
    as_of: datetime
    traits: list[PlayerTraitValue]
    matchups: list[PlayerMatchupEdge]  # against the opponents on this player's recent boards
    trait_meta: list[TraitMeta]
    upcoming: list[str] = []  # opponents still to play: the rest of the matchups are games already played
    carried: bool = False  # his team is still on last season's numbers: these are last season's, ranked among last season's players


class IndexTeam(BaseModel):
    sport: str
    team: str
    name: str
    full_name: str


class IndexPlayer(BaseModel):
    sport: str
    player_id: str
    name: str
    team: str
    team_name: str
    position: str


class IndexGame(BaseModel):
    sport: str
    event_id: str
    label: str
    start: datetime | None


class SearchIndex(BaseModel):
    """Everything a visitor can jump to: the search box reads this once."""
    teams: list[IndexTeam]
    players: list[IndexPlayer]
    games: list[IndexGame]


class Finding(BaseModel):
    """One finding with the game it came from."""
    event_id: str
    sport: str
    label: str
    start: datetime | None
    home: SlateTeam
    away: SlateTeam
    insight: Insight


class Findings(BaseModel):
    generated_at: datetime
    kinds: dict[str, int]  # how many of each kind before the kind filter
    findings: list[Finding]


class Leader(BaseModel):
    player_id: str
    name: str
    team: str
    team_name: str
    position: str
    value: float
    rank: int | None
    of: int | None
    n: int


class LeaderBoard(BaseModel):
    trait: TraitMeta
    position: str | None  # players are ranked within their position
    leaders: list[Leader]


class Leaders(BaseModel):
    sport: str
    generated_at: datetime
    boards: list[LeaderBoard]


def _utc(d: datetime | None) -> datetime | None:
    return d.replace(tzinfo=UTC) if d is not None and d.tzinfo is None else d


def event_key(raw: str) -> str:
    """'nba-20261112.401909979' or 'nba:…' → the stored id; 404 for anything that isn't a board sport."""
    head, sep, rest = raw.partition(":") if ":" in raw else raw.partition("-")
    if head not in ("nfl", "soc", "nba") or not rest or len(raw) > 64:
        raise HTTPException(404, "Not found")
    return f"{head}:{rest}"


def _sport(raw: str) -> str:
    raw = raw.lower()
    if raw not in SPORTS:
        raise HTTPException(404, "Not found")
    return raw


def _team_key(sport: str, raw: str) -> str:
    """A team's key from a URL: soccer ids as written, NBA and NFL codes in capitals whatever the link's case."""
    return f"soc:{raw[4:]}" if sport == "soccer" and raw.startswith(("soc-", "soc:")) else raw.upper() if sport in ("nba", "nfl") else raw


def _meta(sport: str, ids: set[str]) -> list[TraitMeta]:
    spec = traits(sport)
    return [TraitMeta(id=t.id, unit=t.unit, label=t.label, description=t.description, measure=t.measure, good_high=t.good_high)
            for t in spec.values() if t.id in ids]


def _mechs(sport: str, ids: set[str]) -> list[MechanismMeta]:
    spec = {**mechanisms(sport), **player_mechanisms(sport)}
    return [MechanismMeta(id=m.id, label=m.label, description=m.description, attack=m.attack, resist=m.resist, scene=m.scene,
                          level=m.level) for m in spec.values() if m.id in ids]


# One side of the ball as one number: its points measure, not an average that mixes in how a team likes to play
# (three-point volume, blitz rate, motion). Soccer has no single measure here and keeps the mean of its side's traits.
HEADLINE = {"nba": {"offense": "nba.off.rating", "defense": "nba.def.rating"},
            "nfl": {"offense": "nfl.off.points_per_drive", "defense": "nfl.def.points_per_drive"}}


def _side(t: TeamIdentity, sport: str, unit: str) -> float | None:
    """The league percentile (1 = best) of a side's points measure: points per 100 possessions in the NBA, points per
    drive in the NFL, with the schedule taken out where it can be."""
    pct = lambda v: v.adj_percentile if v.adj_percentile is not None else v.percentile  # noqa: E731
    head = HEADLINE.get(sport, {}).get(unit)
    if head:
        hit = next((v for v in t.traits if v.trait == head and v.percentile is not None), None)
        return round(pct(hit), 3) if hit else None
    spec = traits(sport)
    ps = [pct(v) for v in t.traits if v.trait in spec and spec[v.trait].unit == unit and v.percentile is not None]
    return round(fmean(ps), 3) if ps else None


def day_only(rep: TacticalReport) -> datetime | None:
    """What stands in for an NBA game's start when only its day is known: the day in its id (nba:<yyyymmdd>.<competition>)
    at 23:00 UTC. A placeholder, never shown as a time (see `_tbd`)."""
    if rep.sport != "nba":
        return None
    try:
        return datetime.strptime(rep.event_id.split(":")[1][:8], "%Y%m%d").replace(tzinfo=UTC) + timedelta(hours=23)
    except (ValueError, IndexError):
        return None


def start_of(rep: TacticalReport, known: datetime | None = None) -> datetime | None:
    """The game's start: saved with the board, else `known`, else (NBA) its day alone."""
    if rep.start or known:
        return _utc(rep.start or known)
    return day_only(rep)


def _label(rep: TacticalReport) -> str:
    h, a = rep.home.name or rep.home.team, rep.away.name or rep.away.team
    if rep.label and h == rep.home.team:  # no better names than the codes the label was written with
        return rep.label
    return f"{h} v {a}" if rep.sport == "soccer" else f"{a} at {h}"


def _tilt(rep: TacticalReport) -> float:
    w = [(e.edge if e.attack_team == rep.home.team else -e.edge) * e.confidence for e in rep.matchups]
    total = sum(e.confidence for e in rep.matchups)
    return round(max(-1.0, min(1.0, sum(w) / total)), 3) if total else 0.0


def _headline(found: list[Insight], lean: str | None) -> Insight | None:
    """The finding a game's card leads with: the strongest one about the side the board names (the same verdict the
    card's words give), so the card's sentence and its lean never point opposite ways; on an even board, simply the
    strongest."""
    if not found:
        return None
    if lean:
        mine = [f for f in found if f.team == lean and f.kind in ("mismatch", "star", "hidden", "sim", "balance")]
        return mine[0] if mine else next((f for f in found if f.kind == "balance"), found[0])
    return next((f for f in found if f.kind != "balance"), found[0])


def _stat_of(f: Insight) -> str | None:
    """The stat a finding is about: the one its chart names, else the last number's (the defence in a matchup)."""
    return (f.viz or {}).get("trait") or next((x.trait for x in reversed(f.numbers) if x.trait), None)


def _also(found: list[Insight], head: Insight | None, limit: int = 8) -> list[str]:
    """The stats behind a game's other findings, strongest first, each once."""
    out: list[str] = []
    for f in found:
        t = None if f is head or f.kind == "balance" else _stat_of(f)
        if t and t not in out:
            out.append(t)
    return out[:limit]


def _slate_team(t: TeamIdentity, sport: str) -> SlateTeam:
    return SlateTeam(team=t.team, name=t.name or t.team, offense=_side(t, sport, "offense"), defense=_side(t, sport, "defense"),
                     carried=_carried(sport, t))


def _model_win(rep: TacticalReport) -> ModelWin | None:
    """The model's favourite as the game page states it: the simulation where there is one, else the score model's
    "who wins" shares from the stored tree."""
    sim = rep.simulation or {}
    hw = sim.get("home_win")
    source = "sim"
    if hw is not None:
        aw = sim.get("away_win", 1 - hw)
    else:
        tree = _source.stored(rep.event_id, "tree") if _source else None
        p = {n.get("id"): n.get("p") for n in (tree or {}).get("nodes", [])}
        hw, aw, source = p.get("w:home"), p.get("w:away"), "score"
        if hw is None or aw is None:
            return None
    return ModelWin(team=rep.home.team if hw >= aw else rep.away.team, p=round(max(hw, aw), 4), source=source)


@router.get("/slate", response_model=Slate)
async def slate(sport: str | None = None, days: int = 4, limit: int = 60):
    """Games with a board: those starting from a day ago through `days` ahead, soonest first; a game with no known
    start is listed by when its board was built."""
    days, limit = max(1, min(days, 14)), max(1, min(limit, 120))
    now = datetime.now(UTC)
    lo, hi = now - timedelta(hours=STARTED_HOURS), now + timedelta(days=days)
    games, leagues = [], {}
    for rep, start in _boards():
        built = _utc(rep.created_at)
        shown = lo <= start <= hi if start else built >= now - timedelta(days=UNDATED_DAYS)
        if (sport and rep.sport != sport) or not shown:
            continue
        rep = _current(rep, start, leagues)
        found = _found(rep)
        sim = rep.simulation or {}
        tilt = _tilt(rep)
        balance = next((f for f in found if f.kind == "balance"), None)
        lean, model = balance.team if balance else None, _model_win(rep)
        head = _headline(found, lean)
        count = (balance.viz if balance else {})
        games.append(SlateGame(event_id=rep.event_id, sport=rep.sport, label=_label(rep), start=start,
                               built_at=_utc(rep.created_at), home=_slate_team(rep.home, rep.sport),
                               away=_slate_team(rep.away, rep.sport), tilt=tilt, home_win=sim.get("home_win"), away_win=sim.get("away_win", None if sim.get("home_win") is None else round(1 - sim["home_win"], 4)),
                               headline=head, findings=sum(f.kind != "balance" for f in found), also=_also(found, head),
                               time_tbd=_tbd(rep, start), model=model, lean=lean,
                               agree=(model.team == lean) if model and lean else None,
                               matchups=MatchupCount(home=count["home_wins"], away=count["away_wins"], of=count["of"]) if count.get("of") else None))
    games.sort(key=lambda g: (g.start is None, g.start or g.built_at, g.label))  # dated games first, soonest first
    return Slate(generated_at=now, games=games[:limit], sports=sorted({g.sport for g in games}))


@router.get("/game/{event_id}", response_model=PublicBoard)
async def game(event_id: str):
    eid = event_key(event_id)
    hit = _board(eid)
    if hit is None or not hit[0].home or not hit[0].away:
        raise HTTPException(404, "Not found")
    rep, start = hit
    rep = _spoken(_current(rep, start))
    used = {t.trait for side in (rep.home, rep.away) for t in side.traits} | {p.trait for side in (rep.home, rep.away) for p in side.players}
    result, calls = _calls(rep.event_id, _forecast_log())
    return PublicBoard(
        result=result, calls=calls,
        event_id=rep.event_id, sport=rep.sport, label=_label(rep), start=start,
        built_at=_utc(rep.created_at), home=rep.home, away=rep.away, matchups=rep.matchups, inferences=rep.inferences,
        player_matchups=rep.player_matchups, adjustments=rep.adjustments, simulation=rep.simulation, notes=rep.notes,
        insights=_found(rep), rest=_rest(rep, start), time_tbd=_tbd(rep, start), traits=_meta(rep.sport, used),
        mechanisms=_mechs(rep.sport, {e.mechanism for e in rep.matchups} | {e.mechanism for e in rep.player_matchups}))


def _latest_teams(sport: str) -> dict[str, tuple[TeamIdentity, TacticalReport]]:
    out: dict[str, tuple[TeamIdentity, TacticalReport]] = {}
    for rep, _ in _boards():  # newest first: the first board a team appears on is its current identity
        if rep.sport == sport:
            for t in (rep.home, rep.away):
                out.setdefault(t.team, (t, rep))
    return _reranked(sport, out) if sport != "soccer" else out  # soccer mixes leagues: each club keeps its own league's rank


def _reranked(sport: str, teams: dict[str, tuple[TeamIdentity, TacticalReport]]) -> dict[str, tuple[TeamIdentity, TacticalReport]]:
    """Each team's identity comes from its own newest board, and boards are built on different days, so their ranks were
    taken from slightly different leagues (two teams could both read "1st"). Ranks and percentiles are taken again here
    across the teams as assembled, raw and schedule-adjusted, so every rank on a league or team page is unique."""
    spec = traits(sport)
    values: dict[str, list[TraitValue]] = {}
    # a team on last season's numbers keeps its players as its board has them (last season's samples and ranks), so every
    # player a page names has a page; only a this-season team drops the odd player whose sample was carried over
    copies = {k: (t.model_copy(update={"traits": [v.model_copy() for v in t.traits],
                                       "players": [pl.model_copy() for pl in t.players] if _carried(sport, t) else _this_season(t)}), rep)
              for k, (t, rep) in teams.items()}
    # A team still on last season's numbers keeps the ranks its board gave it (among last season's league) and is left
    # out of this season's ranking: a 2025-26 value never pushes a 2026-27 team up or down a place.
    current = {k: v for k, v in copies.items() if not _carried(sport, v[0])}
    pools: dict[tuple[str, str | None], list[PlayerTraitValue]] = {}
    for t, _ in current.values():
        for pl in t.players:
            if pl.rank is not None and pl.value is not None:
                pools.setdefault((pl.trait, pl.position), []).append(pl)
    for (tid, _pos), ps in pools.items():  # one player rank per stat and position, the same on every page
        ps.sort(key=lambda x: x.value, reverse=spec[tid].good_high if tid in spec else True)
        for i, pl in enumerate(ps):
            pl.rank, pl.of = i + 1, len(ps)
    for t, _ in current.values():
        for v in t.traits:
            values.setdefault(v.trait, []).append(v)
    for tid, vs in values.items():
        high = spec[tid].good_high if tid in spec else True
        for field, rank, pct in (("value", "rank", "percentile"), ("adj_value", "adj_rank", "adj_percentile")):
            have = sorted((v for v in vs if getattr(v, field) is not None), key=lambda v: getattr(v, field), reverse=high)
            n = len(have)
            if n < max(8, len(vs) // 2):  # too few teams carry it to call it a league rank: leave the board's own
                continue
            for i, v in enumerate(have):
                setattr(v, rank, i + 1)
                setattr(v, pct, round(1 - i / max(1, n - 1), 3))
                v.of = n
        # the schedule's own rank is counted among the same teams, so "the 3rd-easiest schedule" is 3rd of the league shown
        hard = sorted((v for v in vs if v.sos is not None and v.sos_rank is not None), key=lambda v: v.sos, reverse=True)
        if len(hard) >= max(8, len(vs) // 2):
            for i, v in enumerate(hard):
                v.sos_rank = i + 1
    return copies


def _carried(sport: str, t: TeamIdentity) -> bool:
    """True when a team's numbers are last season's: an NBA trait's sample is in games, and a sample of more games than
    the team has played this season was carried over (the builder does that for a team with too few games)."""
    played = sum(1 for o in t.opponents if o.result)
    return sport == "nba" and any((v.n or 0) > played + 3 for v in t.traits)


SEASON_MIN = 10  # games each team needs before a breakdown uses this season's numbers (the builder's rule)


def _played(t: TeamIdentity) -> int:
    return sum(1 for o in t.opponents if o.result)


def _season_rule(rep: TacticalReport) -> str:
    short = [t for t in (rep.home, rep.away) if _played(t) < SEASON_MIN]
    why = (" and ".join(f"{t.name or t.team} had played {_played(t)}" for t in short) + " when it was built") if short else "it was built early"
    return (f"Last season's numbers for both teams: a breakdown switches to this season once both teams have played "
            f"{SEASON_MIN} games, and {why}. Every rank here is among last season's teams.")


def _season_noted(rep: TacticalReport) -> TacticalReport:
    if not any(_carried(rep.sport, t) for t in (rep.home, rep.away)):
        return rep
    return rep.model_copy(update={"notes": [n for n in rep.notes if not n.startswith("Early season")] + [_season_rule(rep)]})


def _carry_note(t: TeamIdentity, rep: TacticalReport | None = None) -> str:
    opp = None if rep is None else rep.away if rep.home.team == t.team else rep.home
    why = (f"its latest breakdown was against {opp.name or opp.team}, who had played {_played(opp)}" if opp is not None and _played(opp) < SEASON_MIN
           else f"it had played {_played(t)} when its latest breakdown was built")
    return (f"{t.name or t.team}: last season's numbers. A breakdown switches to this season once both teams have played "
            f"{SEASON_MIN} games, and {why}. Its ranks are among last season's teams, not this season's.")


EASTERN = ZoneInfo("America/New_York")  # NBA and NFL schedules are written in Eastern time
_BARE_RANK = re.compile(r"\s*\b\d+(?:st|nd|rd|th) of \d+\b")
_RANK_ASIDE = re.compile(r"\s*\((?:[^()]*\b\d+(?:st|nd|rd|th) of \d+[^()]*)\)")


# A rank written into a sentence when the board was built is from that day's league; the page's ranks are today's. The
# whole phrase that carried the rank goes, not just the digits, so no sentence is left with a hole in it.
_RANKED_AS = re.compile(r"\s*ranked \d+(?:st|nd|rd|th) of \d+(?: schedule-adjusted)?(?:, \d+(?:st|nd|rd|th) raw)?")
_STAT_RANK = re.compile(r"(?<=: )[A-Z]{2,4} [A-Za-z' -]+? \d+(?:st|nd|rd|th) of \d+,\s*")


def _unranked(text: str) -> str:
    return _BARE_RANK.sub("", _RANK_ASIDE.sub("", _STAT_RANK.sub("", _RANKED_AS.sub("", text))))


def _spoken(rep: TacticalReport) -> TacticalReport:
    """The coaching questions with each team's code read as its name ("Will WAS roll coverage" → "Will Commanders…")."""
    names = {t.team: t.name for t in (rep.home, rep.away) if t.name and t.name != t.team}
    if not names or not rep.adjustments or rep.sport not in ("nba", "nfl"):
        return rep
    code = re.compile(r"\b(" + "|".join(re.escape(c) for c in names) + r")\b")
    def say(x: str) -> str:
        out = code.sub(lambda m: f"the {names[m.group(1)]}", x)
        return out[:1].upper() + out[1:]

    return rep.model_copy(update={"adjustments": [a.model_copy(update={"question": say(a.question), "if_branch": say(a.if_branch),
                                                                         "then_branch": say(a.then_branch)}) for a in rep.adjustments]})


def _tbd(rep: TacticalReport, start: datetime | None) -> bool:
    """The day is known and the tip time isn't: the board carries no start of its own and the start in hand is only
    the day in its id. Nothing is guessed from how many games share a time: a real early tip is a real time."""
    return rep.start is None and start is not None and start == day_only(rep)


def _rest(rep: TacticalReport, start: datetime | None) -> dict[str, int]:
    """Full days off before this game for each side: from its last played game or a game of its own on the schedule
    that comes before this one, whichever is later."""
    if start is None:
        return {}
    out: dict[str, int] = {}
    for side in (rep.home, rep.away):
        last = [_utc(o.date) for o in side.opponents if o.result and o.date]
        last += [st for other, st in _boards() if st and st < start and other.event_id != rep.event_id and other.sport == rep.sport
                 and side.team in (other.home.team, other.away.team)]
        if last:
            days = (start.astimezone(EASTERN).date() - max(last).astimezone(EASTERN).date()).days - 1  # the league's calendar, not UTC's
            if 0 <= days <= 12:
                out[side.team] = days
    return out


def _this_season(t: TeamIdentity) -> list[PlayerTraitValue]:
    """The team's players whose sample is from this season: a sample of more games than the team has played was carried
    over from last season (a player who has barely played yet) and can't be ranked beside this season's."""
    played = sum(1 for o in t.opponents if o.result)
    return [pl.model_copy() for pl in t.players if played < 3 or not pl.n or pl.n <= played + 3]


def _record(t: TeamIdentity) -> tuple[int, int, int]:
    res = [o.result for o in t.opponents if o.result]
    return res.count("W"), res.count("L"), res.count("D")


@router.get("/league/{sport}", response_model=League)
async def league(sport: str):
    """Each team's newest computed identity, for league-wide charts. Soccer mixes leagues: ranks are within each one."""
    sport = _sport(sport)
    teams = _latest_teams(sport)
    used = {v.trait for t, _ in teams.values() for v in t.traits}
    sizes = [v.of for t, _ in teams.values() for v in t.traits if v.of]
    return League(sport=sport, generated_at=datetime.now(UTC), traits=_meta(sport, used),
                  of=max(set(sizes), key=sizes.count) if sizes else None,
                  teams=sorted((LeagueTeam(team=t.team, name=t.name or t.team, wins=_record(t)[0], losses=_record(t)[1], draws=_record(t)[2],
                                           offense=_side(t, sport, "offense"),
                                           defense=_side(t, sport, "defense"), traits=t.traits, as_of=_utc(rep.created_at),
                                           event_id=rep.event_id, carried=_carried(sport, t)) for t, rep in teams.values()), key=lambda x: x.name))


@router.get("/team/{sport}/{team}", response_model=TeamPage)
async def team(sport: str, team: str):
    sport = _sport(sport)
    key = _team_key(sport, team)
    hit = _latest_teams(sport).get(key)
    if hit is None:
        raise HTTPException(404, "Not found")
    t, newest = hit
    games, leagues = [], {}
    for rep, start in _boards():
        if rep.sport != sport or key not in (rep.home.team, rep.away.team):
            continue
        home = rep.home.team == key
        opp = rep.away if home else rep.home
        found = _found(_current(rep, start, leagues))
        games.append(TeamGame(event_id=rep.event_id, label=_label(rep), start=start, opponent=opp.team,
                              opponent_name=opp.name or opp.team, home=home, headline=found[0] if found else None))
    return TeamPage(sport=sport, team=t.team, name=t.name or t.team, as_of=_utc(newest.created_at),
                    offense=_side(t, sport, "offense"), defense=_side(t, sport, "defense"), traits=t.traits,
                    opponents=t.opponents, players=t.players, games=games[:12],  # noqa: E501
                    carried=_carried(sport, t), findings=[f for f in _found(_current(newest, None, leagues), limit=30) if f.team == key and f.kind not in ("balance", "sim")][:8], notes=[n for n in newest.notes if not n.startswith("Early season")] + ([_carry_note(t, newest)] if _carried(sport, t) else []),
                    trait_meta=_meta(sport, {v.trait for v in t.traits} | {p.trait for p in t.players}))


@router.get("/player/{player_id}", response_model=PlayerPage)
async def player(player_id: str):
    head, sep, rest = player_id.partition(":") if ":" in player_id else player_id.partition("-")
    if head not in ("nfl", "nba") or not rest or len(player_id) > 48:
        raise HTTPException(404, "Not found")
    pid, sport = f"{head}:{rest}", head
    rows: list[PlayerTraitValue] = []
    edges: list[PlayerMatchupEdge] = []
    newest: TacticalReport | None = None
    side: TeamIdentity | None = None
    league = _latest_teams(sport)
    for t, rep in league.values():  # the same re-ranked league every other page reads
        mine = [p for p in t.players if p.player_id == pid]
        if mine:
            newest, side, rows = rep, t, mine
            break
    leagues = {sport: league}
    now, upcoming = datetime.now(UTC), set()
    for rep, start in _boards():
        if rep.sport == sport and pid in {p.player_id for t in (rep.home, rep.away) for p in t.players}:
            mine_edges = [e for e in _current(rep, start, leagues).player_matchups if e.player_id == pid]
            if start and start > now - timedelta(hours=STARTED_HOURS):
                upcoming |= {e.opponent for e in mine_edges}
            edges += [(start or _utc(rep.created_at), e) for e in mine_edges]
    edges.sort(key=lambda x: (x[1].opponent not in upcoming, -x[0].timestamp()))  # the next game first, then the latest played
    edges = [e for _, e in edges]
    if newest is None or side is None:
        raise HTTPException(404, "Not found")
    seen, uniq = set(), []
    for e in edges:  # one row per opponent and mechanism, from the newest board that has it
        if (e.opponent, e.mechanism) not in seen:
            seen.add((e.opponent, e.mechanism))
            uniq.append(e)
    return PlayerPage(player_id=pid, name=rows[0].name, sport=sport, team=side.team, team_name=side.name or side.team, upcoming=sorted(upcoming),
                      carried=_carried(sport, side),
                      position=rows[0].position, as_of=_utc(newest.created_at), traits=rows, matchups=uniq[:24],
                      trait_meta=_meta(sport, {p.trait for p in rows} | {e.resist.trait for e in uniq}))


@router.get("/index", response_model=SearchIndex)
async def index():
    """Every team, player and game that has a page, for the site's search."""
    teams: dict[tuple[str, str], IndexTeam] = {}
    players: dict[str, IndexPlayer] = {}
    games = []
    paged = {p.player_id for sport in ("nba", "nfl") for t, _ in _latest_teams(sport).values() for p in t.players}  # who has a page
    for rep, start in _boards():
        games.append(IndexGame(sport=rep.sport, event_id=rep.event_id, label=_label(rep), start=start))
        for t in (rep.home, rep.away):
            name = t.name or t.team
            teams.setdefault((rep.sport, t.team), IndexTeam(sport=rep.sport, team=t.team, name=name, full_name=full_name(rep.sport, t.team) or name))
            for p in t.players:
                if p.player_id not in paged:
                    continue
                players.setdefault(p.player_id, IndexPlayer(sport=rep.sport, player_id=p.player_id, name=p.name, team=t.team,
                                                             team_name=name, position=p.position))
    now = datetime.now(UTC)
    soon = lambda g: g.start is not None and g.start >= now - timedelta(hours=STARTED_HOURS)  # noqa: E731
    # what is coming up first (soonest first), then what has been played (latest first), then the undated
    games.sort(key=lambda g: (0, g.start.timestamp()) if soon(g) else (1, -g.start.timestamp()) if g.start else (2, 0))
    return SearchIndex(teams=sorted(teams.values(), key=lambda t: (t.sport, t.full_name)),
                       players=sorted(players.values(), key=lambda p: (p.sport, p.name)), games=games[:200])


@router.get("/findings", response_model=Findings)
async def findings(sport: str | None = None, kind: str | None = None, days: int = 4, limit: int = 60):
    """Every finding on the slate's boards, strongest first, optionally one sport or one kind. The per-game tally
    ("the whole board") is a summary, not a finding, and is left out."""
    days, limit = max(1, min(days, 14)), max(1, min(limit, 600))
    now = datetime.now(UTC)
    lo, hi = now - timedelta(hours=STARTED_HOURS), now + timedelta(days=days)
    out, kinds, leagues = [], {}, {}
    for rep, start in _boards():
        shown = lo <= start <= hi if start else _utc(rep.created_at) >= now - timedelta(days=UNDATED_DAYS)
        if not shown or (sport and rep.sport != sport):
            continue
        for f in _found(_current(rep, start, leagues)):
            if f.kind == "balance":
                continue
            kinds[f.kind] = kinds.get(f.kind, 0) + 1
            if kind is None or f.kind == kind:
                out.append(Finding(event_id=rep.event_id, sport=rep.sport, label=_label(rep), start=start,
                                   home=_slate_team(rep.home, rep.sport), away=_slate_team(rep.away, rep.sport), insight=f))
    out.sort(key=lambda x: (-x.insight.score, x.event_id, x.insight.id))
    return Findings(generated_at=now, kinds=dict(sorted(kinds.items())), findings=out[:limit])


class TraitTeam(BaseModel):
    team: str
    name: str
    value: float | None
    adj_value: float | None = None
    rank: int | None = None
    adj_rank: int | None = None
    of: int | None = None
    carried: bool = False  # last season's numbers: ranked among last season's teams, not this season's


class TraitLeague(BaseModel):
    sport: str
    trait: TraitMeta
    teams: list[TraitTeam]


@router.get("/trait/{sport}/{trait}", response_model=TraitLeague)
async def trait_league(sport: str, trait: str):
    """One team stat across the whole league, as played and with the schedule taken out: every team a point on one
    scale, from the same re-ranked league every other page reads (what a finding's chart draws its field from)."""
    sport = _sport(sport)
    spec = traits(sport)
    if trait not in spec or spec[trait].unit not in ("offense", "defense", "situation", "special"):
        raise HTTPException(404, "Not found")
    rows = []
    for t, _ in _latest_teams(sport).values():
        v = next((x for x in t.traits if x.trait == trait and x.value is not None), None)
        if v is not None:
            rows.append(TraitTeam(team=t.team, name=t.name or t.team, value=v.value, adj_value=v.adj_value, rank=v.rank,
                                  adj_rank=v.adj_rank, of=v.of, carried=_carried(sport, t)))
    if not rows:
        raise HTTPException(404, "Not found")
    return TraitLeague(sport=sport, trait=_meta(sport, {trait})[0], teams=sorted(rows, key=lambda r: r.name))


@router.get("/leaders/{sport}", response_model=Leaders)
async def leaders(sport: str, limit: int = 10):
    """The top players in each kind of production, ranked within their position, from each team's newest board."""
    sport, limit = _sport(sport), max(3, min(limit, 25))
    spec = traits(sport)
    rows: dict[tuple[str, str], dict[str, Leader]] = {}
    for t, _rep in _latest_teams(sport).values():
        if _carried(sport, t):
            continue  # last season's production never sits in this season's leader boards
        for p in t.players:
            if p.rank is None or p.trait not in spec:
                continue
            rows.setdefault((p.trait, p.position), {}).setdefault(p.player_id, Leader(
                player_id=p.player_id, name=p.name, team=t.team, team_name=t.name or t.team, position=p.position, value=p.value,
                rank=p.rank, of=p.of, n=p.n))
    # by the value itself: the ranks came from boards built on different days and can disagree by a place
    boards = [LeaderBoard(trait=_meta(sport, {trait})[0], position=pos,
                          leaders=sorted(ps.values(), key=lambda x: x.value, reverse=spec[trait].good_high)[:limit])
              for (trait, pos), ps in sorted(rows.items()) if len(ps) >= 3]
    return Leaders(sport=sport, generated_at=datetime.now(UTC), boards=boards)


def _confidence(a: TraitValue, r: TraitValue, full: int) -> float:
    return round(min(1.0, (min(a.n or 0, r.n or 0)) / max(1, full)) * 0.9 + 0.1, 2) if (a.n and r.n) else 0.5


_FULL = {"nfl": 300, "nba": 20, "soccer": 10}


def _pct(v: TraitValue) -> float | None:
    return v.adj_percentile if v.adj_percentile is not None else v.percentile


def _edges(sport: str, ht: TeamIdentity, at: TeamIdentity, known: dict[tuple[str, str], float] | None = None):
    """Every team and player matchup between two identities, by the one formula: attack percentile + (1 − resist
    percentile) − 1. `known` keeps a confidence already worked out for a (mechanism, attacking team) pair."""
    nm = {ht.team: ht.name or ht.team, at.team: at.name or at.team}
    by = {t.team: {v.trait: v for v in t.traits} for t in (ht, at)}
    edges, pedges, known = [], [], known or {}
    for mech in mechanisms(sport).values():
        for atk, res in ((ht, at), (at, ht)):
            av, rv = by[atk.team].get(mech.attack), by[res.team].get(mech.resist)
            if av is None or rv is None or _pct(av) is None or _pct(rv) is None:
                continue
            edge = round(_pct(av) + (1 - _pct(rv)) - 1, 3)
            edges.append(MatchupEdge(mechanism=mech.id, label=mech.label, attack_team=atk.team, resist_team=res.team, attack=av,
                                     resist=rv, edge=edge, confidence=known.get((mech.id, atk.team), _confidence(av, rv, _FULL[sport])), scene=mech.scene,
                                     summary=f"{nm[atk.team]} vs {nm[res.team]}: edge {nm[atk.team] if edge >= 0 else nm[res.team]} ({edge:+.2f})"))
    for mech in player_mechanisms(sport).values():
        for atk, res in ((ht, at), (at, ht)):
            rv = by[res.team].get(mech.resist)
            for p in atk.players:
                if p.trait != mech.attack or p.rank is None or not p.of or (mech.position and p.position != mech.position) or rv is None or _pct(rv) is None:
                    continue
                edge = round((1 - (p.rank - 1) / max(1, p.of - 1)) + (1 - _pct(rv)) - 1, 3)
                pedges.append(PlayerMatchupEdge(mechanism=mech.id, label=mech.label, player_id=p.player_id, player=p.name,
                                                position=p.position, team=atk.team, opponent=res.team, attack=p, resist=rv, edge=edge,
                                                confidence=known.get((mech.id, p.player_id), 0.8), summary=f"{p.name} vs {nm[res.team]}"))
    return edges, pedges


def _current(rep: TacticalReport, start: datetime | None, leagues: dict | None = None) -> TacticalReport:
    """A game that hasn't been played, read with the league's numbers as they stand now: both identities from the same
    re-ranked league the team and compare pages use, every edge worked out again from them. One rank per stat on every
    page. A game already played keeps its board as it stood (and soccer, which mixes leagues, keeps its own)."""
    if rep.sport not in ("nba", "nfl") or (start is not None and start < datetime.now(UTC) - timedelta(hours=STARTED_HOURS)):
        return _season_noted(rep)
    if leagues is not None and rep.sport not in leagues:
        leagues[rep.sport] = _latest_teams(rep.sport)
    league = leagues[rep.sport] if leagues is not None else _latest_teams(rep.sport)
    h, a = league.get(rep.home.team), league.get(rep.away.team)
    if h is None or a is None or _carried(rep.sport, h[0]) or _carried(rep.sport, a[0]):
        return _season_noted(rep)  # one or both still on last season: the board as built, every rank from last season
    ht, at = h[0], a[0]
    edges, pedges = _edges(rep.sport, ht, at)
    notes = [n for n in rep.notes if not n.startswith("Early season")]
    live = {(e.mechanism, e.player_id) for e in pedges if e.edge > 0}
    clean = lambda x: _unranked(x)  # noqa: E731
    asks = [a.model_copy(update={"question": clean(a.question), "if_branch": clean(a.if_branch), "then_branch": clean(a.then_branch), "trait_refs": []})
            for a in rep.adjustments if a.player_id is None or (a.mechanism, a.player_id) in live]  # only questions today's numbers still ask
    return rep.model_copy(update={"home": ht, "away": at, "matchups": edges, "player_matchups": pedges, "notes": notes,
                                  "adjustments": asks, "inferences": [c for c in rep.inferences if c.kind == "form"]})


def _found(rep: TacticalReport, limit: int = 10) -> list[Insight]:
    """The board's findings, each one about a team on last season's numbers saying so."""
    found = insights(rep, limit=limit)
    old = {t.team: t.name or t.team for t in (rep.home, rep.away) if t and _carried(rep.sport, t)}
    for f in found:
        who = [name for code, name in old.items() if f.team == code or name in f.claim]
        if who and f.kind not in ("form", "sim"):
            first = f"{f.detail.rstrip('.')}." if f.detail else ""
            f.detail = f"{first} {' and '.join(who)}: last season's numbers and ranks.".strip()
    return found


def _reconciled(rep: TacticalReport) -> TacticalReport:
    """The simulation's shares, taken from its own margin distribution so the headline and the histogram agree: games won
    outright by each side, and games level after regulation named as that."""
    sim = rep.simulation
    dist = (sim or {}).get("margin_dist")
    if not sim or not dist:
        return rep
    total = sum(p for _, p in dist) or 1.0
    home = sum(p for x, p in dist if x > 0) / total
    away = sum(p for x, p in dist if x < 0) / total
    rep.simulation = {**sim, "home_win": round(home, 4), "away_win": round(away, 4), "tie": round(max(0.0, 1 - home - away), 4)}
    return rep


class CalledGame(BaseModel):
    event_id: str
    sport: str
    label: str
    start: datetime
    lean: str | None  # the side the game page's whole-board verdict names, None when it calls the board even
    sim_pick: str | None  # the simulation's favourite where there was a simulation
    sim_p: float | None
    winner: str | None  # None for a tie
    score: str  # written in the label's order: "Thunder 103, Trail Blazers 123"
    last_season: bool = False  # the breakdown was on last season's numbers (the season rule)
    score_pick: str | None = None  # the score model's favourite (NBA)
    score_p: float | None = None
    backfilled: bool = False  # at least one of this game's calls was written into the log after the game


class CallTally(BaseModel):
    method: str
    right: int
    of: int
    source: str | None = None  # "lean" | "score" | "sim" for the site's own calls; None for a plain rule
    # the two plain rules on the SAME games this method called, so the comparison is like for like
    home_right: int | None = None
    record_right: int | None = None
    record_of: int | None = None  # games among them where one team had the better record going in
    backfilled: int = 0  # calls made before the game but written into the log after it


class CalBucket(BaseModel):
    lo: float
    hi: float
    n: int
    said: float | None  # the average win share the method gave its favourite in this range
    won: float | None  # how often that favourite won


class Calibration(BaseModel):
    method: str
    source: str
    n: int
    brier: float | None  # mean squared error of the win share (0.25 = a coin flip; lower is better)
    buckets: list[CalBucket]


class SportRecord(BaseModel):
    sport: str
    games: int
    tallies: list[CallTally]
    brier: float | None = None  # the simulation's mean squared error on its win share (0.25 = a coin flip)
    last_season: int = 0  # how many of the graded breakdowns were on last season's numbers
    this_season: CallTally | None = None  # the lean on this season's numbers alone, when the two are mixed
    waiting: int = 0  # finished games whose final score isn't in the data yet
    late: int = 0  # breakdowns built after their game started: never graded
    notes: list[str] = []
    calibration: list[Calibration] = []  # does a stated 70% win about 70% of the time? (methods that give a win share)
    since: datetime | None = None  # the first graded game
    backfilled: int = 0  # graded games with a call written into the log after the game


class TrackRecord(BaseModel):
    generated_at: datetime
    method: str = ("Every game whose breakdown was built before it started and whose final score is known. A call is "
                   "the team the game's page names in \"The whole board\" (the side that wins at least 60% of the counted "
                   "matchups; anything closer is an even board and makes no call), graded against who won. Two plain rules "
                   "sit beside it for scale: the home team wins, and the team with the better record going in wins. "
                   "Retrospective, and small.")
    sports: list[SportRecord]
    games: list[CalledGame]
    cumulative: bool = False  # True: graded from the forecast log (every game since it began), not a rolling window


def _written(rep: TacticalReport, score: str | None) -> str:
    """The home side's "own score first" result, written in the label's order: away first, then home."""
    own, _, theirs = (score or "").partition("-")
    if not own.strip().isdigit() or not theirs.strip().isdigit():
        return score or ""
    nm = lambda t: t.name or nickname(rep.sport, t.team) or t.team  # noqa: E731
    return f"{nm(rep.away)} {theirs.strip()}, {nm(rep.home)} {own.strip()}"


def _record_before(t: TeamIdentity, before: datetime) -> float | None:
    res = [o.result for o in t.opponents if o.result and o.date and _utc(o.date) < before - timedelta(hours=6)]
    return (res.count("W") + 0.5 * res.count("D")) / len(res) if res else None


def _result_of(rep: TacticalReport, start: datetime, now_home: TeamIdentity):
    """This game's own final score from the home team's newest results, or None. Two teams can meet twice in two days,
    so a result is this game's only when it is the nearest one to the start and the breakdown didn't already hold it
    (a result the board knew when it was built is an earlier meeting, never the game it was written for)."""
    known = {_utc(o.date) for o in rep.home.opponents if o.opponent == rep.away.team and o.result and o.date}
    near = [o for o in now_home.opponents if o.opponent == rep.away.team and o.result and o.date and _utc(o.date) not in known
            and timedelta(hours=-26) <= _utc(o.date) - start <= timedelta(hours=12)]
    return min(near, key=lambda o: abs(_utc(o.date) - start)) if near else None


LOG_METHOD = ("Every game with a call written down before it started and a final score since. The lean is the team the "
                 "game's page names in \"The whole board\" (the side that wins at least 60% of the counted matchups; anything "
                 "closer is an even board and makes no call). The score model and the simulation call the side they give the "
                 "larger win share. Each is set beside two plain rules on the same games: the home team wins, and the team "
                 "with the better record going in wins. A call marked backfilled was made before its game (the model's own "
                 "saved prediction says when) but written into this record afterwards.")
SOURCE_NAME = {"lean": "The matchups' lean", "score": "The score model's favourite", "sim": "The simulation's favourite"}
BUCKETS = (0.5, 0.6, 0.7, 0.8, 0.9, 1.0)


def _forecast_log() -> tuple[list[dict], dict] | None:
    read = getattr(_source, "forecast_log", None)
    return read() if callable(read) else None


def _iso(text) -> datetime | None:
    try:
        return _utc(datetime.fromisoformat(str(text).replace("Z", "+00:00"))) if text else None
    except ValueError:
        return None


def _outcome(res: dict | None, home: str) -> tuple[int, int, str | None] | None:
    """(home points, away points, winner) for the game whose home team is `home`, from a results entry."""
    if not res:
        return None
    hp, ap = (res["home_pts"], res["away_pts"]) if res.get("home") == home or res.get("away") != home else (res["away_pts"], res["home_pts"])
    away = res.get("away") if res.get("home") == home else res.get("home")
    return hp, ap, home if hp > ap else away if ap > hp else None


def _calls(event_id: str, data: tuple[list[dict], dict] | None) -> tuple[GameResult | None, list[PregameCall]]:
    """One game's result and what was said before it, for its page."""
    if not data:
        return None, []
    mine = [f for f in data[0] if f["event_id"] == event_id]
    if not mine:
        return None, []
    got = _outcome(data[1].get(event_id), mine[0]["home"])
    winner = got[2] if got else None
    calls = []
    for f in sorted(mine, key=lambda f: ("score", "sim", "lean").index(f["source"]) if f["source"] in ("score", "sim", "lean") else 9):
        made = _iso(f.get("made_at"))
        if made is None:
            continue
        p = f.get("p_home")
        share = None if p is None or f.get("pick") is None else round(p if f["pick"] == f["home"] else 1 - p, 3)
        calls.append(PregameCall(source=f["source"], model=f["model"], made_at=made, pick=f.get("pick"), p=share, backfilled=bool(f.get("backfilled")),
                                 right=None if not got or winner is None or f.get("pick") is None else f["pick"] == winner))
    return (GameResult(home_pts=got[0], away_pts=got[1], winner=winner) if got else None), calls


def _log_record(forecasts: list[dict], results: dict, now: datetime) -> TrackRecord:
    """The record graded from the forecast log: every game since it began, each method beside the two plain rules on
    the same games, and for a method that gives a win share, how its stated shares have turned out."""
    by: dict[str, dict[str, dict]] = {}
    for f in forecasts:
        by.setdefault(f["event_id"], {})[f["source"]] = f
    graded: dict[str, list[dict]] = {"nba": [], "nfl": []}
    waiting = {"nba": 0, "nfl": 0}
    for eid, calls in by.items():
        first = next(iter(calls.values()))
        sport, home, away = first["sport"], first["home"], first["away"]
        if sport not in graded:
            continue
        got = _outcome(results.get(eid), home)
        start = _iso((results.get(eid) or {}).get("start") or first.get("start"))
        if got is None:
            waiting[sport] += bool(start and start < now - timedelta(hours=STARTED_HOURS))
            continue
        if start is None:
            continue
        lean = calls.get("lean") or {}
        hr, ar = lean.get("home_rec"), lean.get("away_rec")

        def fav(source: str) -> tuple[str | None, float | None]:
            f = calls.get(source)
            if not f or f.get("p_home") is None:
                return None, None
            return f.get("pick"), round(max(f["p_home"], 1 - f["p_home"]), 3)

        (sp, spp), (mp, mpp) = fav("score"), fav("sim")
        graded[sport].append({
            "event_id": eid, "start": start, "home": home, "away": away, "winner": got[2], "hp": got[0], "ap": got[1],
            "lean": lean.get("pick"), "score": sp, "score_p": spp, "sim": mp, "sim_p": mpp,
            "better": None if hr is None or ar is None or hr == ar else home if hr > ar else away,
            "last_season": bool(lean.get("last_season")), "back": {k: bool(v.get("backfilled")) for k, v in calls.items()}})
    nm = lambda sport, t: nickname(sport, t) or t  # noqa: E731
    out, listed = [], []
    for sport, mine in graded.items():
        mine = [g for g in mine if g["winner"]]
        if not mine:
            continue

        def tally(source: str, pool: list[dict] | None = None, name: str | None = None) -> CallTally:
            called = [g for g in (mine if pool is None else pool) if g[source]]
            rec = [g for g in called if g["better"]]
            return CallTally(method=name or SOURCE_NAME[source], source=source, right=sum(g[source] == g["winner"] for g in called), of=len(called),
                             home_right=sum(g["home"] == g["winner"] for g in called), record_right=sum(g["better"] == g["winner"] for g in rec),
                             record_of=len(rec), backfilled=sum(g["back"].get(source, False) for g in called))

        def cal(source: str) -> Calibration | None:
            pts = [(g[f"{source}_p"], g[source] == g["winner"]) for g in mine if g[source] and g[f"{source}_p"] is not None]
            if not pts:
                return None
            buckets = []
            for lo, hi in zip(BUCKETS, BUCKETS[1:]):
                hit = [(p, w) for p, w in pts if lo <= p < hi or (hi == 1.0 and p == 1.0)]
                buckets.append(CalBucket(lo=lo, hi=hi, n=len(hit), said=round(fmean(p for p, _ in hit), 3) if hit else None,
                                         won=round(sum(w for _, w in hit) / len(hit), 3) if hit else None))
            return Calibration(method=SOURCE_NAME[source], source=source, n=len(pts), brier=round(fmean((p - w) ** 2 for p, w in pts), 3), buckets=buckets)

        with_rec = [g for g in mine if g["better"]]
        tallies = [tally("lean"), tally("score"), tally("sim"),
                   CallTally(method="Home team wins", right=sum(g["home"] == g["winner"] for g in mine), of=len(mine)),
                   CallTally(method="Better record wins", right=sum(g["better"] == g["winner"] for g in with_rec), of=len(with_rec))]
        cals = [c for c in (cal("score"), cal("sim")) if c]
        old = [g for g in mine if g["last_season"]]
        fresh = tally("lean", [g for g in mine if not g["last_season"]], "The matchups' lean, this season's numbers only")
        back = sum(any(g["back"].values()) for g in mine)
        out.append(SportRecord(
            sport=sport, games=len(mine), tallies=[t for t in tallies if t.of], brier=next((c.brier for c in cals if c.source == "sim"), None),
            last_season=len(old), this_season=fresh if old and fresh.of else None, waiting=waiting[sport], calibration=cals,
            since=min(g["start"] for g in mine), backfilled=back))
        for g in mine:
            listed.append(CalledGame(
                event_id=g["event_id"], sport=sport, label=f"{nm(sport, g['away'])} at {nm(sport, g['home'])}", start=g["start"], lean=g["lean"],
                sim_pick=g["sim"], sim_p=g["sim_p"], score_pick=g["score"], score_p=g["score_p"], winner=g["winner"],
                score=f"{nm(sport, g['away'])} {g['ap']}, {nm(sport, g['home'])} {g['hp']}", last_season=g["last_season"], backfilled=any(g["back"].values())))
    listed.sort(key=lambda g: g.start, reverse=True)
    return TrackRecord(generated_at=now, method=LOG_METHOD, sports=out, games=listed[:600], cumulative=True)


@router.get("/record", response_model=TrackRecord)
async def track_record():
    """How the site's own calls have done. Graded from the forecast log where the database carries it (every game
    since it began); otherwise from the boards themselves: each finished game's board, read as it was before the game."""
    now = datetime.now(UTC)
    data = _forecast_log()
    if data and data[0]:
        return _log_record(data[0], data[1], now)
    games: list[CalledGame] = []
    context: dict[str, tuple[str, str | None]] = {}  # event → (home team, the team with the better record going in)
    skipped = {s: {"waiting": 0, "late": 0} for s in ("nba", "nfl")}
    for sport in ("nba", "nfl"):
        league = _latest_teams(sport)
        for rep, start in _boards():
            if rep.sport != sport or start is None or start > now - timedelta(hours=STARTED_HOURS):
                continue
            if _utc(rep.created_at) > start:
                skipped[sport]["late"] += 1
                continue  # only a board that existed before its game started
            h, a = league.get(rep.home.team), league.get(rep.away.team)
            if h is None or a is None:
                continue
            met = _result_of(rep, start, h[0])
            if met is None:
                skipped[sport]["waiting"] += 1
                continue  # no final score for it yet
            sim = rep.simulation or {}
            hw = sim.get("home_win")
            aw = sim.get("away_win", None if hw is None else 1 - hw)
            winner = rep.home.team if met.result == "W" else rep.away.team if met.result == "L" else None
            hr, ar = _record_before(h[0], start), _record_before(a[0], start)
            context[rep.event_id] = (rep.home.team, None if hr is None or ar is None or hr == ar else rep.home.team if hr > ar else rep.away.team)
            games.append(CalledGame(
                event_id=rep.event_id, sport=sport, label=_label(rep), start=start,
                lean=next((f.team for f in _found(rep) if f.kind == "balance"), None),  # the verdict the game's page shows
                sim_pick=None if hw is None else rep.home.team if hw >= aw else rep.away.team,
                sim_p=None if hw is None else round(max(hw, aw), 3), winner=winner, score=_written(rep, met.score),
                last_season=any(_carried(sport, t) for t in (rep.home, rep.away))))
    out = []
    for sport in ("nba", "nfl"):
        mine = [g for g in games if g.sport == sport and g.winner]
        if not mine:
            continue

        def tally(method: str, pick, pool=None) -> CallTally:
            called = [(pick(g), g.winner) for g in (mine if pool is None else pool) if pick(g)]
            return CallTally(method=method, right=sum(p == w for p, w in called), of=len(called))

        tallies = [tally("The matchups' lean", lambda g: g.lean),
                   tally("The simulation's favourite", lambda g: g.sim_pick),
                   tally("Home team wins", lambda g: context[g.event_id][0]),
                   tally("Better record wins", lambda g: context[g.event_id][1])]
        sims = [g for g in mine if g.sim_p is not None]
        brier = round(sum((g.sim_p - (g.sim_pick == g.winner)) ** 2 for g in sims) / len(sims), 3) if sims else None
        old = [g for g in mine if g.last_season]
        fresh = tally("The matchups' lean, this season's numbers only", lambda g: g.lean, [g for g in mine if not g.last_season])
        notes = []
        if sport == "nba":
            notes.append("The NBA score model's win share (the percentage a game page leads with) is not graded here: "
                         "its pre-game predictions have not been kept long enough to score.")
        out.append(SportRecord(sport=sport, games=len(mine), tallies=[t for t in tallies if t.of], brier=brier,
                               last_season=len(old), this_season=fresh if old and fresh.of else None,
                               waiting=skipped[sport]["waiting"], late=skipped[sport]["late"], notes=notes))
    games.sort(key=lambda g: g.start, reverse=True)
    return TrackRecord(generated_at=now, sports=out, games=games[:400])


@router.get("/compare/{sport}/{home}/{away}", response_model=PublicBoard)
async def compare(sport: str, home: str, away: str):
    """Any two teams as if they met today: the same edges and findings a real game gets, from each team's newest
    identity. A what-if, not a scheduled game: it has no start and no simulation."""
    sport = _sport(sport)
    teams = _latest_teams(sport)
    h, a = teams.get(_team_key(sport, home)), teams.get(_team_key(sport, away))
    if h is None or a is None or h[0].team == a[0].team:
        raise HTTPException(404, "Not found")
    ht, at = h[0], a[0]
    nm = {ht.team: ht.name or ht.team, at.team: at.name or at.team}
    edges, pedges = _edges(sport, ht, at)
    now = datetime.now(UTC)
    rep = TacticalReport(event_id=f"{'soc' if sport == 'soccer' else sport}:compare", sport=sport, created_at=now, status="ready",
                         home=ht, away=at, matchups=edges, player_matchups=pedges)
    used = {t.trait for side in (ht, at) for t in side.traits} | {p.trait for side in (ht, at) for p in side.players}
    return PublicBoard(
        event_id=rep.event_id, sport=sport, label=f"{nm[at.team]} v {nm[ht.team]}", start=None, built_at=now, home=ht, away=at,
        matchups=edges, inferences=[], player_matchups=pedges, adjustments=[], simulation=None,
        notes=["A what-if: these teams' newest identities set against each other. Not a scheduled game."] + [_carry_note(t, r) for t, r in (h, a) if _carried(sport, t)],
        insights=_found(rep), traits=_meta(sport, used),
        mechanisms=_mechs(sport, {e.mechanism for e in edges} | {e.mechanism for e in pedges}))


@router.get("/game/{event_id}/history", response_model=PublicHistory)
async def game_history(event_id: str):
    """Earlier meetings of the two teams and each team's last games, all before this game's start (NBA and NFL)."""
    hit = await _source.extra(event_key(event_id), "history") if _source else None
    if hit is None:
        raise HTTPException(404, "Not found")
    return hit


@router.get("/game/{event_id}/tree", response_model=PublicTree)
async def game_tree(event_id: str):
    """How the game can go, as the model partitions it: who wins, who leads at the half, by how much (NBA and NFL)."""
    hit = await _source.extra(event_key(event_id), "tree") if _source else None
    if hit is None:
        raise HTTPException(404, "Not found")
    return hit
