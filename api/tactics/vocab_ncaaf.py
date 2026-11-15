"""College football (FBS) identity vocabulary. Every trait is computed from CollegeFootballData's per-game numbers
(PPA, success, explosiveness, line yards, stuffs, havoc, drives) and the box score's third downs and sacks; ranks are
within the FBS only. Where the data supports it a trait means what its NFL counterpart means and keeps its id (PPA is
CFBD's expected-points model, the college counterpart of EPA); where the definition differs, the label or the
description says so (success is CFBD's yardage rule, explosiveness is CFBD's PPA on successful plays, not a 20-yard
share). No scheme, coach or player trait in this pass.

FULL: the sample at which a trait counts as fully measured (confidence √(n / FULL) reaches 1), about six games of a
typical FBS team: ~70 plays, ~33 dropbacks, ~37 runs, ~12 drives, ~13 third downs, ~4 red-zone trips and ~5 scoring
opportunities a game. MIN: the smallest sample a value is shown on at all (about three games): below it the team has
no value for that trait and no edge or finding can rest on it.
"""
from schemas.tactics import MechanismSpec, TraitSpec

S = "ncaaf"


def t(id, unit, label, description, measure, good_high=True) -> TraitSpec:
    return TraitSpec(id=f"ncaaf.{id}", sport=S, unit=unit, label=label, description=description, measure=measure,
                     good_high=good_high, stat=True)


TRAITS = [
    # offense
    t("off.pass_epa", "offense", "Passing efficiency", "PPA (expected points added) per pass play, sacks included", "EPA/play"),
    t("off.rush_epa", "offense", "Rushing efficiency", "PPA (expected points added) per run", "EPA/play"),
    t("off.success", "offense", "Success rate", "Plays gaining 50% of the distance on 1st down, 70% on 2nd, all of it on 3rd and 4th", "rate"),
    t("off.explosiveness", "offense", "Explosiveness", "Average PPA of the successful plays: how big the good plays are", "EPA/play"),
    t("off.line_yards", "offense", "Line yards", "Yards per run credited to the offensive line (CFBD's line-yards rule)", "yards"),
    t("off.stuff_rate", "offense", "Fewest runs stuffed", "Runs stopped at or behind the line", "rate", good_high=False),
    t("off.havoc", "offense", "Fewest havoc plays allowed", "Plays with a tackle for loss, a forced fumble, an interception or a pass broken up", "rate", good_high=False),
    t("off.sack_rate", "offense", "Fewest sacks allowed", "Sacks per pass play", "rate", good_high=False),
    t("off.third_down", "offense", "Third-down conversion", "Third downs converted", "rate"),
    t("off.points_per_drive", "offense", "Points per drive", "Offensive points per drive", "points"),
    t("off.red_zone_td", "offense", "Red-zone touchdowns", "Drives ending inside the 20 or in a touchdown that end in a touchdown", "rate"),
    t("off.points_per_opp", "offense", "Finishing drives", "Points per scoring opportunity (a drive ending inside the opponent's 40 or in a touchdown)", "points"),
    t("off.start_field", "offense", "Starting field position", "Average yard line the offense's drives start from (own 25 = 25)", "yards"),
    # defense
    t("def.pass_epa", "defense", "Pass defense", "PPA allowed per pass play", "EPA/play", good_high=False),
    t("def.rush_epa", "defense", "Run defense", "PPA allowed per run", "EPA/play", good_high=False),
    t("def.success", "defense", "Lowest success rate allowed", "Opponent plays that were successful (CFBD's yardage rule)", "rate", good_high=False),
    t("def.explosiveness", "defense", "Fewest big plays allowed", "Average PPA of the opponent's successful plays", "EPA/play", good_high=False),
    t("def.line_yards", "defense", "Line yards allowed", "Opponent line yards per run", "yards", good_high=False),
    t("def.stuff_rate", "defense", "Runs stuffed", "Opponent runs stopped at or behind the line", "rate"),
    t("def.havoc", "defense", "Havoc rate", "Opponent plays with a tackle for loss, a forced fumble, an interception or a pass broken up", "rate"),
    t("def.sack_rate", "defense", "Pass rush (sacks)", "Sacks per opponent pass play", "rate"),
    t("def.third_down", "defense", "Third-down defense", "Opponent third downs converted", "rate", good_high=False),
    t("def.points_per_drive", "defense", "Fewest points per drive allowed", "Opponent offensive points per drive", "points", good_high=False),
    t("def.red_zone_td", "defense", "Red-zone defense", "Opponent red-zone trips ending in a touchdown", "rate", good_high=False),
    t("def.points_per_opp", "defense", "Fewest points per opportunity allowed", "Opponent points per scoring opportunity", "points", good_high=False),
    t("def.start_field", "defense", "Opponent field position", "Average yard line the opponent's drives start from", "yards", good_high=False),
    # the whole team
    t("sit.net", "situation", "Net points per drive", "Points per drive scored minus points per drive allowed, with the schedule taken out", "points"),
]

