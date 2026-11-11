"""The outermost layer of the public server: read-only methods, security headers, a generic 500."""
import json
import logging

log = logging.getLogger("ebk.shield")

METHODS = ("GET", "HEAD", "OPTIONS")
SECURITY_HEADERS: list[tuple[bytes, bytes]] = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
    (b"cross-origin-resource-policy", b"same-site"),
]
CACHE = (b"cache-control", b"public, max-age=60")


def csv(value: str) -> list[str]:
    return [x.strip() for x in value.split(",") if x.strip()]


class Shield:
    """Outermost layer (pure ASGI): refuses every method but GET / HEAD / OPTIONS before routing, adds the security
    headers to every response (and a short public cache to a 200 GET without one), and turns an unhandled error into
    a generic 500, logged here with its traceback."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = False

        async def out(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                have = {k.lower() for k, _ in message.get("headers", [])}
                extra = [h for h in SECURITY_HEADERS if h[0] not in have]
                if scope["method"] == "GET" and message["status"] == 200 and CACHE[0] not in have:
                    extra.append(CACHE)
                message = {**message, "headers": [*message.get("headers", []), *extra]}
            await send(message)

        async def answer(status: int, detail: str, headers: tuple[tuple[bytes, bytes], ...] = ()):
            body = json.dumps({"detail": detail}).encode()
            await out({"type": "http.response.start", "status": status,
                       "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
                                   *headers]})
            await out({"type": "http.response.body", "body": body})

        if scope["method"] not in METHODS:
            return await answer(405, "Method not allowed", ((b"allow", ", ".join(METHODS).encode()),))
        try:
            await self.app(scope, receive, out)
        except Exception:
            log.exception("public: unhandled error on %s %s", scope["method"], scope.get("path"))
            if not started:
                await answer(500, "Internal error")
