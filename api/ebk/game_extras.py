"""Two more views of a game, served from stored documents: its head-to-head history and its game-state tree.

Both are built ahead of time and stored whole (ebk/store.py, keys "history:<id>" and "tree:<id>"). The shapes here
are the publishable ones: results, box-score lines and form are facts; the tree is the model's own partition of how
the game can go. Neither carries a market line or a price.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class SiteHistoryBoxColumn(BaseModel):
    key: str
    label: str
    pair: str | None = None  # shown as "key-pair" (made-attempted)


class SiteHistoryBoxLine(BaseModel):
    player_id: str
    name: str | None = None
    team: str
    position: str | None = None
    starter: bool | None = None
    played: bool = True
    stats: dict[str, float | None] = {}


class SiteHistoryMeeting(BaseModel):
    event_id: str
    date: str
    start: datetime
    season: int
    season_type: str
    home: str
    away: str
    scores: dict[str, int]  # team → points
    periods: dict[str, list[int]] = {}  # team → points per period
    overtime: bool | None = None
    neutral: bool = False
    winner: str | None = None  # None = tie
    has_box: bool = False
    source: str


class SiteHistoryFormGame(BaseModel):
    event_id: str
    date: str
    start: datetime
    opponent: str
    home: bool
    pts_for: int
    pts_against: int
    result: Literal["W", "L", "T"]
    source: str


class PublicHistory(BaseModel):
    event_id: str
    sport: str
    home: str
    away: str
    before: datetime  # nothing at or after this time is included (the game's start)
    meetings: list[SiteHistoryMeeting] = []  # newest first
    boxes: dict[str, dict[str, list[SiteHistoryBoxLine]]] = {}  # meeting id → team → lines
    columns: list[SiteHistoryBoxColumn] = []
    form: dict[str, list[SiteHistoryFormGame]] = {}  # team → its last games, newest first
    record: dict[str, int] = {}  # wins per team in the meetings listed (+ "T" for ties)


class SiteTreeNode(BaseModel):
    id: str  # path of keys, e.g. "home/half:home/m:home1"
    level: int
    parent: str | None = None
    label: str
    p: float  # joint probability of the path; per level the nodes sum to 1
    p_cond: float  # probability given the parent
    source: Literal["joint", "model", "fit"]
    n: int | None = None  # the sample behind it: simulations, or past games in this cell


class SiteTreeLevel(BaseModel):
    level: int
    key: Literal["winner", "half", "margin"]
    label: str


class SiteTreeSource(BaseModel):
    id: Literal["joint", "model", "fit"]
    label: str
    detail: str
    n: int | None = None


class PublicTree(BaseModel):
    event_id: str
    sport: str
    label: str = "Model inference: game-state tree"
    home: str = ""
    away: str = ""
    levels: list[SiteTreeLevel] = []
    nodes: list[SiteTreeNode] = []
    sources: list[SiteTreeSource] = []
    made_at: datetime | None = None


def public_history(data: dict) -> dict | None:
    """A history as the site may show it: the reference lines are dropped by the shape itself. None when it is empty."""
    h = PublicHistory.model_validate(data)
    return h.model_dump(mode="json") if (h.meetings or any(h.form.values())) else None


def public_tree(data: dict) -> dict | None:
    """A tree without its markets, its lines and the level cut at a line (the total). None when nothing is left."""
    if not data.get("available", True):
        return None
    keep = {lv["level"] for lv in data.get("levels", []) if lv.get("key") in ("winner", "half", "margin")}
    out = PublicTree.model_validate({**data, "levels": [lv for lv in data.get("levels", []) if lv["level"] in keep],
                                     "nodes": [n for n in data.get("nodes", []) if n["level"] in keep],
                                     "sources": [s for s in data.get("sources", []) if s.get("id") in ("joint", "model", "fit")]})
    return out.model_dump(mode="json") if out.nodes else None
