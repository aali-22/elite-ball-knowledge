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

from ebk.teams import full_name, nickname
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


def _named(rep: TacticalReport) -> TacticalReport:
    """The board with each team's nickname where it only carried its code ("NYG" → "Giants"); findings then read as names."""
    for side in (rep.home, rep.away):
        if side and (not side.name or side.name == side.team):
            side.name = nickname(rep.sport, side.team) or side.team
    return rep


def _boards() -> list[Dated]:
    if _source is None:
        raise RuntimeError("no board source set (ebk.analytics.use)")
    return [(_named(rep), start) for rep, start in _source.boards()]


def _board(event_id: str) -> Dated | None:
    hit = _source.board(event_id) if _source else None
    return (_named(hit[0]), hit[1]) if hit else None


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
    h, a = rep.home.name or rep.home.team, rep.away.name or rep.away.team
    if rep.label and h == rep.home.team:  # no better names than the codes the label was written with
        return rep.label
    return f"{h} v {a}" if rep.sport == "soccer" else f"{a} at {h}"


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
    hit = _board(eid)
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


@router.get("/index", response_model=SearchIndex)
async def index():
    """Every team, player and game that has a page, for the site's search."""
    teams: dict[tuple[str, str], IndexTeam] = {}
    players: dict[str, IndexPlayer] = {}
    games = []
    for rep, start in _boards():
        games.append(IndexGame(sport=rep.sport, event_id=rep.event_id, label=_label(rep), start=start))
        for t in (rep.home, rep.away):
            name = t.name or t.team
            teams.setdefault((rep.sport, t.team), IndexTeam(sport=rep.sport, team=t.team, name=name, full_name=full_name(rep.sport, t.team) or name))
            for p in t.players:
                players.setdefault(p.player_id, IndexPlayer(sport=rep.sport, player_id=p.player_id, name=p.name, team=t.team,
                                                             team_name=name, position=p.position))
    games.sort(key=lambda g: (g.start is None, g.start or datetime.max.replace(tzinfo=UTC), g.label))
    return SearchIndex(teams=sorted(teams.values(), key=lambda t: (t.sport, t.full_name)),
                       players=sorted(players.values(), key=lambda p: (p.sport, p.name)), games=games[:200])


@router.get("/findings", response_model=Findings)
async def findings(sport: str | None = None, kind: str | None = None, days: int = 4, limit: int = 60):
    """Every finding on the slate's boards, strongest first, optionally one sport or one kind."""
    days, limit = max(1, min(days, 14)), max(1, min(limit, 200))
    now = datetime.now(UTC)
    lo, hi = now - timedelta(days=1), now + timedelta(days=days)
    out, kinds = [], {}
    for rep, start in _boards():
        shown = lo <= start <= hi if start else _utc(rep.created_at) >= now - timedelta(days=UNDATED_DAYS)
        if not shown or (sport and rep.sport != sport):
            continue
        for f in insights(rep):
            kinds[f.kind] = kinds.get(f.kind, 0) + 1
            if kind is None or f.kind == kind:
                out.append(Finding(event_id=rep.event_id, sport=rep.sport, label=_label(rep), start=start,
                                   home=_slate_team(rep.home, rep.sport), away=_slate_team(rep.away, rep.sport), insight=f))
    out.sort(key=lambda x: (-x.insight.score, x.event_id, x.insight.id))
    return Findings(generated_at=now, kinds=dict(sorted(kinds.items())), findings=out[:limit])


@router.get("/leaders/{sport}", response_model=Leaders)
async def leaders(sport: str, limit: int = 10):
    """The top players in each kind of production, ranked within their position, from each team's newest board."""
    sport, limit = _sport(sport), max(3, min(limit, 25))
    spec = traits(sport)
    rows: dict[tuple[str, str], dict[str, Leader]] = {}
    for t, _rep in _latest_teams(sport).values():
        for p in t.players:
            if p.rank is None or p.trait not in spec:
                continue
            rows.setdefault((p.trait, p.position), {}).setdefault(p.player_id, Leader(
                player_id=p.player_id, name=p.name, team=t.team, team_name=t.name or t.team, position=p.position, value=p.value,
                rank=p.rank, of=p.of, n=p.n))
    boards = [LeaderBoard(trait=_meta(sport, {trait})[0], position=pos, leaders=sorted(ps.values(), key=lambda x: x.rank or 10**6)[:limit])
              for (trait, pos), ps in sorted(rows.items()) if len(ps) >= 3]
    return Leaders(sport=sport, generated_at=datetime.now(UTC), boards=boards)


def _confidence(a: TraitValue, r: TraitValue, full: int) -> float:
    return round(min(1.0, (min(a.n or 0, r.n or 0)) / max(1, full)) * 0.9 + 0.1, 2) if (a.n and r.n) else 0.5


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
    by = {t.team: {v.trait: v for v in t.traits} for t in (ht, at)}
    full = {"nfl": 300, "nba": 20, "soccer": 10}[sport]
    pct = lambda v: v.adj_percentile if v.adj_percentile is not None else v.percentile  # noqa: E731
    edges = []
    for mech in mechanisms(sport).values():
        for atk, res in ((ht, at), (at, ht)):
            av, rv = by[atk.team].get(mech.attack), by[res.team].get(mech.resist)
            if av is None or rv is None or pct(av) is None or pct(rv) is None:
                continue
            edge = round(pct(av) + (1 - pct(rv)) - 1, 3)
            edges.append(MatchupEdge(mechanism=mech.id, label=mech.label, attack_team=atk.team, resist_team=res.team, attack=av,
                                     resist=rv, edge=edge, confidence=_confidence(av, rv, full), scene=mech.scene,
                                     summary=f"{nm[atk.team]} vs {nm[res.team]}: edge {nm[atk.team] if edge >= 0 else nm[res.team]} ({edge:+.2f})"))
    pedges = []
    for mech in player_mechanisms(sport).values():
        for atk, res in ((ht, at), (at, ht)):
            rv = by[res.team].get(mech.resist)
            for p in atk.players:
                if p.trait != mech.attack or p.rank is None or not p.of or (mech.position and p.position != mech.position) or rv is None or pct(rv) is None:
                    continue
                edge = round((1 - (p.rank - 1) / max(1, p.of - 1)) + (1 - pct(rv)) - 1, 3)
                pedges.append(PlayerMatchupEdge(mechanism=mech.id, label=mech.label, player_id=p.player_id, player=p.name,
                                                position=p.position, team=atk.team, opponent=res.team, attack=p, resist=rv, edge=edge,
                                                confidence=0.8, summary=f"{p.name} vs {nm[res.team]}"))
    now = datetime.now(UTC)
    rep = TacticalReport(event_id=f"{'soc' if sport == 'soccer' else sport}:compare", sport=sport, created_at=now, status="ready",
                         home=ht, away=at, matchups=edges, player_matchups=pedges)
    used = {t.trait for side in (ht, at) for t in side.traits} | {p.trait for side in (ht, at) for p in side.players}
    return PublicBoard(
        event_id=rep.event_id, sport=sport, label=f"{nm[at.team]} v {nm[ht.team]}", start=None, built_at=now, home=ht, away=at,
        matchups=edges, inferences=[], player_matchups=pedges, adjustments=[], simulation=None,
        notes=["A what-if: these teams' newest identities set against each other. Not a scheduled game."],
        insights=insights(rep), traits=_meta(sport, used),
        mechanisms=_mechs(sport, {e.mechanism for e in edges} | {e.mechanism for e in pedges}))
