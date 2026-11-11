"""Tactical ontology: what a team is (identity traits), how two teams meet (mechanisms), and who says so (claims).

Sport-agnostic types; the closed vocabularies live in api/tactics/vocab_<sport>.py. Every value carries its source:
a computed stat, an analyst's reasoning stored with an expert pick, or AI research with a link. Nothing is unsourced.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Unit = Literal["offense", "defense", "special", "situation", "coach", "player"]
SourceKind = Literal["stat", "analyst", "ai_research", "interview"]
Intent = Literal["adjusting", "injury", "personnel", "scheme"]
ClaimStatus = Literal["verified", "unverified", "disputed", "inconsistent"]


class TraitSpec(BaseModel):
    """One identity dimension in a sport's closed vocabulary."""
    id: str  # "nfl.def.long_td_share_allowed"
    sport: str
    unit: Unit
    label: str
    description: str
    measure: str  # "rate", "per play", "EPA/play", "yards", "share", "text"
    good_high: bool = True  # for the team that owns the trait (a defense: lower EPA allowed is good → False)
    stat: bool = True  # computable from free data; False = analyst/AI-sourced only (scheme, play-caller)


class MechanismSpec(BaseModel):
    """How an offense trait meets a defense trait: the unit of a tactical matchup, drawn on the board as `scene`."""
    id: str  # "nfl.explosive_pass"
    sport: str
    label: str
    description: str
    attack: str  # trait id of the side with the ball
    resist: str  # trait id of the side without it
    scene: str  # board template (web/components/tactics/scenes)
    weight: float = 1.0  # rough importance for scoring; documented, not fitted
    vulnerable: list[str] = []  # claim directions that make the *resisting* side weak here (a "high" line vs runs in behind)
    # M6: "player" = a player trait (PlayerTraitValue) against the opponent's team trait; `position` limits the
    # attacking players (NFL "TE", NBA "G"; None = any); `markets` = the Tracker markets the edge speaks to
    level: Literal["team", "player"] = "team"
    position: str | None = None
    markets: list[str] = []


class ClaimSource(BaseModel):
    kind: SourceKind
    site: str | None = None
    author: str | None = None
    url: str | None = None
    published_at: datetime | None = None
    ref: str | None = None  # stat: "nflverse pbp 2026 wk1–6 (n=412 dropbacks)"; analyst: FeedPick id; interview: news item id
    role: str | None = None  # interview: coach / player / staff / analyst (author = the speaker)


Source = ClaimSource  # short names inside tactics/; API schema names stay unique ("ClaimSource", "TacticalClaim")


class TraitValue(BaseModel):
    trait: str
    team: str
    value: float | None = None
    text: str | None = None  # non-numeric traits ("outside zone", "Klint Kubiak")
    rank: int | None = None  # 1 = best for that team in the league
    of: int | None = None
    percentile: float | None = None  # 0..1, 1 = best for the team
    n: int | None = None  # plays/drives/games behind it
    sources: list[Source] = []
    # Schedule-adjusted (tactics/schedule.py): the value with the opponents' average deviation from league average
    # on the mirror trait taken out, ranked again; sos = average strength (percentile, 1 = best) of the opponents'
    # mirror trait faced, ranked 1 = hardest schedule. None when there is no mirror trait or no schedule.
    adj_value: float | None = None
    adj_rank: int | None = None
    adj_percentile: float | None = None
    sos: float | None = None
    sos_rank: int | None = None


class PlayerTraitValue(BaseModel):
    """M4: one player's trait (receiving yards per game, target share…), ranked within its position among players who
    played at least half their team's games before the cutoff. rank 1 = most; n = games behind it."""
    player_id: str  # "nfl:00-0036322"
    name: str
    team: str
    position: str  # "WR", "TE", "RB"
    trait: str  # "nfl.player.rec_yds"
    value: float
    rank: int | None = None  # None when the player isn't qualified (fewer than half the team's games)
    of: int | None = None
    n: int  # games
    sources: list[Source] = []


class TacticalClaim(BaseModel):
    """One statement from analysis, mapped onto the vocabulary. Numbers are checked against computed stats."""
    team: str  # team the claim is about (abbr / soc:id)
    trait: str | None = None  # a TraitSpec id, or None when only a mechanism/situation is named
    mechanism: str | None = None
    direction: Literal["strong", "weak", "high", "low", "neutral"] = "neutral"
    value: float | None = None
    rank: int | None = None
    text: str  # paraphrase, never the article verbatim
    quote: str | None = Field(None, max_length=140)  # ≤ 15 words, optional
    source: Source
    status: ClaimStatus = "unverified"
    intent: Intent | None = None  # interviews: what the speaker signals ("we're adjusting the run fits")
    check: str | None = None  # why verified / disputed ("stat says 7th of 32", "names a team not in this game")


Claim = TacticalClaim


