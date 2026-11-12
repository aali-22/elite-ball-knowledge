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
    away_win: float | None = None
    headline: Insight | None
    findings: int
    time_tbd: bool = False
    lean: str | None = None  # the team the whole-board verdict names, None for an even board (the card says what the page says)


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


def _headline(rep: TacticalReport, found: list[Insight], tilt: float) -> Insight | None:
    """The finding a game's card leads with: the strongest one about the side the board leans to, so the card's sentence
    and its lean never point opposite ways; on an even board, simply the strongest."""
    if not found:
        return None
    if abs(tilt) >= 0.06:
        lean = rep.home.team if tilt > 0 else rep.away.team
        mine = [f for f in found if f.team == lean and f.kind in ("mismatch", "star", "hidden", "sim", "balance")]
        return mine[0] if mine else next((f for f in found if f.kind == "balance"), found[0])
    return next((f for f in found if f.kind != "balance"), found[0])


def _slate_team(t: TeamIdentity, sport: str) -> SlateTeam:
    return SlateTeam(team=t.team, name=t.name or t.team, offense=_side(t, sport, "offense"), defense=_side(t, sport, "defense"))


@router.get("/slate", response_model=Slate)
async def slate(sport: str | None = None, days: int = 4, limit: int = 60):
    """Games with a board: those starting from a day ago through `days` ahead, soonest first; a game with no known
    start is listed by when its board was built."""
    days, limit = max(1, min(days, 14)), max(1, min(limit, 120))
    now = datetime.now(UTC)
    lo, hi = now - timedelta(hours=STARTED_HOURS), now + timedelta(days=days)
    games, leagues = [], {}
    starts = [st for _, st in _boards()]
    for rep, start in _boards():
        built = _utc(rep.created_at)
        shown = lo <= start <= hi if start else built >= now - timedelta(days=UNDATED_DAYS)
        if (sport and rep.sport != sport) or not shown:
            continue
        rep = _current(rep, start, leagues)
        found = _found(rep)
        sim = rep.simulation or {}
        tilt = _tilt(rep)
        games.append(SlateGame(event_id=rep.event_id, sport=rep.sport, label=_label(rep), start=start,
                               built_at=_utc(rep.created_at), home=_slate_team(rep.home, rep.sport),
                               away=_slate_team(rep.away, rep.sport), tilt=tilt, home_win=sim.get("home_win"), away_win=sim.get("away_win", None if sim.get("home_win") is None else round(1 - sim["home_win"], 4)),
                               headline=_headline(rep, found, tilt), findings=sum(f.kind != "balance" for f in found),
                               time_tbd=_tbd(rep.sport, start, starts),
                               lean=next((f.team for f in found if f.kind == "balance"), None)))
    games.sort(key=lambda g: (g.start is None, g.start or g.built_at, g.label))  # dated games first, soonest first
    return Slate(generated_at=now, games=games[:limit], sports=sorted({g.sport for g in games}))


