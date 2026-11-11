"""GET /public/analytics/*: the sports-analytics side of the site.

Every route reads finished boards from a source (`use(...)`: the site's own database in ebk/store.py) and computes the
findings of insights/engine.py from them. No outbound request, no model call: the same boards always give the same pages.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from statistics import fmean
from typing import Protocol

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from insights import Insight, insights
from schemas.tactics import (AdjustmentBranch, InferenceChain, MatchupEdge, OpponentFaced, PlayerMatchupEdge,
                             PlayerTraitValue, TacticalReport, TeamIdentity, TraitValue)
from tactics.ontology import SPORTS, mechanisms, player_mechanisms, traits

router = APIRouter(prefix="/public/analytics", tags=["analytics"])

WINDOW_DAYS = 14  # boards built in this window make the slate, the league table and the team / player pages
UNDATED_DAYS = 7  # a board saved without its game's start stays on the slate this long

Dated = tuple[TacticalReport, datetime | None]  # a finished board and its game's start, when known


class Source(Protocol):
    """Where finished boards come from."""

    def boards(self) -> list[Dated]:
        """Every ready board built in the last WINDOW_DAYS days, newest first."""

    def board(self, event_id: str) -> Dated | None:
        """One ready board by its game id, whatever its age."""


_source: Source | None = None


def use(source: Source) -> None:
    global _source
    _source = source


def _boards() -> list[Dated]:
    if _source is None:
        raise RuntimeError("no board source set (ebk.analytics.use)")
    return _source.boards()


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
    insights: list[Insight]
    traits: list[TraitMeta]
    mechanisms: list[MechanismMeta]
    method: str = ("Computed from public box scores and play-by-play before the game's start. Ranks are within the league; "
                   "schedule-adjusted ranks take out the strength of the opponents faced. Findings are written by rule "
                   "from these numbers.")


class SlateTeam(BaseModel):
    team: str
    name: str
    offense: float | None  # mean percentile of the computed offense traits (1 = best)
    defense: float | None


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
    headline: Insight | None
    findings: int


class Slate(BaseModel):
    generated_at: datetime
    games: list[SlateGame]
    sports: list[str]


class LeagueTeam(BaseModel):
    team: str
    name: str
    offense: float | None
    defense: float | None
    traits: list[TraitValue]
    as_of: datetime
    event_id: str  # the newest board the row was read from


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
    offense: float | None
    defense: float | None
    traits: list[TraitValue]
    opponents: list[OpponentFaced]
    players: list[PlayerTraitValue]
    games: list[TeamGame]
    findings: list[Insight]  # findings about this team from its newest board
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


def _utc(d: datetime | None) -> datetime | None:
    return d.replace(tzinfo=UTC) if d is not None and d.tzinfo is None else d


def event_key(raw: str) -> str:
    """'nba-20261112.401909979' or 'nba:…' → the stored id; 404 for anything that isn't a board sport."""
    head, sep, rest = raw.partition(":") if ":" in raw else raw.partition("-")
    if head not in ("nfl", "soc", "nba") or not rest or len(raw) > 64:
        raise HTTPException(404, "Not found")
    return f"{head}:{rest}"


def _sport(raw: str) -> str:
    if raw not in SPORTS:
        raise HTTPException(404, "Not found")
    return raw


def _team_key(sport: str, raw: str) -> str:
    return f"soc:{raw[4:]}" if sport == "soccer" and raw.startswith(("soc-", "soc:")) else raw


def _meta(sport: str, ids: set[str]) -> list[TraitMeta]:
    spec = traits(sport)
    return [TraitMeta(id=t.id, unit=t.unit, label=t.label, description=t.description, measure=t.measure, good_high=t.good_high)
            for t in spec.values() if t.id in ids]


def _mechs(sport: str, ids: set[str]) -> list[MechanismMeta]:
    spec = {**mechanisms(sport), **player_mechanisms(sport)}
    return [MechanismMeta(id=m.id, label=m.label, description=m.description, attack=m.attack, resist=m.resist, scene=m.scene,
                          level=m.level) for m in spec.values() if m.id in ids]


def _side(t: TeamIdentity, sport: str, unit: str) -> float | None:
    spec = traits(sport)
    ps = [(v.adj_percentile if v.adj_percentile is not None else v.percentile) for v in t.traits
          if v.trait in spec and spec[v.trait].unit == unit and v.percentile is not None]
    return round(fmean(ps), 3) if ps else None


def start_of(rep: TacticalReport, known: datetime | None = None) -> datetime | None:
    """The game's start: saved with the board, else `known`, else the day in an NBA id (nba:<yyyymmdd>.<competition>)."""
    if rep.start or known:
        return _utc(rep.start or known)
    if rep.sport == "nba":
        try:
            return datetime.strptime(rep.event_id.split(":")[1][:8], "%Y%m%d").replace(tzinfo=UTC) + timedelta(hours=23)
        except ValueError:
            return None
    return None


def _label(rep: TacticalReport) -> str:
    if rep.label:
        return rep.label
    h, a = rep.home.name or rep.home.team, rep.away.name or rep.away.team
    return f"{h} v {a}" if rep.sport == "soccer" else f"{a} @ {h}"


def _tilt(rep: TacticalReport) -> float:
    w = [(e.edge if e.attack_team == rep.home.team else -e.edge) * e.confidence for e in rep.matchups]
    total = sum(e.confidence for e in rep.matchups)
    return round(max(-1.0, min(1.0, sum(w) / total)), 3) if total else 0.0


def _slate_team(t: TeamIdentity, sport: str) -> SlateTeam:
    return SlateTeam(team=t.team, name=t.name or t.team, offense=_side(t, sport, "offense"), defense=_side(t, sport, "defense"))