class MatchupEdge(BaseModel):
    mechanism: str
    label: str
    attack_team: str
    resist_team: str
    attack: TraitValue | None = None
    resist: TraitValue | None = None
    edge: float  # −1..1: + favours the attacking team (percentile gap, signed)
    confidence: float  # 0..1: sample size and agreement of claims
    claims: list[Claim] = []
    scene: str
    summary: str


class OpponentFaced(BaseModel):
    """One game already played this season (before the cutoff), for the opponents-faced strip."""
    opponent: str
    name: str | None = None
    date: datetime | None = None
    home: bool | None = None
    score: str | None = None  # "24-17", own score first
    result: Literal["W", "D", "L"] | None = None
    strength: float | None = None  # opponent's overall percentile (1 = best team in the league)
    rank: int | None = None


class TeamIdentity(BaseModel):
    team: str
    name: str | None = None
    traits: list[TraitValue] = []
    claims: list[Claim] = []
    opponents: list[OpponentFaced] = []
    players: list[PlayerTraitValue] = []  # M4 (NFL): the team's main RB/WR/TE production before kickoff


class InferenceStep(BaseModel):
    """One fact in a chain. Numbers only from the report's own traits, opponents or claims (rule 10)."""
    text: str
    trait: str | None = None
    team: str | None = None
    value: float | None = None
    rank: int | None = None
    of: int | None = None
    n: int | None = None
    source: Source | None = None


class InferenceLean(BaseModel):
    market: str  # "nfl_spread", "nfl_total", "soccer_ml", "soccer_total"
    side: str  # team code, or "over" / "under"


class InferenceChain(BaseModel):
    """Deterministic reasoning (tactics/inference.py): facts → so-what. Inference, never a source."""
    kind: Literal["schedule_inflated", "schedule_hidden", "schedule_confirmed", "mismatch", "total", "form", "analyst_vs_stats", "watch"]
    team: str  # the team the conclusion is about
    title: str
    steps: list[InferenceStep]
    conclusion: str
    lean: InferenceLean | None = None
    strength: float  # 0..1: how big the effect is
    confidence: float  # 0..1: samples behind it


class PlayerMatchupEdge(BaseModel):
    """M6: one player's trait against the opposing defense's trait (tactics/matchup.player_edges). Same formula as a
    team edge: player percentile (from the position rank) + (1 − defense percentile) − 1, + favours the player.
    Descriptive (weight 0): never a Strategy-lab angle or an inference lean until backtested."""
    mechanism: str
    label: str
    player_id: str
    player: str  # name
    position: str
    team: str  # the player's team
    opponent: str  # the resisting defense
    attack: PlayerTraitValue
    resist: TraitValue
    edge: float  # −1..1
    confidence: float  # 0..1: the player's games and the defense's sample
    markets: list[str] = []
    summary: str


class BranchMarket(BaseModel):
    """A market on one side of an adjustment question; player_id None = a team market (the QB's passing yards)."""
    market: str  # Tracker market id: "nfl_rec_yds", "nba_assists"
    side: Literal["over", "under"]
    player_id: str | None = None
    player: str | None = None
    team: str


class AdjustmentBranch(BaseModel):
    """M6: a "will they adjust" fork (tactics/inference.adjustment_branches), by rule from the player edges and team traits.
    `if_branch` = the adjustment the defense could make, `then_branch` = what it opens; `markets_each_side` names the
    markets on each side of the question ("no_adjust": the edge holds, "adjust": what the adjustment opens).
    Inference, never a source; every number sits in `trait_refs` (rule 10)."""
    question: str
    team: str  # the side that would adjust (the defense)
    opponent: str  # the side the question is about
    player_id: str | None = None
    mechanism: str
    if_branch: str
    then_branch: str
    trait_refs: list[InferenceStep] = []
    markets_each_side: dict[str, list[BranchMarket]] = {}
    confidence: float  # 0..1: the edge's confidence; lower when the adjustment's own evidence is thin


class TacticalReport(BaseModel):
    event_id: str
    sport: str
    created_at: datetime
    status: Literal["building", "ready", "failed"] = "building"
    start: datetime | None = None  # the game's start and "AWAY @ HOME" label, saved with the board so a reader needs no lookup
    label: str | None = None
    stage: str | None = None  # "stats", "claims", "research", "matchups", "inference", "simulation"
    error: str | None = None
    home: TeamIdentity | None = None
    away: TeamIdentity | None = None
    matchups: list[MatchupEdge] = []
    inferences: list[InferenceChain] = []
    player_matchups: list[PlayerMatchupEdge] = []  # M6
    adjustments: list[AdjustmentBranch] = []  # M6
    simulation: dict | None = None  # NFL drive sim output / soccer tilted model
    engine: str | None = None  # how the board was built ("stats + rules", …)
    notes: list[str] = []
