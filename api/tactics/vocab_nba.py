"""NBA identity vocabulary. Stat traits are computed from ESPN box scores already in the NBA history database
(tactics/nba_stats.py: Dean Oliver's four factors, pace, shot profile, net rating); scheme words (drop / switch
coverage, zone, pace-and-space, play-callers) come only from analysis and are never computed or guessed.
Possessions = FGA − OREB + TOV + 0.44·FTA (models/nba/stints.possessions)."""
from schemas.tactics import MechanismSpec, TraitSpec

S = "nba"


def t(id, unit, label, description, measure, good_high=True, stat=True) -> TraitSpec:
    return TraitSpec(id=f"nba.{id}", sport=S, unit=unit, label=label, description=description, measure=measure,
                     good_high=good_high, stat=stat)


TRAITS = [
    # offense
    t("off.rating", "offense", "Offensive rating", "Points per 100 possessions", "pts/100"),
    t("off.efg", "offense", "Shooting (eFG%)", "Effective field-goal %: (FGM + 0.5·3PM) / FGA", "rate"),
    t("off.tov", "offense", "Ball security", "Turnovers per possession", "rate", good_high=False),
    t("off.oreb", "offense", "Offensive rebounding", "Share of own missed shots rebounded (OREB / (OREB + opponent DREB))", "rate"),
    t("off.ft_rate", "offense", "Getting to the line", "Free throws made per field-goal attempt", "rate"),
    t("off.three_rate", "offense", "Three-point volume", "Share of field-goal attempts that are threes", "share"),
    t("off.three_pct", "offense", "Three-point accuracy", "3PM / 3PA", "rate"),
    t("off.3pa_rate", "offense", "Three-point attempts per 100", "Three-point attempts per 100 possessions (volume without pace)", "per 100"),
    t("off.ast_rate", "offense", "Ball movement", "Assists per made field goal", "rate"),
    t("off.scheme", "offense", "Offensive style", "Pick-and-roll heavy / motion / isolation, as analysis describes it", "text", stat=False),
    t("off.play_caller", "coach", "Head coach", "Who runs the team, as analysis names them", "text", stat=False),
    # defense
    t("def.rating", "defense", "Defensive rating", "Opponent points per 100 possessions", "pts/100", good_high=False),
    t("def.efg", "defense", "Lowest opponent shooting (eFG%)", "Opponent effective field-goal %", "rate", good_high=False),
    t("def.tov", "defense", "Forcing turnovers", "Opponent turnovers per opponent possession", "rate"),
    t("def.dreb", "defense", "Defensive rebounding", "Share of opponent misses rebounded (DREB / (DREB + opponent OREB))", "rate"),
    t("def.ft_rate", "defense", "Fewest fouls (opponent FT rate)", "Opponent free throws made per opponent field-goal attempt", "rate", good_high=False),
    t("def.three_rate", "defense", "Fewest threes allowed (share of shots)", "Share of opponent field-goal attempts that are threes", "share", good_high=False),
    t("def.three_pct", "defense", "Lowest three-point % allowed", "Opponent 3PM / 3PA", "rate", good_high=False),
    t("def.3pa_rate_allowed", "defense", "Fewest threes allowed per 100", "Opponent three-point attempts per 100 opponent possessions", "per 100", good_high=False),
    # M5: points per game scored against the defense by each ESPN roster position (current rosters applied to every game)
    t("def.pts_allowed_g", "defense", "Fewest points allowed to guards", "Points per game scored by opposing guards", "pts/game", good_high=False),
    t("def.pts_allowed_f", "defense", "Fewest points allowed to forwards", "Points per game scored by opposing forwards", "pts/game", good_high=False),
    t("def.pts_allowed_c", "defense", "Fewest points allowed to centers", "Points per game scored by opposing centers", "pts/game", good_high=False),
    t("def.scheme", "defense", "Defensive coverage", "Drop / switch / blitz / zone, as analysis describes it", "text", stat=False),
    # situation
    t("sit.pace", "situation", "Pace", "Possessions per game, the average of both teams' (overtime included)", "poss/game"),
    t("sit.net", "situation", "Net rating", "Offensive minus defensive rating", "pts/100"),
    # M5 player proxies (TeamIdentity.players), ranked within ESPN roster position; play-type data (NBA.com / Cleaning the
    # Glass) waits for the capture reader (I22)
    t("player.fg3a_36", "player", "Threes attempted per 36", "A player's three-point attempts per 36 minutes played", "per 36"),
    t("player.fg3_pct", "player", "Three-point %", "A player's 3PM / 3PA (ranked with at least one attempt per game)", "rate"),
    t("player.usage", "player", "Usage rate (proxy)", "Share of team plays used while on the floor: (FGA + 0.44·FTA + TOV) "
      "against the team's, per minute played (Basketball-Reference's formula from box totals)", "share %"),
    t("sit.injuries", "situation", "Missing players", "Who is out or doubtful, as the injury report or analysis says", "text", stat=False),
]


