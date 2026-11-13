"""GET /public/{picks,records,strategies}: the PickLab section, served from stored documents, and GET /public/sources,
which also covers the analytics and so has a router of its own: a site run without PickLab (settings.picklab = false)
mounts that one alone and lists only where the analytics come from.

Each document was computed ahead of time, so these routes only choose and trim: the picks for games from today on, the
record window nearest the one asked for. A missing document is an empty answer, never an error.
"""
from __future__ import annotations

import hmac
import re
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, HTTPException, Response

from ebk.schemas import PickRecords, PublicFeed, PublicSources, PublicStrategy
from ebk.store import Store
from ebk.teams import nickname

_store: Store | None = None
_picks = True  # whether this site carries PickLab at all
_private = False  # PickLab by invitation: only a request with the key is answered
_key = ""
_ID = re.compile(r"^[a-z0-9_]{1,64}$")


def use(store: Store, picklab: bool = True, private: bool = False, key: str = "") -> None:
    global _store, _picks, _private, _key
    _store, _picks, _private, _key = store, picklab, private, key


def _let_in(given: str | None) -> bool:
    """Whether this request may read PickLab. Open unless PickLab is private; then only with the key (compared in
    constant time). Private with no key configured lets nobody in."""
    return not _private or bool(_key and given and hmac.compare_digest(given.encode(), _key.encode()))


def _gate(response: Response, x_picklab_key: str | None = Header(None)) -> None:
    if not _let_in(x_picklab_key):
        raise HTTPException(404, "Not found")  # the same answer as a site with no PickLab: nothing to find
    if _private:
        response.headers["cache-control"] = "private, no-store"  # an answer given for a key is never kept by anything between


router = APIRouter(prefix="/public", tags=["picklab"], dependencies=[Depends(_gate)])
sources_router = APIRouter(prefix="/public", tags=["sources"])


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


@sources_router.get("/sources", response_model=PublicSources)
async def sources(response: Response, x_picklab_key: str | None = Header(None)):
    """Where the numbers come from, whose picks are graded, and what the site leaves out. Without PickLab (or to a
    request that may not read it), only where the analytics come from, whatever the stored document holds."""
    doc = PublicSources.model_validate(_doc("sources") or {"sources": [], "strategies": [], "excluded": []})
    if _picks and _private:
        response.headers["cache-control"] = "private, no-store"  # two answers at one address: neither may be stored
    if (_picks and _let_in(x_picklab_key)) or not (doc.sources or doc.strategies):  # with PickLab, or a document already built without it: as stored
        return doc
    return PublicSources(data=doc.data, sources=[], strategies=[], excluded=[])
