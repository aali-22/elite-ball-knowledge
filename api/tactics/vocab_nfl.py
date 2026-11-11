"""NFL identity vocabulary. Stat traits are computed from nflverse play-by-play and FTN charting (tactics/nfl_stats.py);
the rest come only from analysis (scheme names, play-callers) and are never computed or guessed."""
from schemas.tactics import MechanismSpec, TraitSpec

S = "nfl"


def t(id, unit, label, description, measure, good_high=True, stat=True) -> TraitSpec:
    return TraitSpec(id=f"nfl.{id}", sport=S, unit=unit, label=label, description=description, measure=measure,
                     good_high=good_high, stat=stat)


TRAITS = [
    # offense
    t("off.pass_epa", "offense", "Passing efficiency", "EPA per dropback (sacks and scrambles included)", "EPA/play"),
    t("off.rush_epa", "offense", "Rushing efficiency", "EPA per designed run", "EPA/play"),
    t("off.success", "offense", "Success rate", "Share of plays with positive EPA", "rate"),
    t("off.proe", "offense", "Pass rate over expected", "Dropback rate minus nflverse's expected rate for the situation", "share"),
    t("off.explosive_pass", "offense", "Explosive passing", "Dropbacks gaining 20+ yards", "rate"),
    t("off.explosive_rush", "offense", "Explosive running", "Runs gaining 10+ yards", "rate"),
    t("off.deep_rate", "offense", "Deep shots", "Pass attempts with 20+ air yards", "rate"),
    t("off.play_action", "offense", "Play-action rate", "FTN-charted play-action on dropbacks", "rate"),
    t("off.motion", "offense", "Pre-snap motion", "FTN-charted motion on offensive plays", "rate"),
    t("off.screen", "offense", "Screen rate", "FTN-charted screens on passes", "rate"),
    t("off.sack_rate", "offense", "Sacks allowed", "Sacks per dropback", "rate", good_high=False),
    t("off.pressure_proxy", "offense", "QB hits allowed", "QB hits (incl. sacks) per dropback", "rate", good_high=False),
    t("off.third_down", "offense", "Third-down conversion", "Third downs converted", "rate"),
    t("off.red_zone_td", "offense", "Red-zone touchdowns", "Drives reaching the 20 that end in a TD", "rate"),
    t("off.points_per_drive", "offense", "Points per drive", "Offensive points per drive", "points"),
    t("off.points_pg", "offense", "Points per game", "Offensive points per game (no defensive/special-teams scores)", "points"),
    t("off.pass_yds_pg", "offense", "Passing yards per game", "Net passing yards per game", "yards"),
    # V4 splits (all from nflverse fields; FTN for the blitz splits). Hits = QB hits incl. sacks: nflverse has no
    # pressure field, so "pressure" here is the same hit proxy as off/def.pressure_proxy.
    t("off.early_epa", "offense", "Early-down efficiency", "EPA per play on 1st and 2nd down", "EPA/play"),
    t("off.third_long", "offense", "3rd-and-long conversion", "Third downs with 7+ yards to go converted", "rate"),
    t("off.third_short", "offense", "3rd-and-short conversion", "Third downs with 1–3 yards to go converted", "rate"),
    t("off.rz_pass_epa", "offense", "Red-zone passing", "EPA per dropback inside the opponent's 20", "EPA/play"),
    t("off.rz_rush_epa", "offense", "Red-zone running", "EPA per designed run inside the opponent's 20", "EPA/play"),
    t("off.rz_pass_rate", "offense", "Red-zone pass rate", "Share of red-zone plays that are dropbacks (style)", "rate"),
    t("off.explosive_outside", "offense", "Explosives outside", "Plays to the left or right gaining 10+ (runs) / 20+ (passes)", "rate"),
    t("off.explosive_middle", "offense", "Explosives in the middle", "Plays up the middle gaining 10+ (runs) / 20+ (passes)", "rate"),
    t("off.hits_vs_blitz", "offense", "QB hits allowed vs the blitz", "QB hits (incl. sacks) per dropback facing 1+ blitzer (FTN)", "rate", good_high=False),
    t("off.hits_no_blitz", "offense", "QB hits allowed, no blitz", "QB hits (incl. sacks) per dropback facing no blitzer (FTN)", "rate", good_high=False),
    t("off.epa_leading", "offense", "Offense when leading", "EPA per play while ahead on the scoreboard", "EPA/play"),
    t("off.epa_trailing", "offense", "Offense when trailing", "EPA per play while behind on the scoreboard", "EPA/play"),
    t("off.run_scheme", "offense", "Run scheme", "Zone / gap / mixed, as analysis describes it", "text", stat=False),
    t("off.play_caller", "coach", "Play-caller", "Who calls the offense", "text", stat=False),
    # defense
    t("def.pass_epa", "defense", "Pass defense", "EPA per dropback allowed", "EPA/play", good_high=False),
    t("def.rush_epa", "defense", "Run defense", "EPA per designed run allowed", "EPA/play", good_high=False),
    t("def.success", "defense", "Success allowed", "Share of opponent plays with positive EPA", "rate", good_high=False),
    t("def.sack_rate", "defense", "Pass rush (sacks)", "Sacks per opponent dropback", "rate"),
    t("def.pressure_proxy", "defense", "Pass rush (QB hits)", "QB hits (incl. sacks) per opponent dropback", "rate"),
    t("def.blitz", "defense", "Blitz rate", "FTN: dropbacks facing 1+ blitzer", "rate"),
    t("def.rushers", "defense", "Pass rushers sent", "FTN: average pass rushers per dropback", "count"),
    t("def.box", "defense", "Box count vs runs", "FTN: average defenders in the box on runs", "count"),
    t("def.explosive_pass", "defense", "Explosive passes allowed", "Opponent dropbacks gaining 20+ yards", "rate", good_high=False),
    t("def.explosive_rush", "defense", "Explosive runs allowed", "Opponent runs gaining 10+ yards", "rate", good_high=False),
    t("def.long_td_share", "defense", "Long touchdowns allowed", "Share of TDs allowed that came from 20+ yards", "share", good_high=False),
    t("def.third_down", "defense", "Third-down defense", "Opponent third downs converted", "rate", good_high=False),
    t("def.red_zone_td", "defense", "Red-zone defense", "Opponent red-zone drives ending in a TD", "rate", good_high=False),
    t("def.points_per_drive", "defense", "Points per drive allowed", "Opponent offensive points per drive", "points", good_high=False),
    t("def.points_pg", "defense", "Points allowed per game", "Opponent offensive points per game", "points", good_high=False),
    t("def.pass_yds_pg", "defense", "Passing yards allowed per game", "Opponent net passing yards per game", "yards", good_high=False),
    t("def.man_rate_prior", "defense", "Man coverage (last season)", "Share of man coverage in the previous season (nflverse participation; current season not published)", "rate", stat=True),
    t("def.early_epa", "defense", "Early-down defense", "EPA per play allowed on 1st and 2nd down", "EPA/play", good_high=False),
    t("def.third_long", "defense", "3rd-and-long defense", "Opponent third downs with 7+ yards to go converted", "rate", good_high=False),
    t("def.third_short", "defense", "3rd-and-short defense", "Opponent third downs with 1–3 yards to go converted", "rate", good_high=False),
    t("def.rz_pass_epa", "defense", "Red-zone pass defense", "EPA per dropback allowed inside its own 20", "EPA/play", good_high=False),
    t("def.rz_rush_epa", "defense", "Red-zone run defense", "EPA per designed run allowed inside its own 20", "EPA/play", good_high=False),
    t("def.explosive_outside", "defense", "Explosives allowed outside", "Opponent plays to the left or right gaining 10+ (runs) / 20+ (passes)", "rate", good_high=False),
    t("def.explosive_middle", "defense", "Explosives allowed in the middle", "Opponent plays up the middle gaining 10+ (runs) / 20+ (passes)", "rate", good_high=False),
    t("def.hits_vs_blitz", "defense", "QB hits when blitzing", "QB hits (incl. sacks) per opponent dropback with 1+ blitzer (FTN)", "rate"),
    t("def.hits_no_blitz", "defense", "QB hits without blitzing", "QB hits (incl. sacks) per opponent dropback with no blitzer (FTN)", "rate"),
    t("def.epa_leading", "defense", "Defense when trailing", "EPA per play allowed while the opponent is ahead", "EPA/play", good_high=False),
    t("def.epa_trailing", "defense", "Defense when leading", "EPA per play allowed while the opponent is behind", "EPA/play", good_high=False),
    # M4 positional traits (nflverse weekly player stats): what each position gained against this defense, per game
    # before kickoff. Rank 1 = least allowed (best for the defense), like every other defense trait.
    t("def.te_yds_allowed", "defense", "TE receiving yards allowed", "Receiving yards per game by tight ends against this defense", "yards", good_high=False),
    t("def.wr_yds_allowed", "defense", "WR receiving yards allowed", "Receiving yards per game by wide receivers against this defense", "yards", good_high=False),
    t("def.rb_rec_yds_allowed", "defense", "RB receiving yards allowed", "Receiving yards per game by running backs (and fullbacks) against this defense", "yards", good_high=False),
    t("def.te_tgt_allowed", "defense", "TE targets allowed", "Targets per game to tight ends against this defense", "count", good_high=False),
    t("def.wr_tgt_allowed", "defense", "WR targets allowed", "Targets per game to wide receivers against this defense", "count", good_high=False),
    t("def.rb_tgt_allowed", "defense", "RB targets allowed", "Targets per game to running backs (and fullbacks) against this defense", "count", good_high=False),
    t("def.rush_yds_allowed", "defense", "Rushing yards allowed", "Rushing yards per game by all players against this defense (QB scrambles and kneels included)", "yards", good_high=False),
    t("def.coverage_shell", "defense", "Coverage shell", "Two-high / single-high, as analysis describes it", "text", stat=False),
    # M4 player traits (TeamIdentity.players, schemas.tactics.PlayerTraitValue): ranked within the position among
    # players with at least half their team's games, rank 1 = most
    t("player.rec_yds", "player", "Receiving yards per game", "A player's receiving yards per game played", "yards"),
    t("player.target_share", "player", "Target share", "A player's share of the team's targets in the games the player played", "share"),
    t("player.rush_yds", "player", "Rushing yards per game", "A player's rushing yards per game played", "yards"),
    # situation
    t("sit.rest", "situation", "Rest days", "Days since the previous game", "days"),
    t("sit.abroad", "situation", "International game", "Played outside the US (London, Munich…), with travel before it", "flag", stat=False),
    t("sit.key_number", "situation", "Key number", "Spread at or near 3 / 7, and whether the market moved it", "text", stat=False),
]


