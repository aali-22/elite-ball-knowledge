"""The site database: one SQLite file, opened read-only, with two tables.

  board(event_id, sport, created_at, start, body)   a finished, publishable tactical board as JSON
  doc(key, body)                                    a whole PickLab response as JSON ("picks", "records:30", …)

It is written ahead of time (ebk.demo for made-up data) and only ever read here, so the server holds no credentials,
makes no outbound request and can't be made to write.
"""
from __future__ import annotations

import json
import sqlite3
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

from ebk.analytics import WINDOW_DAYS, Dated, start_of
from schemas.tactics import TacticalReport

SCHEMA = """
CREATE TABLE IF NOT EXISTS board (event_id TEXT PRIMARY KEY, sport TEXT NOT NULL, created_at TEXT NOT NULL, start TEXT, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS doc (key TEXT PRIMARY KEY, body TEXT NOT NULL);
"""


def create(path: Path) -> sqlite3.Connection:
    """A new, empty site database for a builder to fill (replaces `path`)."""
    path.unlink(missing_ok=True)
    db = sqlite3.connect(path)
    db.executescript(SCHEMA)
    return db


def put_board(db: sqlite3.Connection, rep: TacticalReport, start: datetime | None) -> None:
    db.execute("INSERT OR REPLACE INTO board VALUES (?, ?, ?, ?, ?)",
               (rep.event_id, rep.sport, _iso(rep.created_at), _iso(start) if start else None, rep.model_dump_json()))


def put_doc(db: sqlite3.Connection, key: str, body: object) -> None:
    db.execute("INSERT OR REPLACE INTO doc VALUES (?, ?)", (key, json.dumps(body, default=str)))


def _iso(d: datetime) -> str:
    return (d if d.tzinfo else d.replace(tzinfo=UTC)).astimezone(UTC).isoformat()


def _when(text: str | None) -> datetime | None:
    return datetime.fromisoformat(text) if text else None


class Store:
    """Reads the site database; parsed boards and documents are reused for `ttl` seconds."""

    def __init__(self, path: str | Path, ttl: float = 120.0):
        self.path, self.ttl = Path(path), ttl
        self._cache: dict[str, tuple[float, object]] = {}

    def _db(self) -> sqlite3.Connection:
        if not self.path.exists():
            raise FileNotFoundError(f"no site database at {self.path} (build one: python -m ebk.demo)")
        return sqlite3.connect(f"file:{self.path}?mode=ro", uri=True)

    def _cached(self, key: str, make):
        hit = self._cache.get(key)
        if hit and time.monotonic() - hit[0] < self.ttl:
            return hit[1]
        value = make()
        self._cache[key] = (time.monotonic(), value)
        return value

    def clear(self) -> None:
        self._cache.clear()

    @staticmethod
    def _dated(body: str, start: str | None) -> Dated | None:
        rep = TacticalReport.model_validate_json(body)
        if rep.status != "ready" or not rep.home or not rep.away:
            return None
        return rep, start_of(rep, _when(start))

    def boards(self) -> list[Dated]:
        def load():
            since = _iso(datetime.now(UTC) - timedelta(days=WINDOW_DAYS))
            with self._db() as db:
                rows = db.execute("SELECT body, start FROM board WHERE created_at >= ? ORDER BY created_at DESC", (since,)).fetchall()
            return [d for d in (self._dated(b, s) for b, s in rows) if d]
        return self._cached("boards", load)

    def board(self, event_id: str) -> Dated | None:
        with self._db() as db:
            row = db.execute("SELECT body, start FROM board WHERE event_id = ?", (event_id,)).fetchone()
        return self._dated(*row) if row else None

    async def extra(self, event_id: str, kind: str) -> dict | None:
        return self.doc(f"{kind}:{event_id}") if kind in ("history", "tree") else None

    def doc(self, key: str):
        """A stored document, or None."""
        def load():
            with self._db() as db:
                row = db.execute("SELECT body FROM doc WHERE key = ?", (key,)).fetchone()
            return json.loads(row[0]) if row else None
        return self._cached(f"doc:{key}", load)

    def keys(self, prefix: str) -> list[str]:
        with self._db() as db:
            return [r[0] for r in db.execute("SELECT key FROM doc WHERE key LIKE ? ORDER BY key", (prefix + "%",))]
