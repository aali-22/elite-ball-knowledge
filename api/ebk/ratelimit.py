"""In-process sliding-window rate limiting (no dependency, one worker): the window itself and a whole-app per-IP
middleware. Counters live in memory, so a restart clears them."""
from __future__ import annotations

import json
import math
import time
from collections import deque
from collections.abc import Callable

MAX_KEYS = 20_000  # per limiter: idle keys are pruned past this, then the oldest dropped


class Limiter:
    """At most `limit` hits per key in any `window_s` seconds."""

    def __init__(self, limit: int, window_s: float, max_keys: int = MAX_KEYS):
        self.limit, self.window_s, self.max_keys = limit, window_s, max_keys
        self._hits: dict[str, deque[float]] = {}

    def wait(self, key: str, now: float | None = None) -> float | None:
        """Seconds until `key` may hit again, or None when it may now. Records nothing."""
        now = time.monotonic() if now is None else now
        q = self._hits.get(key)
        if q is None:
            return None if self.limit > 0 else self.window_s
        while q and q[0] <= now - self.window_s:
            q.popleft()
        if not q:
            del self._hits[key]
        if len(q) < self.limit:
            return None
        return max(q[0] + self.window_s - now, 0.001)

    def hit(self, key: str, now: float | None = None) -> float | None:
        """None = allowed (and counted), else seconds until retry (not counted)."""
        now = time.monotonic() if now is None else now
        wait = self.wait(key, now)
        if wait is not None:
            return wait
        if key not in self._hits and len(self._hits) >= self.max_keys:
            self._prune(now)
        self._hits.setdefault(key, deque()).append(now)
        return None

    def _prune(self, now: float) -> None:
        for k in [k for k, q in self._hits.items() if not q or q[-1] <= now - self.window_s]:
            del self._hits[k]
        for k in list(self._hits)[: max(0, len(self._hits) - self.max_keys + 1)]:  # still full: oldest keys go
            del self._hits[k]

    def reset(self) -> None:
        self._hits.clear()

    def __len__(self) -> int:
        return len(self._hits)


_middlewares: list[RateLimitMiddleware] = []


def reset() -> None:
    """Forget every middleware counter (tests)."""
    for m in _middlewares:
        m.reset()


def first_hop(forwarded: str | None, peer: str | None, trust: bool) -> str:
    """The peer address; the first X-Forwarded-For hop only behind a proxy we run (`trust`)."""
    if forwarded and trust:
        return forwarded.split(",")[0].strip() or peer or "unknown"
    return peer or "unknown"


def retry(wait: float) -> str:
    return str(max(1, math.ceil(wait)))


class RateLimitMiddleware:
    """Whole-app per-IP limit (pure ASGI): `per_minute` requests a minute and `burst` per 10 s, else a JSON 429."""

    def __init__(self, app, per_minute: int = 120, burst: int = 40, trust_proxy: bool | Callable[[], bool] = False):
        self.app, self.trust_proxy = app, trust_proxy
        self.minute, self.burst = Limiter(per_minute, 60.0), Limiter(burst, 10.0)
        _middlewares.append(self)

    def reset(self) -> None:
        self.minute.reset()
        self.burst.reset()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        fwd = next((v.decode("latin-1") for k, v in scope.get("headers", []) if k == b"x-forwarded-for"), None)
        trust = self.trust_proxy() if callable(self.trust_proxy) else self.trust_proxy
        ip = first_hop(fwd, (scope.get("client") or [None])[0], trust)
        waits = [w for lim in (self.burst, self.minute) if (w := lim.wait(ip)) is not None]
        if not waits:
            self.burst.hit(ip)
            self.minute.hit(ip)
            return await self.app(scope, receive, send)
        body = json.dumps({"detail": "Too many requests"}).encode()
        await send({"type": "http.response.start", "status": 429,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
                                (b"retry-after", retry(max(waits)).encode())]})
        await send({"type": "http.response.body", "body": body})
