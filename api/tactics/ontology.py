"""One registry over the sport vocabularies. Adding a sport = one vocab_<sport>.py with TRAITS + MECHANISMS."""
from __future__ import annotations

from functools import lru_cache

from schemas.tactics import MechanismSpec, TraitSpec
from tactics import vocab_nba, vocab_nfl, vocab_soccer

SPORTS = {"nfl": vocab_nfl, "soccer": vocab_soccer, "nba": vocab_nba}


@lru_cache
def traits(sport: str) -> dict[str, TraitSpec]:
    return {t.id: t for t in SPORTS[sport].TRAITS}


@lru_cache
def mechanisms(sport: str) -> dict[str, MechanismSpec]:
    return {m.id: m for m in SPORTS[sport].MECHANISMS}


@lru_cache
def player_mechanisms(sport: str) -> dict[str, MechanismSpec]:
    """M6: player × opposing-defense mechanisms (level "player"); kept apart so team-level consumers stay unchanged."""
    return {m.id: m for m in getattr(SPORTS[sport], "PLAYER_MECHANISMS", [])}


def trait(id: str) -> TraitSpec | None:
    sport = id.split(".", 1)[0]
    return traits(sport).get(id) if sport in SPORTS else None


def vocabulary(sport: str) -> dict:
    """The closed vocabulary as plain data: what the claim extractor may map analysis onto."""
    return {"traits": [t.model_dump() for t in traits(sport).values()],
            "mechanisms": [m.model_dump() for m in mechanisms(sport).values()],
            "player_mechanisms": [m.model_dump() for m in player_mechanisms(sport).values()]}