def m(id, label, description, attack, resist, scene, weight=1.0) -> MechanismSpec:
    return MechanismSpec(id=f"nba.{id}", sport=S, label=label, description=description, attack=f"nba.{attack}",
                         resist=f"nba.{resist}", scene=scene, weight=weight)


# Every NBA mechanism is descriptive (weight 0) until a backtest shows it adds something beyond the player-impact model
# (N5–N7): it explains where a matchup sits, it doesn't feed Strategy-lab angles or inference leans.
MECHANISMS = [
    m("scoring", "Offense vs defense", "Points per 100 possessions against what this defense allows", "off.rating", "def.rating", "nba.half_court", 0),
    m("shooting", "Shooting vs shot defense", "Effective field-goal % against the eFG% this defense allows", "off.efg", "def.efg", "nba.half_court", 0),
    m("turnovers", "Ball security vs pressure", "Turnover rate against how often this defense forces turnovers", "off.tov", "def.tov", "nba.transition", 0),
    m("glass", "Offensive glass vs defensive glass", "Offensive rebounding share against this defense's rebounding share", "off.oreb", "def.dreb", "nba.glass", 0),
    m("free_throws", "Free throws", "Getting to the line against how much this defense fouls", "off.ft_rate", "def.ft_rate", "nba.half_court", 0),
    m("threes", "Three-point volume", "How often this offense shoots threes against how many threes this defense gives up", "off.three_rate", "def.three_rate", "nba.spacing", 0),
    m("three_volume", "Three-point volume per 100", "Threes attempted per 100 possessions against threes this defense allows per 100", "off.3pa_rate", "def.3pa_rate_allowed", "nba.spacing", 0),
    m("three_accuracy", "Three-point accuracy", "Three-point % against the % this defense allows (noisy: shooting luck)", "off.three_pct", "def.three_pct", "nba.spacing", 0),
    m("scheme", "Style vs coverage", "The offense's main action against the defense's coverage, as analysis describes", "off.scheme", "def.scheme", "nba.half_court", 0),
]


def pm(id, label, description, attack, resist, position, markets, scene) -> MechanismSpec:
    return MechanismSpec(id=f"nba.{id}", sport=S, label=label, description=description, attack=f"nba.{attack}",
                         resist=f"nba.{resist}", scene=scene, weight=0, level="player", position=position, markets=markets)


# M6 player mechanisms (tactics/matchup.player_edges), weight 0 like every NBA mechanism. Threes made isn't a PickLab
# market yet, so the shooter edge speaks to points.
PLAYER_MECHANISMS = [
    pm("shooter_volume", "Shooter vs threes allowed", "A player's threes per 36 against the threes per 100 this defense allows",
       "player.fg3a_36", "def.3pa_rate_allowed", None, ["nba_points"], "nba.spacing"),
    pm("creator_pressure", "Lead ball-handler vs turnover pressure", "A high-usage player against how often this defense forces turnovers",
       "player.usage", "def.tov", None, ["nba_points", "nba_assists"], "nba.transition"),
    pm("guard_scoring", "Guard vs points allowed to guards", "A guard's usage against the points per game this defense allows guards",
       "player.usage", "def.pts_allowed_g", "G", ["nba_points"], "nba.half_court"),
    pm("forward_scoring", "Forward vs points allowed to forwards", "A forward's usage against the points per game this defense allows forwards",
       "player.usage", "def.pts_allowed_f", "F", ["nba_points", "nba_rebounds"], "nba.half_court"),
    pm("center_scoring", "Center vs points allowed to centers", "A center's usage against the points per game this defense allows centers",
       "player.usage", "def.pts_allowed_c", "C", ["nba_points", "nba_rebounds"], "nba.glass"),
]