def m(id, label, description, attack, resist, scene, weight=1.0) -> MechanismSpec:
    return MechanismSpec(id=f"nfl.{id}", sport=S, label=label, description=description, attack=f"nfl.{attack}",
                         resist=f"nfl.{resist}", scene=scene, weight=weight)


MECHANISMS = [
    m("pass_game", "Passing game vs pass defense", "Efficiency through the air against what this defense allows", "off.pass_epa", "def.pass_epa", "nfl.pass_concept", 1.5),
    m("run_game", "Run game vs run defense", "Rushing efficiency against the run defense", "off.rush_epa", "def.rush_epa", "nfl.run_funnel", 1.0),
    m("pass_rush", "Protection vs pass rush", "Sacks and hits allowed against the rush's sack rate", "off.sack_rate", "def.sack_rate", "nfl.pass_rush", 1.2),
    m("explosive_pass", "Deep shots vs explosive-pass defense", "Big plays through the air against how often this defense gives them up", "off.explosive_pass", "def.explosive_pass", "nfl.deep_shot", 1.2),
    m("explosive_run", "Big runs vs run fits", "10+ yard runs against how often this defense allows them", "off.explosive_rush", "def.explosive_rush", "nfl.run_funnel", 0.8),
    m("third_down", "Third downs", "Staying on schedule against the defense's third-down stops", "off.third_down", "def.third_down", "nfl.third_down", 1.0),
    m("red_zone", "Red zone", "Touchdowns vs field goals inside the 20", "off.red_zone_td", "def.red_zone_td", "nfl.red_zone", 1.2),
    # V4 split mechanisms: descriptive (weight 0). They explain where an edge sits but don't feed Strategy-lab angles
    # or inference leans until a backtest shows they add something beyond the season-level mechanisms above.
    m("early_downs", "Early downs", "1st- and 2nd-down efficiency against the defense's early-down EPA allowed", "off.early_epa", "def.early_epa", "nfl.pass_concept", 0),
    m("third_long", "3rd and long", "Converting 3rd-and-7+ against the defense's stops in those spots", "off.third_long", "def.third_long", "nfl.third_down", 0),
    m("third_short", "3rd and short", "Converting 3rd-and-1–3 against the defense's short-yardage stops", "off.third_short", "def.third_short", "nfl.third_down", 0),
    m("rz_pass", "Red-zone passing", "Passing inside the 20 against the red-zone pass defense", "off.rz_pass_epa", "def.rz_pass_epa", "nfl.red_zone", 0),
    m("rz_run", "Red-zone running", "Running inside the 20 against the red-zone run defense", "off.rz_rush_epa", "def.rz_rush_epa", "nfl.red_zone", 0),
    m("explosive_outside", "Big plays outside", "Explosives to the perimeter against how often this defense allows them there", "off.explosive_outside", "def.explosive_outside", "nfl.deep_shot", 0),
    m("explosive_middle", "Big plays up the middle", "Explosives between the tackles / over the middle against what this defense allows there", "off.explosive_middle", "def.explosive_middle", "nfl.run_funnel", 0),
    m("blitz_protection", "Protection vs the blitz", "Hits allowed when blitzed against how often this defense gets home when it blitzes", "off.hits_vs_blitz", "def.hits_vs_blitz", "nfl.pass_rush", 0),
    m("four_man_rush", "Protection vs a no-blitz rush", "Hits allowed against a standard rush vs this defense's hits without blitzing", "off.hits_no_blitz", "def.hits_no_blitz", "nfl.pass_rush", 0),
    m("protect_lead", "Playing with a lead", "Offense while ahead against this defense while behind", "off.epa_leading", "def.epa_leading", "nfl.drive_chart", 0),
    m("chase_game", "Chasing the game", "Offense while behind against this defense while ahead", "off.epa_trailing", "def.epa_trailing", "nfl.drive_chart", 0),
    m("drive_scoring", "Scoring drives", "Points per drive against points per drive allowed", "off.points_per_drive", "def.points_per_drive", "nfl.drive_chart", 1.5),
]


