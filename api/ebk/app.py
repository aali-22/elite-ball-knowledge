"""The site's API server: `uvicorn ebk.app:app --port 8030` from api/.

Read-only by construction. It serves two things from one SQLite file opened read-only (ebk/store.py): finished tactical
boards with the findings computed from them, and the PickLab documents. It has no write route, no credentials, no
outbound request and no model call. Around the routes: GET / HEAD / OPTIONS only, a per-IP rate limit, security
headers, an allowlist of Host headers and CORS origins, and a generic 500 that never carries a traceback.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from ebk import analytics, picklab
from ebk.ratelimit import RateLimitMiddleware
from ebk.settings import Settings, get_settings
from ebk.shield import Shield, csv
from ebk.store import Store


def create_app(settings: Settings | None = None) -> FastAPI:
    s = settings or get_settings()
    store = Store(s.site_db, ttl=s.cache_seconds)
    analytics.use(store)
    picklab.use(store, s.picklab, s.picklab_private, s.picklab_key)
    app = FastAPI(title="Elite Ball Knowledge", docs_url=None, redoc_url=None, openapi_url=None)
    app.include_router(analytics.router)
    app.include_router(picklab.sources_router)
    if s.picklab:  # the analytics alone otherwise: the picks routes are not there to be asked
        app.include_router(picklab.router)

    @app.get("/health", include_in_schema=False)
    async def health():
        """Up, and how old the data is: when the site database was built (None for a database with no stamp)."""
        return {"ok": True, "built_at": (store.doc("meta") or {}).get("built_at"), "picklab": s.picklab,
                "picklab_private": s.picklab and s.picklab_private}

    @app.get("/public/meta", include_in_schema=False)
    async def meta():
        """How fresh the site's data is, for the line every page shows: when the database was built, and each league's
        newest board."""
        return {"built_at": (store.doc("meta") or {}).get("built_at"), "boards": store.newest()}

    # added innermost first: Shield → trusted hosts → rate limit → CORS → routes
    if origins := csv(s.public_origin):
        app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET"], allow_credentials=False)
    app.add_middleware(RateLimitMiddleware, per_minute=s.public_rate_per_min, burst=s.public_burst, trust_proxy=s.trust_proxy)
    if hosts := csv(s.public_hosts):
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)
    app.add_middleware(Shield)
    app.state.store = store
    return app


app = create_app()
