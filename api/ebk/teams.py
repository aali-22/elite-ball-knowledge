"""Team names for the codes the boards carry (NBA: the box-score abbreviations; NFL: the play-by-play ones). Soccer
boards already carry club names. A name is what a reader sees; the code stays the id everywhere."""
from __future__ import annotations

from ebk.college import SCHOOLS

NAMES: dict[str, dict[str, tuple[str, str]]] = {
    "nba": {
        "ATL": ("Atlanta", "Hawks"), "BOS": ("Boston", "Celtics"), "BKN": ("Brooklyn", "Nets"), "CHA": ("Charlotte", "Hornets"),
        "CHI": ("Chicago", "Bulls"), "CLE": ("Cleveland", "Cavaliers"), "DAL": ("Dallas", "Mavericks"), "DEN": ("Denver", "Nuggets"),
        "DET": ("Detroit", "Pistons"), "GS": ("Golden State", "Warriors"), "HOU": ("Houston", "Rockets"), "IND": ("Indiana", "Pacers"),
        "LAC": ("LA", "Clippers"), "LAL": ("Los Angeles", "Lakers"), "MEM": ("Memphis", "Grizzlies"), "MIA": ("Miami", "Heat"),
        "MIL": ("Milwaukee", "Bucks"), "MIN": ("Minnesota", "Timberwolves"), "NO": ("New Orleans", "Pelicans"), "NY": ("New York", "Knicks"),
        "OKC": ("Oklahoma City", "Thunder"), "ORL": ("Orlando", "Magic"), "PHI": ("Philadelphia", "76ers"), "PHX": ("Phoenix", "Suns"),
        "POR": ("Portland", "Trail Blazers"), "SAC": ("Sacramento", "Kings"), "SA": ("San Antonio", "Spurs"), "TOR": ("Toronto", "Raptors"),
        "UTAH": ("Utah", "Jazz"), "WSH": ("Washington", "Wizards"),
        # other spellings of the same clubs
        "GSW": ("Golden State", "Warriors"), "NOP": ("New Orleans", "Pelicans"), "NYK": ("New York", "Knicks"), "SAS": ("San Antonio", "Spurs"),
        "UTA": ("Utah", "Jazz"), "WAS": ("Washington", "Wizards"), "PHO": ("Phoenix", "Suns"),
    },
    "nfl": {
        "ARI": ("Arizona", "Cardinals"), "ATL": ("Atlanta", "Falcons"), "BAL": ("Baltimore", "Ravens"), "BUF": ("Buffalo", "Bills"),
        "CAR": ("Carolina", "Panthers"), "CHI": ("Chicago", "Bears"), "CIN": ("Cincinnati", "Bengals"), "CLE": ("Cleveland", "Browns"),
        "DAL": ("Dallas", "Cowboys"), "DEN": ("Denver", "Broncos"), "DET": ("Detroit", "Lions"), "GB": ("Green Bay", "Packers"),
        "HOU": ("Houston", "Texans"), "IND": ("Indianapolis", "Colts"), "JAX": ("Jacksonville", "Jaguars"), "KC": ("Kansas City", "Chiefs"),
        "LA": ("Los Angeles", "Rams"), "LAR": ("Los Angeles", "Rams"), "LAC": ("Los Angeles", "Chargers"), "LV": ("Las Vegas", "Raiders"),
        "MIA": ("Miami", "Dolphins"), "MIN": ("Minnesota", "Vikings"), "NE": ("New England", "Patriots"), "NO": ("New Orleans", "Saints"),
        "NYG": ("New York", "Giants"), "NYJ": ("New York", "Jets"), "PHI": ("Philadelphia", "Eagles"), "PIT": ("Pittsburgh", "Steelers"),
        "SEA": ("Seattle", "Seahawks"), "SF": ("San Francisco", "49ers"), "TB": ("Tampa Bay", "Buccaneers"), "TEN": ("Tennessee", "Titans"),
        "WAS": ("Washington", "Commanders"), "WSH": ("Washington", "Commanders"),
    },
}


# College leagues: a school reads by its name ("Duke", "Texas A&M"), not its nickname. The names come from the generated
# list in ebk/college.py (the recorded ESPN team lists), never typed here; a code that list lacks stays a code.
COLLEGE = ("ncaaf", "ncaab")


def _college(sport: str) -> dict[str, tuple[str, str]]:
    return SCHOOLS.get(sport, {})


def nickname(sport: str, code: str) -> str | None:
    if sport in COLLEGE:
        hit = _college(sport).get(code)
        return hit[0] if hit else None
    hit = NAMES.get(sport, {}).get(code)
    return hit[1] if hit else None


def full_name(sport: str, code: str) -> str | None:
    if sport in COLLEGE:
        hit = _college(sport).get(code)
        return hit[1] if hit else None
    hit = NAMES.get(sport, {}).get(code)
    return f"{hit[0]} {hit[1]}" if hit else None


# ---- team addresses ---------------------------------------------------------------------------------------------------
# A team's code is its id everywhere, but college codes carry characters a link should not ("TA&M", "W&M", "AVE M").
# The rule: a college team's address is its code in lower case with "&" written "-and-" and a space written "-"
# ("TA&M" → "ta-and-m", "M-OH" → "m-oh", "W&M" → "w-and-m"); professional codes stay as they are ("NYG"). An address
# is read back by looking it up among the league's codes, never by undoing the rule, so a code that already has a
# dash is safe; two codes that would share an address both lose it (the page is then not found, never the wrong team).
def team_slug(sport: str, code: str) -> str:
    if sport not in COLLEGE:
        return code
    return code.lower().replace("&", "-and-").replace(" ", "-")


def team_from_slug(sport: str, raw: str, known: set[str] | frozenset[str] = frozenset()) -> str | None:
    """The code an address names in `sport`, among `known` codes and the league's school list; None when none (or
    two) match. The code itself, in any case, is accepted too."""
    codes = set(known) | set(_college(sport))
    hits = {c for c in codes if team_slug(sport, c) == raw.lower()} or {c for c in codes if c.lower() == raw.lower()}
    return next(iter(hits)) if len(hits) == 1 else None