def pm(id, label, description, attack, resist, position, markets, scene) -> MechanismSpec:
    return MechanismSpec(id=f"nfl.{id}", sport=S, label=label, description=description, attack=f"nfl.{attack}",
                         resist=f"nfl.{resist}", scene=scene, weight=0, level="player", position=position, markets=markets)


# M6 player mechanisms (tactics/matchup.player_edges): a player's production (TeamIdentity.players, ranked within the
# position) against what the defense allows that position. Descriptive (weight 0) until a backtest: they explain who
# the matchup runs through, they never feed Strategy-lab angles or inference leans.
PLAYER_MECHANISMS = [
    pm("te_yards", "Tight end vs TE coverage", "A tight end's receiving yards against the TE yards this defense allows",
       "player.rec_yds", "def.te_yds_allowed", "TE", ["nfl_rec_yds", "nfl_receptions"], "nfl.pass_concept"),
    pm("te_targets", "Tight end usage vs TE targets allowed", "A tight end's target share against the TE targets this defense gives up",
       "player.target_share", "def.te_tgt_allowed", "TE", ["nfl_receptions", "nfl_rec_yds"], "nfl.pass_concept"),
    pm("wr_yards", "Receiver vs WR coverage", "A wide receiver's receiving yards against the WR yards this defense allows",
       "player.rec_yds", "def.wr_yds_allowed", "WR", ["nfl_rec_yds", "nfl_receptions"], "nfl.deep_shot"),
    pm("wr_targets", "Receiver usage vs WR targets allowed", "A wide receiver's target share against the WR targets this defense gives up",
       "player.target_share", "def.wr_tgt_allowed", "WR", ["nfl_receptions", "nfl_rec_yds"], "nfl.pass_concept"),
    pm("rb_receiving", "Back in the passing game", "A running back's receiving yards against the RB receiving yards this defense allows",
       "player.rec_yds", "def.rb_rec_yds_allowed", "RB", ["nfl_rec_yds", "nfl_receptions", "nfl_rush_rec_yds"], "nfl.pass_concept"),
    pm("rb_rushing", "Back vs run defense", "A running back's rushing yards against the rushing yards this defense allows",
       "player.rush_yds", "def.rush_yds_allowed", "RB", ["nfl_rush_yds", "nfl_rush_attempts", "nfl_rush_rec_yds"], "nfl.run_funnel"),
]
