"""Soccer competitions on the site. A club plays in more than one (its domestic league and the Champions League), and
each competition is its own league: ranks, percentiles, schedules and samples are counted within it, never across.

A competition has a code (ESPN's, as the rest of the app writes it: "eng.1"), a name and FotMob's league id (the source
of its table). A board says which competition its game is in (`TacticalReport.competition`); a board saved before it
said so is placed by the FotMob table its stats name (every stat's source links `/leagues/<id>`).
"""
from __future__ import annotations

import re

from schemas.tactics import TacticalReport, TeamIdentity

# code → (name, short name, FotMob league id), in the order the site lists them
COMPETITIONS: dict[str, tuple[str, str, int]] = {
    "eng.1": ("Premier League", "Premier League", 47),
    "uefa.champions": ("Champions League", "Champions League", 42),
    "esp.1": ("LaLiga", "LaLiga", 87),
    "ita.1": ("Serie A", "Serie A", 55),
    "ger.1": ("Bundesliga", "Bundesliga", 54),
    "fra.1": ("Ligue 1", "Ligue 1", 53),
}
BY_FOTMOB = {fid: code for code, (_, _, fid) in COMPETITIONS.items()}
DOMESTIC = tuple(c for c in COMPETITIONS if not c.startswith("uefa."))
_LEAGUE = re.compile(r"fotmob\.com/leagues/(\d+)")


def code_for(fotmob_id: int | str | None) -> str | None:
    try:
        return BY_FOTMOB.get(int(fotmob_id)) if fotmob_id is not None else None
    except (TypeError, ValueError):
        return None


def name_of(code: str | None) -> str | None:
    return COMPETITIONS[code][0] if code in COMPETITIONS else None


def _from_sources(t: TeamIdentity | None) -> str | None:
    for v in (t.traits if t else []):
        for s in v.sources:
            m = _LEAGUE.search(s.url or "")
            if m:
                return code_for(m.group(1))
    return None


def competition(rep: TacticalReport) -> str | None:
    """The competition a soccer board's game is in: as the board states it, else from its stats' FotMob table. None for
    another sport, or a board that names neither (an unknown competition is never guessed)."""
    if rep.sport != "soccer":
        return None
    if rep.competition in COMPETITIONS:
        return rep.competition
    return _from_sources(rep.home) or _from_sources(rep.away)


def played(t: TeamIdentity | None) -> int:
    """Matches this club had played in the board's competition before the game (the opponents-faced strip holds only
    that competition's matches)."""
    return sum(1 for o in (t.opponents if t else []) if o.result)