# trait id (without "ncaaf.") → the sample that counts as fully measured, and the least that is shown at all
_SAMPLE = {"pass_epa": (200, 90), "rush_epa": (220, 100), "success": (420, 200), "explosiveness": (180, 80),
           "line_yards": (220, 100), "stuff_rate": (220, 100), "havoc": (420, 200), "sack_rate": (200, 90),
           "third_down": (80, 36), "points_per_drive": (72, 33), "red_zone_td": (24, 10), "points_per_opp": (30, 13),
           "start_field": (72, 33), "net": (72, 33)}
FULL = {f"ncaaf.{side}.{k}": v[0] for k, v in _SAMPLE.items() for side in (("sit",) if k == "net" else ("off", "def"))}
MIN = {f"ncaaf.{side}.{k}": v[1] for k, v in _SAMPLE.items() for side in (("sit",) if k == "net" else ("off", "def"))}


def m(id, label, description, attack, resist, scene, weight=1.0) -> MechanismSpec:
    return MechanismSpec(id=f"ncaaf.{id}", sport=S, label=label, description=description, attack=f"ncaaf.{attack}",
                         resist=f"ncaaf.{resist}", scene=scene, weight=weight)


# The drawings (scenes) are the NFL's: the same parts of the game. Weights mirror the NFL's season-level mechanisms;
# nothing here feeds a backtested angle (the college sport has no Strategy-lab market).
MECHANISMS = [
    m("pass_game", "Passing game vs pass defense", "Efficiency through the air against what this defense allows", "off.pass_epa", "def.pass_epa", "nfl.pass_concept", 1.5),
    m("run_game", "Run game vs run defense", "Rushing efficiency against the run defense", "off.rush_epa", "def.rush_epa", "nfl.run_funnel", 1.0),
    m("success", "Staying on schedule", "How often the offense's plays succeed against how often this defense allows it", "off.success", "def.success", "nfl.drive_chart", 1.0),
    m("big_plays", "Big plays vs big plays allowed", "How large the offense's good plays are against how large this defense lets them get", "off.explosiveness", "def.explosiveness", "nfl.deep_shot", 1.0),
    m("trenches", "Line yards vs the front", "Yards the offensive line creates on runs against what this front allows", "off.line_yards", "def.line_yards", "nfl.run_funnel", 0.8),
    m("stuffs", "Runs stuffed", "How rarely the offense's runs are stopped at the line against how often this front does it", "off.stuff_rate", "def.stuff_rate", "nfl.run_funnel", 0.6),
    m("havoc", "Havoc", "How rarely the offense gives up negative plays against how often this defense makes them", "off.havoc", "def.havoc", "nfl.pass_rush", 0.8),
    m("pass_rush", "Protection vs pass rush", "Sacks allowed against the rush's sack rate", "off.sack_rate", "def.sack_rate", "nfl.pass_rush", 1.0),
    m("third_down", "Third downs", "Converting third downs against the defense's third-down stops", "off.third_down", "def.third_down", "nfl.third_down", 1.0),
    m("red_zone", "Red zone", "Touchdowns vs field goals inside the 20", "off.red_zone_td", "def.red_zone_td", "nfl.red_zone", 1.0),
    m("finishing", "Finishing drives", "Points from each trip inside the 40 against what this defense gives up there", "off.points_per_opp", "def.points_per_opp", "nfl.red_zone", 1.2),
    m("drive_scoring", "Scoring drives", "Points per drive against points per drive allowed", "off.points_per_drive", "def.points_per_drive", "nfl.drive_chart", 1.5),
]
