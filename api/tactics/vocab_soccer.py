"""Soccer identity vocabulary. Stat traits come from FotMob pages PickLab already reads (league tables with xG,
match lineups and formations, finished matches' shot maps and stats); style traits (pressing, line height, offside trap, build-up) come only from analysis
until a free source with those stats is verified. Missing stays missing."""
from schemas.tactics import MechanismSpec, TraitSpec

S = "soccer"


def t(id, unit, label, description, measure, good_high=True, stat=True) -> TraitSpec:
    return TraitSpec(id=f"soccer.{id}", sport=S, unit=unit, label=label, description=description, measure=measure,
                     good_high=good_high, stat=stat)


TRAITS = [
    t("off.xg", "offense", "Chance creation", "Expected goals per match (FotMob)", "xG/match"),
    t("off.goals", "offense", "Goals", "Goals per match", "goals/match"),
    t("off.finishing", "offense", "Finishing vs xG", "Goals minus xG per match", "goals/match"),
    t("off.counter", "offense", "Counter-attacking threat", "Fast transitions in behind, as analysis describes", "text", stat=False),
    t("off.build_up", "offense", "Build-up style", "Short build-up / direct / wing overloads, as analysis describes", "text", stat=False),
    t("off.set_pieces", "offense", "Set-piece threat", "Danger from corners and free kicks, as analysis describes", "text", stat=False),
    t("def.xga", "defense", "Chances conceded", "Expected goals against per match (FotMob)", "xG/match", good_high=False),
    t("def.goals_against", "defense", "Goals conceded", "Goals against per match", "goals/match", good_high=False),
    t("def.press", "defense", "Pressing", "High press / mid block / low block, as analysis describes", "text", stat=False),
    t("def.line_height", "defense", "Defensive line", "High line and offside trap vs deep line, as analysis describes", "text", stat=False),
    t("def.set_pieces", "defense", "Set-piece defending", "Weakness or strength defending set pieces, as analysis describes", "text", stat=False),
    # V4: from each finished match's FotMob shot map and stats (tactics/soccer_matches.py). Set pieces = corners, free
    # kicks, throw-in and other set plays (penalties apart); transitions = FotMob's "FastBreak" shots. Game-state xG is
    # per 90 minutes in that state, stoppage time counted at the half's last minute.
    t("off.xg_set_piece", "offense", "Set-piece xG", "xG per match from corners, free kicks and other set plays (no penalties)", "xG/match"),
    t("def.xga_set_piece", "defense", "Set-piece xG conceded", "Opponent xG per match from set plays (no penalties)", "xG/match", good_high=False),
    t("off.xg_fast_break", "offense", "Transition xG", "xG per match from fast breaks (FotMob's FastBreak shots)", "xG/match"),
    t("def.xga_fast_break", "defense", "Transition xG conceded", "Opponent xG per match from fast breaks", "xG/match", good_high=False),
    t("off.xg_level", "offense", "xG when level", "xG per 90 minutes while the score is level", "xG/90"),
    t("off.xg_ahead", "offense", "xG when ahead", "xG per 90 minutes while leading", "xG/90"),
    t("off.xg_behind", "offense", "xG when behind", "xG per 90 minutes while trailing", "xG/90"),
    t("def.xga_level", "defense", "xG conceded when level", "Opponent xG per 90 minutes while the score is level", "xG/90", good_high=False),
    t("def.xga_ahead", "defense", "xG conceded when ahead", "Opponent xG per 90 minutes while this team leads", "xG/90", good_high=False),
    t("def.xga_behind", "defense", "xG conceded when behind", "Opponent xG per 90 minutes while this team trails", "xG/90", good_high=False),
    t("def.ppda_proxy", "defense", "Pressing proxy (PPDA-like)", "Opponent own-half passes per tackle, interception or foul anywhere (lower = more pressing; true PPDA by third isn't free)", "passes/action", good_high=False),
    t("sit.formation", "situation", "Formation", "Starting shape in the last match (FotMob lineup)", "text"),
    t("sit.form", "situation", "Recent form", "Points per match over the last five", "points"),
]


def m(id, label, description, attack, resist, scene, weight=1.0, vulnerable=()) -> MechanismSpec:
    return MechanismSpec(id=f"soccer.{id}", sport=S, label=label, description=description, attack=f"soccer.{attack}",
                         resist=f"soccer.{resist}", scene=scene, weight=weight, vulnerable=list(vulnerable))


MECHANISMS = [
    m("chance_quality", "Chance creation vs chances conceded", "xG created against xG this defense allows", "off.xg", "def.xga", "soccer.shape", 1.5),
    m("in_behind", "Runs in behind vs a high line", "A counter-attacking side against a high line and offside trap", "off.counter", "def.line_height", "soccer.offside_trap", 1.0,
      vulnerable=("high",)),
    m("press_vs_build", "Build-up vs press", "Playing out from the back against a high press", "off.build_up", "def.press", "soccer.press_trap", 1.0),
    m("set_pieces", "Set pieces", "Set-piece threat against set-piece defending", "off.set_pieces", "def.set_pieces", "soccer.set_piece", 0.6),
    # V4 descriptive mechanisms (weight 0: shown, not fed to angles or leans until evaluated)
    m("set_piece_xg", "Set-piece chances", "Set-piece xG created against set-piece xG conceded", "off.xg_set_piece", "def.xga_set_piece", "soccer.set_piece", 0),
    m("transition_xg", "Transitions", "Fast-break xG created against fast-break xG conceded", "off.xg_fast_break", "def.xga_fast_break", "soccer.offside_trap", 0),
    m("level_xg", "With the score level", "xG per 90 while level against xG conceded while level", "off.xg_level", "def.xga_level", "soccer.shape", 0),
    m("chase_xg", "Chasing a deficit", "xG while behind against the other side's xG conceded while ahead", "off.xg_behind", "def.xga_ahead", "soccer.shape", 0),
    m("lead_xg", "Pressing a lead", "xG while ahead against the other side's xG conceded while behind", "off.xg_ahead", "def.xga_behind", "soccer.shape", 0),
    m("finishing", "Finishing vs goals conceded", "Goals scored against goals conceded", "off.goals", "def.goals_against", "soccer.shape", 0.8),
]