@router.get("/game/{event_id}", response_model=PublicBoard)
async def game(event_id: str):
    eid = event_key(event_id)
    hit = _board(eid)
    if hit is None or not hit[0].home or not hit[0].away:
        raise HTTPException(404, "Not found")
    rep, start = hit
    rep = _current(rep, start)
    used = {t.trait for side in (rep.home, rep.away) for t in side.traits} | {p.trait for side in (rep.home, rep.away) for p in side.players}
    return PublicBoard(
        event_id=rep.event_id, sport=rep.sport, label=_label(rep), start=start,
        built_at=_utc(rep.created_at), home=rep.home, away=rep.away, matchups=rep.matchups, inferences=rep.inferences,
        player_matchups=rep.player_matchups, adjustments=rep.adjustments, simulation=rep.simulation, notes=rep.notes,
        insights=_found(rep), rest=_rest(rep, start), time_tbd=_tbd(rep.sport, start, [st for _, st in _boards()]), traits=_meta(rep.sport, used),
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
    copies = {k: (t.model_copy(update={"traits": [v.model_copy() for v in t.traits], "players": _this_season(t)}), rep) for k, (t, rep) in teams.items()}
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


def _tbd(sport: str, start: datetime | None, starts: list[datetime | None]) -> bool:
    """An NBA day whose games all share one early tip (three or more at the same minute, before 7 pm Eastern) is a
    schedule placeholder, not four simultaneous tips: the day is right, the time isn't known yet."""
    if sport != "nba" or start is None:
        return False
    same = sum(1 for x in starts if x == start)
    return same >= 3 and start.astimezone(UTC).hour == 23 and start.minute == 0


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
    clean = lambda x: _BARE_RANK.sub("", _RANK_ASIDE.sub("", x))  # noqa: E731
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
    lean: str | None  # the side the matchups leaned to, None when the board was even
    sim_pick: str | None  # the simulation's favourite where there was a simulation
    sim_p: float | None
    winner: str | None  # None for a tie
    score: str  # written in the label's order: "Thunder 103, Trail Blazers 123"


class CallTally(BaseModel):
    method: str
    right: int
    of: int


class SportRecord(BaseModel):
    sport: str
    games: int
    tallies: list[CallTally]
    brier: float | None = None  # the simulation's mean squared error on its win share (0.25 = a coin flip)


class TrackRecord(BaseModel):
    generated_at: datetime
    method: str = ("Every game whose breakdown was built before it started and whose final score is known. A call is "
                   "the team the board pointed to, graded against who won. Two plain rules sit beside it for scale: "
                   "the home team wins, and the team with the better record going in wins. Retrospective, and small.")
    sports: list[SportRecord]
    games: list[CalledGame]


EVEN = 0.03  # a tilt under this is an even board, the same cut the game cards use


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


@router.get("/record", response_model=TrackRecord)
async def track_record():
    """How the site's own calls have done: each finished game's board, read as it was before the game, against the result."""
    now = datetime.now(UTC)
    games: list[CalledGame] = []
    context: dict[str, tuple[str, str | None]] = {}  # event → (home team, the team with the better record going in)
    for sport in ("nba", "nfl"):
        league = _latest_teams(sport)
        for rep, start in _boards():
            if rep.sport != sport or start is None or start > now - timedelta(hours=STARTED_HOURS) or _utc(rep.created_at) > start:
                continue  # only a board that existed before its game started
            h, a = league.get(rep.home.team), league.get(rep.away.team)
            if h is None or a is None:
                continue
            met = [o for o in h[0].opponents if o.opponent == rep.away.team and o.result and o.date
                   and abs((_utc(o.date) - start).total_seconds()) < 36 * 3600]
            if not met:
                continue  # no final score for it yet
            tilt, sim = _tilt(rep), rep.simulation or {}
            hw = sim.get("home_win")
            aw = sim.get("away_win", None if hw is None else 1 - hw)
            winner = rep.home.team if met[0].result == "W" else rep.away.team if met[0].result == "L" else None
            hr, ar = _record_before(h[0], start), _record_before(a[0], start)
            context[rep.event_id] = (rep.home.team, None if hr is None or ar is None or hr == ar else rep.home.team if hr > ar else rep.away.team)
            games.append(CalledGame(
                event_id=rep.event_id, sport=sport, label=_label(rep), start=start,
                lean=None if abs(tilt) < EVEN else rep.home.team if tilt > 0 else rep.away.team,
                sim_pick=None if hw is None else rep.home.team if hw >= aw else rep.away.team,
                sim_p=None if hw is None else round(max(hw, aw), 3), winner=winner, score=_written(rep, met[0].score)))
    out = []
    for sport in ("nba", "nfl"):
        mine = [g for g in games if g.sport == sport and g.winner]
        if not mine:
            continue

        def tally(method: str, pick) -> CallTally:
            called = [(pick(g), g.winner) for g in mine if pick(g)]
            return CallTally(method=method, right=sum(p == w for p, w in called), of=len(called))

        tallies = [tally("The matchups' lean", lambda g: g.lean),
                   tally("The simulation's favourite", lambda g: g.sim_pick),
                   tally("Home team wins", lambda g: context[g.event_id][0]),
                   tally("Better record wins", lambda g: context[g.event_id][1])]
        sims = [g for g in mine if g.sim_p is not None]
        brier = round(sum((g.sim_p - (g.sim_pick == g.winner)) ** 2 for g in sims) / len(sims), 3) if sims else None
        out.append(SportRecord(sport=sport, games=len(mine), tallies=[t for t in tallies if t.of], brier=brier))
    games.sort(key=lambda g: g.start, reverse=True)
    return TrackRecord(generated_at=now, sports=out, games=games[:60])


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
