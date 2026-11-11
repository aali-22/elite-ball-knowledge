"""What the PickLab section serves: analysts' picks as facts with a link, their graded records, and paper strategies.
Plain data shapes; the documents themselves are built ahead of time and stored whole (ebk/store.py)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PickRecord(BaseModel):
    key: str  # site id, "site|author", or market
    label: str
    site_id: str | None = None
    picks: int = 0  # graded, not void
    won: int = 0
    lost: int = 0
    push: int = 0
    hit_pct: float | None = None  # won / (won + lost)
    priced: int = 0  # picks with the analyst's odds listed (the units sample)
    units: float = 0.0  # 1 unit per priced pick at the listed odds
    roi: float | None = None  # units / priced
    pending: int = 0  # tracked, game not graded yet


class PickRecords(BaseModel):
    since: datetime
    sites: list[PickRecord]
    experts: list[PickRecord]
    markets: list[PickRecord]
    method: str = ""


class StrategyStats(BaseModel):
    picks: int = 0
    settled: int = 0
    won: int = 0
    lost: int = 0
    push: int = 0
    unpriced: int = 0  # graded picks with no price (hit rate counts them; units, ROI and CLV don't)
    units: float = 0.0
    roi: float | None = None
    avg_clv_pct: float | None = None
    clv_n: int = 0
    beat_close: float | None = None  # share of picks that beat the closing price
    hit_rate: float | None = None
    implied_hit_rate: float | None = None  # mean fair probability at selection: what the market expected
    estimate_hit_rate: float | None = None
    units_95ci: list[float] | None = None  # bootstrap over picks
    max_drawdown: float = 0.0
    curve: list[dict] = []  # [{date, units, clv}] cumulative
    clv_pcts: list[float] = []  # each pick's CLV with a close, oldest first


class PublicSource(BaseModel):
    site: str
    site_id: str
    author: str | None
    title: str
    url: str  # the article: the only way to read the expert's reasoning from the public view
    published_at: datetime | None


class PublicPick(BaseModel):
    text: str  # the pick as written ("Texas -3")
    market: str | None = None
    market_label: str | None = None
    side: str | None = None
    line: float | None = None
    odds: int | None = None  # the price an expert listed, never a feed's price
    player_name: str | None = None
    team_abbr: str | None = None
    experts: int = 1  # distinct named experts on this same bet
    sources: list[PublicSource] = []
    result: str | None = None  # won | lost | push | void once graded
    result_detail: str | None = None


class PublicGame(BaseModel):
    event_id: str
    sport: str
    label: str
    away: str
    home: str
    start: datetime
    slot: str | None = None
    final: bool = False
    picks: list[PublicPick] = []


class PublicFeed(BaseModel):
    generated_at: datetime
    since: datetime
    games: list[PublicGame]
    sites: list[str]  # the sites shown, by name
    method: str = ("Picks from free articles on the sites named, as written, with a link to each article. Reasoning "
                   "stays on the publisher's page. Results are PickLab's grading from final box scores.")


class PublicStrategyPick(BaseModel):
    run_date: str
    selected_at: datetime
    sport: str
    label: str | None
    start: datetime
    market: str
    market_label: str
    selection: str  # "HOU +1.5", "Over 8.5", "C. Sánchez over 6.5"
    odds: int | None  # the price taken at selection
    book: str | None
    status: str
    units: float | None
    clv_pct: float | None
    reasons: list[str] = []


class PublicStrategy(BaseModel):
    id: str
    name: str
    description: str
    stats: StrategyStats  # over the picks shown
    hidden: int = 0  # picks left out of the page and of the stats
    picks: list[PublicStrategyPick] = []  # newest first


class PublicPolicyRow(BaseModel):
    key: str
    name: str
    tier: str
    note: str


class PublicSources(BaseModel):
    data: list[PublicPolicyRow] = []  # where the analytics pages' numbers come from
    sources: list[PublicPolicyRow]
    strategies: list[PublicPolicyRow]
    excluded: list[dict[str, str]]