@router.get("/slate", response_model=Slate)
async def slate(sport: str | None = None, days: int = 4, limit: int = 60):
    """Games with a board: those starting from a day ago through `days` ahead, soonest first; a game with no known
    start is listed by when its board was built."""
    days, limit = max(1, min(days, 14)), max(1, min(limit, 120))
    now = datetime.now(UTC)
    lo, hi = now - timedelta(days=1), now + timedelta(days=days)
    games = []
    for rep, start in _boards():
        built = _utc(rep.created_at)
        shown = lo <= start <= hi if start else built >= now - timedelta(days=UNDATED_DAYS)
        if (sport and rep.sport != sport) or not shown:
            continue
        found = insights(rep)
        sim = rep.simulation or {}
        games.append(SlateGame(event_id=rep.event_id, sport=rep.sport, label=_label(rep), start=start,
                               built_at=_utc(rep.created_at), home=_slate_team(rep.home, rep.sport),
                               away=_slate_team(rep.away, rep.sport), tilt=_tilt(rep), home_win=sim.get("home_win"),
                               headline=found[0] if found else None, findings=len(found)))
    games.sort(key=lambda g: (g.start is None, g.start or g.built_at, g.label))  # dated games first, soonest first
    return Slate(generated_at=now, games=games[:limit], sports=sorted({g.sport for g in games}))


@router.get("/game/{event_id}", response_model=PublicBoard)
async def game(event_id: str):
    eid = event_key(event_id)
    hit = _source.board(eid) if _source else None
    if hit is None or not hit[0].home or not hit[0].away:
        raise HTTPException(404, "Not found")
    rep, start = hit
    used = {t.trait for side in (rep.home, rep.away) for t in side.traits} | {p.trait for side in (rep.home, rep.away) for p in side.players}
    return PublicBoard(
        event_id=rep.event_id, sport=rep.sport, label=_label(rep), start=start,
        built_at=_utc(rep.created_at), home=rep.home, away=rep.away, matchups=rep.matchups, inferences=rep.inferences,
        player_matchups=rep.player_matchups, adjustments=rep.adjustments, simulation=rep.simulation, notes=rep.notes,
        insights=insights(rep), traits=_meta(rep.sport, used),
        mechanisms=_mechs(rep.sport, {e.mechanism for e in rep.matchups} | {e.mechanism for e in rep.player_matchups}))


def _latest_teams(sport: str) -> dict[str, tuple[TeamIdentity, TacticalReport]]:
    out: dict[str, tuple[TeamIdentity, TacticalReport]] = {}
    for rep, _ in _boards():  # newest first: the first board a team appears on is its current identity
        if rep.sport == sport:
            for t in (rep.home, rep.away):
                out.setdefault(t.team, (t, rep))
    return out


@router.get("/league/{sport}", response_model=League)
async def league(sport: str):
    """Each team's newest computed identity, for league-wide charts. Soccer mixes leagues: ranks are within each one."""
    sport = _sport(sport)
    teams = _latest_teams(sport)
    used = {v.trait for t, _ in teams.values() for v in t.traits}
    sizes = [v.of for t, _ in teams.values() for v in t.traits if v.of]
    return League(sport=sport, generated_at=datetime.now(UTC), traits=_meta(sport, used),
                  of=max(set(sizes), key=sizes.count) if sizes else None,
                  teams=sorted((LeagueTeam(team=t.team, name=t.name or t.team, offense=_side(t, sport, "offense"),
                                           defense=_side(t, sport, "defense"), traits=t.traits, as_of=_utc(rep.created_at),
                                           event_id=rep.event_id) for t, rep in teams.values()), key=lambda x: x.name))


@router.get("/team/{sport}/{team}", response_model=TeamPage)
async def team(sport: str, team: str):
    sport = _sport(sport)
    key = _team_key(sport, team)
    hit = _latest_teams(sport).get(key)
    if hit is None:
        raise HTTPException(404, "Not found")
    t, newest = hit
    games = []
    for rep, start in _boards():
        if rep.sport != sport or key not in (rep.home.team, rep.away.team):
            continue
        home = rep.home.team == key
        opp = rep.away if home else rep.home
        found = insights(rep)
        games.append(TeamGame(event_id=rep.event_id, label=_label(rep), start=start, opponent=opp.team,
                              opponent_name=opp.name or opp.team, home=home, headline=found[0] if found else None))
    return TeamPage(sport=sport, team=t.team, name=t.name or t.team, as_of=_utc(newest.created_at),
                    offense=_side(t, sport, "offense"), defense=_side(t, sport, "defense"), traits=t.traits,
                    opponents=t.opponents, players=t.players, games=games[:12],
                    findings=[f for f in insights(newest, limit=30) if f.team == key][:8],
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
    for rep, _ in _boards():
        if rep.sport != sport:
            continue
        for t in (rep.home, rep.away):
            mine = [p for p in t.players if p.player_id == pid]
            if mine and newest is None:
                newest, side, rows = rep, t, mine
        edges += [e for e in rep.player_matchups if e.player_id == pid]
    if newest is None or side is None:
        raise HTTPException(404, "Not found")
    seen, uniq = set(), []
    for e in edges:  # one row per opponent and mechanism, from the newest board that has it
        if (e.opponent, e.mechanism) not in seen:
            seen.add((e.opponent, e.mechanism))
            uniq.append(e)
    return PlayerPage(player_id=pid, name=rows[0].name, sport=sport, team=side.team, team_name=side.name or side.team,
                      position=rows[0].position, as_of=_utc(newest.created_at), traits=rows, matchups=uniq[:24],
                      trait_meta=_meta(sport, {p.trait for p in rows} | {e.resist.trait for e in uniq}))
