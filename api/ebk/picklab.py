"""GET /public/{picks,records,strategies,sources}: the PickLab section, served from stored documents.

Each document was computed ahead of time, so these routes only choose and trim: the picks for games from today on, the
record window nearest the one asked for. A missing document is an empty answer, never an error.
"""
from __future__ import annotations

import re
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException

from ebk.schemas import PickRecords, PublicFeed, PublicSources, PublicStrategy
from ebk.store import Store
from ebk.teams import nickname

router = APIRouter(prefix="/public", tags=["picklab"])
_store: Store | None = None
_ID = re.compile(r"^[a-z0-9_]{1,64}$")


def use(store: Store) -> None:
    global _store
    _store = store


def _doc(key: str):
    return _store.doc(key) if _store else None


def _today(tz: str | None) -> datetime:
    try:
        zone = ZoneInfo(tz or "UTC")
    except (ValueError, OSError, ZoneInfoNotFoundError):
        raise HTTPException(400, "Unknown time zone") from None
    return datetime.combine(datetime.now(UTC).astimezone(zone).date(), time(0), zone).astimezone(UTC)


@router.get("/picks", response_model=PublicFeed)
async def picks(sport: str | None = None, tz: str | None = None, days: int = 7, back: int = 0):
    """Games from `back` days ago (0..3: finished games with graded picks) through `days` ahead, with analysts' picks,
    one row per bet. Days start at midnight in `tz`."""
    today = _today(tz)
    since = today - timedelta(days=max(0, min(back, 3)))
    until = today + timedelta(days=max(1, min(days, 14)))
    feed = PublicFeed.model_validate(_doc("picks") or {"generated_at": datetime.now(UTC), "since": since, "games": [], "sites": []})
    feed.since = since
    feed.games = [g for g in feed.games if since <= g.start < until and (not sport or g.sport == sport)]
    for g in feed.games:  # a document stored before names were added still reads as names
        g.away_name = g.away_name or nickname(g.sport, g.away) or g.away
        g.home_name = g.home_name or nickname(g.sport, g.home) or g.home
    return feed


@router.get("/records", response_model=PickRecords)
async def records(sport: str | None = None, days: int = 30):
    """Analysts' graded records over the stored window nearest `days` (per sport where that was stored)."""
    days = max(1, min(days, 120))
    prefix = f"records:{sport}:" if sport and _ID.match(sport) else "records:all:"
    have = sorted(int(k.rsplit(":", 1)[1]) for k in (_store.keys(prefix) if _store else []))
    if not have:
        return PickRecords(since=datetime.now(UTC) - timedelta(days=days), sites=[], experts=[], markets=[])
    return _doc(f"{prefix}{min(have, key=lambda d: (abs(d - days), d))}")


@router.get("/strategies", response_model=list[PublicStrategy])
async def strategies():
    """Paper strategies (single bets, one flat unit each) with their records."""
    return _doc("strategies") or []


@router.get("/strategies/{strategy_id}", response_model=PublicStrategy)
async def strategy(strategy_id: str):
    hit = _doc(f"strategy:{strategy_id}") if _ID.match(strategy_id) else None
    if hit is None:
        raise HTTPException(404, "Not found")
    return hit


@router.get("/sources", response_model=PublicSources)
async def sources():
    """Where the numbers come from, whose picks are graded, and what the site leaves out."""
    return _doc("sources") or PublicSources(sources=[], strategies=[], excluded=[])
