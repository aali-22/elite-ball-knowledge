"""The site server (ebk/): read-only, hardened, and complete on the invented demo database."""
from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from ebk import demo, ratelimit
from ebk.app import create_app
from ebk.settings import Settings


@pytest.fixture(scope="module")
def site(tmp_path_factory):
    path = tmp_path_factory.mktemp("site") / "site.db"
    counts = demo.build(path, seed=7)
    assert counts == {"nba": 6, "nfl": 6, "soccer": 5}
    return path


@pytest.fixture
def client(site):
    ratelimit.reset()
    return TestClient(create_app(Settings(site_db=str(site), public_rate_per_min=10_000, public_burst=10_000)))


def test_demo_database_is_reproducible(site, tmp_path):
    now = datetime(2026, 1, 5, 12, tzinfo=UTC)
    a, b = tmp_path / "a.db", tmp_path / "b.db"
    demo.build(a, seed=3, now=now)
    demo.build(b, seed=3, now=now)
    dump = lambda p: sqlite3.connect(p).execute("SELECT group_concat(body, '') FROM (SELECT body FROM board ORDER BY event_id)").fetchone()[0]  # noqa: E731
    assert dump(a) == dump(b)
    tables = {r[0] for r in sqlite3.connect(site).execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert tables == {"board", "doc"}


def test_slate_game_league_team_player(client):
    slate = client.get("/public/analytics/slate").json()
    assert len(slate["games"]) == 17 and slate["sports"] == ["nba", "nfl", "soccer"]
    starts = [g["start"] for g in slate["games"]]
    assert starts == sorted(starts)
    for sport in slate["sports"]:
        g = next(x for x in slate["games"] if x["sport"] == sport)
        assert g["headline"] and -1 <= g["tilt"] <= 1
        board = client.get(f"/public/analytics/game/{g['event_id'].replace(':', '-')}").json()
        assert board["insights"] and board["matchups"] and board["traits"] and board["mechanisms"]
        assert all(m["claims"] == [] for m in board["matchups"])
        kinds = {i["kind"] for i in board["insights"]}
        assert "balance" in kinds and ("sim" in kinds) == (sport == "nfl")
        # every rank a finding quotes is a rank on the board
        ranks = {t[k] for side in ("home", "away") for t in board[side]["traits"] for k in ("rank", "adj_rank")}
        ranks |= {p["rank"] for side in ("home", "away") for p in board[side]["players"]} | {t["sos_rank"] for side in ("home", "away") for t in board[side]["traits"]}
        assert all(n["rank"] in ranks for i in board["insights"] for n in i["numbers"] if n["rank"] is not None)
        league = client.get(f"/public/analytics/league/{sport}").json()
        assert {t["team"] for t in league["teams"]} >= {g["home"]["team"], g["away"]["team"]}
        team = client.get(f"/public/analytics/team/{sport}/{g['home']['team'].replace(':', '-')}").json()
        assert team["traits"] and team["games"][0]["event_id"] == g["event_id"]
        if team["players"]:
            pid = team["players"][0]["player_id"]
            player = client.get(f"/public/analytics/player/{pid.replace(':', '-')}").json()
            assert player["player_id"] == pid and player["team"] == g["home"]["team"]


def test_search_findings_leaders_compare(client):
    idx = client.get("/public/analytics/index").json()
    assert len(idx["teams"]) == 34 and len(idx["games"]) == 17 and idx["players"]
    assert all(t["name"] and t["full_name"] for t in idx["teams"])
    fd = client.get("/public/analytics/findings").json()
    assert fd["findings"] and sum(fd["kinds"].values()) >= len(fd["findings"])
    scores = [f["insight"]["score"] for f in fd["findings"]]
    assert scores == sorted(scores, reverse=True)
    only = client.get("/public/analytics/findings", params={"sport": "nfl", "kind": "sim"}).json()["findings"]
    assert only and {f["sport"] for f in only} == {"nfl"} and {f["insight"]["kind"] for f in only} == {"sim"}
    boards = client.get("/public/analytics/leaders/nba").json()["boards"]
    assert boards and all([x["rank"] for x in b["leaders"]] == sorted(x["rank"] for x in b["leaders"]) for b in boards)
    a, b = [t["team"] for t in idx["teams"] if t["sport"] == "nba"][:2]
    cmp = client.get(f"/public/analytics/compare/nba/{a}/{b}").json()
    assert cmp["home"]["team"] == a and cmp["away"]["team"] == b and cmp["matchups"] and cmp["insights"] and cmp["start"] is None
    # the same formula as a real board: attack percentile + (1 - resist percentile) - 1
    e = cmp["matchups"][0]
    pct = lambda t: t["adj_percentile"] if t["adj_percentile"] is not None else t["percentile"]  # noqa: E731
    assert abs(e["edge"] - (pct(e["attack"]) + (1 - pct(e["resist"])) - 1)) < 0.002
    assert client.get(f"/public/analytics/compare/nba/{a}/{a}").status_code == 404


def test_history_and_tree(client):
    games = client.get("/public/analytics/slate").json()["games"]
    for sport in ("nba", "nfl"):
        g = next(x for x in games if x["sport"] == sport)
        gid = g["event_id"].replace(":", "-")
        h = client.get(f"/public/analytics/game/{gid}/history").json()
        assert len(h["meetings"]) == 4 and sum(h["record"].values()) == 4 and set(h["form"]) == {g["home"]["team"], g["away"]["team"]}
        assert "spread_home" not in h["meetings"][0] and "total_line" not in h["meetings"][0]
        t = client.get(f"/public/analytics/game/{gid}/tree").json()
        assert [lv["key"] for lv in t["levels"]] == ["winner", "half", "margin"] and "lines" not in t
        for lv in t["levels"]:  # each level is a partition of the game
            assert abs(sum(n["p"] for n in t["nodes"] if n["level"] == lv["level"]) - 1) < 0.01
        assert all("markets" not in n for n in t["nodes"])
    soccer = next(x for x in games if x["sport"] == "soccer")["event_id"].replace(":", "-")
    assert client.get(f"/public/analytics/game/{soccer}/history").status_code == 404
    assert client.get("/public/analytics/game/nba-nope/tree").status_code == 404


def test_publishable_shapes_drop_lines_and_markets():
    from ebk.game_extras import public_history, public_tree

    tree = public_tree({"event_id": "nfl:x", "sport": "nfl", "lines": {"spread": -3.5, "total": 44.5, "origin": "market"},
                        "levels": [{"level": 0, "key": "winner", "label": "W"}, {"level": 1, "key": "total", "label": "T"}],
                        "nodes": [{"id": "w:home", "level": 0, "label": "H win", "p": 1.0, "p_cond": 1.0, "source": "model",
                                   "markets": [{"market": "spread", "side": "home", "line": -3.5, "p": 0.6, "p_base": 0.5}]},
                                  {"id": "w:home/t:hi", "level": 1, "parent": "w:home", "label": "49+", "p": 0.4, "p_cond": 0.4, "source": "model"}]})
    assert [n["id"] for n in tree["nodes"]] == ["w:home"] and "markets" not in tree["nodes"][0] and "lines" not in tree
    assert public_tree({"event_id": "nfl:x", "sport": "nfl", "available": False}) is None
    assert public_history({"event_id": "nfl:x", "sport": "nfl", "home": "A", "away": "B", "before": "2026-01-01T00:00:00Z"}) is None


def test_picklab_documents(client):
    feed = client.get("/public/picks", params={"tz": "America/Toronto", "days": 14}).json()
    assert feed["games"] and all(p["sources"][0]["url"].startswith("https://example.com/") for g in feed["games"] for p in g["picks"])
    assert client.get("/public/picks", params={"sport": "nfl"}).json()["games"] == [g for g in client.get("/public/picks").json()["games"] if g["sport"] == "nfl"]
    since = lambda days: client.get("/public/records", params={"days": days}).json()["since"]  # noqa: E731
    assert since(25) == since(30) != since(7) and since(500) == since(90)  # the nearest stored window
    assert len(client.get("/public/records", params={"sport": "curling"}).json()["experts"]) == 0
    ids = [s["id"] for s in client.get("/public/strategies").json()]
    assert ids == ["control_favorite", "model_edge"] and client.get("/public/strategies/model_edge").json()["stats"]["picks"] == 24
    assert client.get("/public/sources").json()["excluded"]


@pytest.mark.parametrize("path", ["/public/analytics/game/nba-nope", "/public/analytics/game/mlb-1", "/public/analytics/league/chess",
                                  "/public/analytics/team/nba/ZZZ", "/public/analytics/player/nba-p1", "/public/strategies/nope",
                                  "/public/strategies/..%2F..%2Fetc", "/docs", "/openapi.json", "/nothing"])
def test_unknown_things_are_plain_404s(client, path):
    r = client.get(path)
    assert r.status_code == 404 and "Traceback" not in r.text


def test_bad_time_zone_is_a_400(client):
    assert client.get("/public/picks", params={"tz": "Not/AZone"}).status_code == 400


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_read_only(client, method):
    r = getattr(client, method)("/public/picks")
    assert r.status_code == 405 and r.headers["allow"] == "GET, HEAD, OPTIONS"


def test_security_headers_and_cache(client):
    h = client.get("/public/analytics/slate").headers
    assert h["x-content-type-options"] == "nosniff" and h["x-frame-options"] == "DENY" and h["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "geolocation=()" in h["permissions-policy"] and h["cache-control"] == "public, max-age=60"
    assert "access-control-allow-origin" not in client.get("/health", headers={"origin": "https://evil.example"}).headers


def test_rate_limit_hosts_and_cors(site):
    ratelimit.reset()
    c = TestClient(create_app(Settings(site_db=str(site), public_burst=3, public_hosts="ebk.example", public_origin="https://ebk.example")),
                   base_url="http://ebk.example")
    codes = [c.get("/health").status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    blocked = c.get("/health")
    assert int(blocked.headers["retry-after"]) >= 1 and blocked.headers["x-frame-options"] == "DENY"
    ratelimit.reset()
    assert c.get("/health", headers={"host": "other.example"}).status_code == 400
    assert c.get("/health", headers={"origin": "https://ebk.example"}).headers["access-control-allow-origin"] == "https://ebk.example"


def test_a_missing_database_is_a_generic_500(tmp_path):
    ratelimit.reset()
    c = TestClient(create_app(Settings(site_db=str(tmp_path / "none.db"))), raise_server_exceptions=False)
    r = c.get("/public/analytics/slate")
    assert r.status_code == 500 and r.json() == {"detail": "Internal error"} and r.headers["x-frame-options"] == "DENY"
    assert c.get("/public/picks").status_code == 500


def test_the_server_cannot_write(site):
    from ebk.store import Store

    with Store(site)._db() as db, pytest.raises(sqlite3.OperationalError):
        db.execute("DELETE FROM doc")
    assert json.loads(sqlite3.connect(site).execute("SELECT body FROM doc WHERE key = 'strategies'").fetchone()[0])
