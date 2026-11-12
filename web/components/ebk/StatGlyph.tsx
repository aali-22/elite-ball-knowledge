// A stat's picture: every stat belongs to a part of the game (threes, the glass, the ball, the pass rush…), and each
// part has a small drawing of where on the floor or the field it happens, with that place in the hot colour. A reader
// knows "this is about threes" from the arc before reading a word. One drawing per part of the game, never per stat,
// so the set stays small enough to learn.

export type Part = { key: string; name: string };

/** Which part of the game a stat belongs to, from its id ("nba.def.3pa_rate_allowed" → threes). */
export function partOf(trait?: string | null): Part {
  const t = (trait ?? "").toLowerCase();
  const nfl = t.startsWith("nfl.");
  if (!nfl) {
    if (/three|3pa|fg3/.test(t)) return { key: "threes", name: "Threes" };
    if (/efg/.test(t)) return { key: "shooting", name: "Shooting" };
    if (/reb/.test(t)) return { key: "glass", name: "The glass" };
    if (/ast_rate/.test(t)) return { key: "passing", name: "Passing" };
    if (/tov/.test(t)) return { key: "ball", name: "The ball" };
    if (/ft_rate/.test(t)) return { key: "line", name: "Free throws" };
    if (/pts_allowed/.test(t)) return { key: "matchup", name: "Who scores on them" };
    if (/pace/.test(t)) return { key: "pace", name: "Pace" };
    if (/usage/.test(t)) return { key: "usage", name: "Usage" };
    return { key: "scoring", name: "Scoring" };
  }
  if (/red_zone|rz_/.test(t)) return { key: "redzone", name: "Red zone" };
  if (/third/.test(t)) return { key: "third", name: "Third down" };
  if (/sack|pressure|hits|blitz|rushers/.test(t)) return { key: "pressure", name: "The pass rush" };
  if (/explosive|long_td|deep/.test(t)) return { key: "big", name: "Big plays" };
  if (/te_|wr_|rb_rec|rb_tgt|man_rate|rec_yds|target/.test(t)) return { key: "coverage", name: "Coverage" };
  if (/play_action|motion|screen|proe/.test(t)) return { key: "scheme", name: "Scheme" };
  if (/rush|run|box/.test(t)) return { key: "rushing", name: "The run game" };
  if (/pass/.test(t)) return { key: "passing_nfl", name: "The pass game" };
  return { key: "efficiency", name: "Efficiency" };
}

const ORDER = ["scoring", "shooting", "threes", "line", "glass", "ball", "passing", "pace", "usage", "matchup",
  "efficiency", "passing_nfl", "rushing", "big", "redzone", "third", "pressure", "coverage", "scheme"];
/** Where a part of the game sits when stats are grouped: the same order on every page, so the groups can be learned. */
export const partOrder = (key: string) => { const i = ORDER.indexOf(key); return i < 0 ? ORDER.length : i; };

/** "Offense", "Defense", "Game" or "Player", from the stat's id. */
export const sideOf = (trait?: string | null) =>
  /\.def\./.test(trait ?? "") ? "Defense" : /\.off\./.test(trait ?? "") ? "Offense" : /\.player\./.test(trait ?? "") ? "Player" : "Game";

const HOT = "var(--hot)";
const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const hot = { ...line, stroke: HOT, strokeWidth: 2.6 };
const faint = { ...line, opacity: 0.35 };

function Drawing({ part }: { part: string }) {
  switch (part) {
    case "threes": return (<>
      <path d="M4 6 H36" {...faint} /><path d="M15 6 V19 H25 V6" {...faint} /><circle cx="20" cy="9.5" r="2" {...line} />
      <path d="M7 6 V12 A13.5 13.5 0 0 0 33 12 V6" {...hot} /></>);
    case "shooting": return (<>
      <path d="M14 7 H26" {...line} /><ellipse cx="20" cy="11" rx="4" ry="1.4" {...line} />
      <circle cx="10" cy="31" r="3.2" {...line} /><path d="M12.5 28.5 Q15 9 19 10.5" {...hot} strokeDasharray="2.5 2.5" /></>);
    case "glass": return (<>
      <path d="M13 6 H27" {...line} /><ellipse cx="20" cy="10" rx="4" ry="1.4" {...line} />
      <circle cx="26" cy="27" r="3.4" {...line} /><path d="M21 12 Q27 13 26.5 22.5" {...hot} /><path d="M24 20 L26.5 23.5 L29 20" {...hot} /></>);
    case "ball": return (<>
      <circle cx="17" cy="22" r="7.5" {...line} /><path d="M9.5 22 H24.5 M17 14.5 V29.5" {...line} opacity={0.5} />
      <path d="M33 9 Q27 16 27.5 25" {...hot} /><path d="M25 22.5 L27.5 26 L30.5 23" {...hot} /></>);
    case "passing": return (<>
      <circle cx="9" cy="28" r="3" {...line} /><circle cx="20" cy="9" r="3" {...line} /><circle cx="31" cy="27" r="3" {...line} />
      <path d="M11 25 L18 12 M22.5 11 L29 24" {...hot} /></>);
    case "line": return (<>
      <path d="M14 6 V25 H26 V6" {...faint} /><circle cx="20" cy="9.5" r="2" {...line} />
      <path d="M14 25 H26" {...line} /><circle cx="20" cy="25" r="3" fill={HOT} /></>);
    case "matchup": return (<>
      <circle cx="17" cy="12" r="4.5" {...line} /><path d="M8.5 32 C8.5 23 25.5 23 25.5 32" {...line} />
      <path d="M30 20 V30 M26 26 L30 30 L34 26" {...hot} /></>);
    case "pace": return (<>
      <circle cx="20" cy="22" r="11" {...line} /><path d="M17 8 H23 M20 8 V11" {...line} /><path d="M20 22 L26 15" {...hot} /></>);
    case "usage": return (<>
      <circle cx="15" cy="11" r="4.5" {...line} /><path d="M6.5 32 C6.5 23 23.5 23 23.5 32" {...line} /><circle cx="29" cy="22" r="4.5" fill={HOT} /></>);
    case "scoring": return (<>
      <path d="M12 8 H28" {...line} /><ellipse cx="20" cy="13" rx="5.5" ry="1.8" {...line} />
      <path d="M15 14 L17 24 H23 L25 14" {...line} opacity={0.6} /><circle cx="20" cy="30" r="3.4" fill={HOT} /></>);
    case "passing_nfl": return (<>
      <path d="M4 12 H36 M4 22 H36 M4 32 H36" {...faint} /><circle cx="10" cy="33" r="2.4" {...line} />
      <path d="M11 30 Q14 6 31 9" {...hot} /><path d="M27 6.5 L31.5 9 L28 12.5" {...hot} /></>);
    case "rushing": return (<>
      <path d="M4 14 H36" {...faint} /><circle cx="11" cy="21" r="3" {...line} /><circle cx="29" cy="21" r="3" {...line} />
      <path d="M20 35 V8" {...hot} /><path d="M16 12 L20 7 L24 12" {...hot} /></>);
    case "pressure": return (<>
      <circle cx="20" cy="27" r="3.4" {...line} /><path d="M6 8 L16 22 M34 8 L24 22 M20 5 V20" {...hot} /></>);
    case "big": return (<>
      <path d="M20 6 V12 M20 28 V34 M6 20 H12 M28 20 H34 M10 10 L14 14 M26 26 L30 30 M30 10 L26 14 M14 26 L10 30" {...hot} />
      <circle cx="20" cy="20" r="4" {...line} /></>);
    case "redzone": return (<>
      <rect x="5" y="5" width="30" height="30" rx="2" {...faint} /><rect x="5" y="5" width="30" height="9" fill={HOT} opacity={0.75} />
      <path d="M5 14 H35" {...line} /><path d="M20 30 V19" {...line} /><path d="M17 22 L20 18.5 L23 22" {...line} /></>);
    case "third": return (<>
      <path d="M8 31 H32" {...faint} /><rect x="12" y="7" width="16" height="16" rx="2" {...line} />
      <text x="20" y="19.5" textAnchor="middle" fontSize="11" fontWeight="700" fill={HOT}>3</text><path d="M20 23 V31" {...line} /></>);
    case "coverage": return (<>
      <circle cx="12" cy="31" r="2.6" {...line} /><path d="M12 28 V15 H29" {...hot} /><path d="M26 12 L30 15 L26 18" {...hot} />
      <path d="M24 24 L29 29 M29 24 L24 29" {...line} /></>);
    case "scheme": return (<>
      <circle cx="10" cy="28" r="3" {...line} /><circle cx="20" cy="28" r="3" {...line} /><path d="M27 25 L33 31 M33 25 L27 31" {...line} />
      <path d="M10 25 Q12 10 28 12" {...hot} strokeDasharray="3 2.5" /></>);
    default: return (<>
      <path d="M9 31 V22 M17 31 V16 M25 31 V19" {...line} /><path d="M33 31 V9" {...hot} /></>);
  }
}

/** The stat's picture in a small tile. Decorative: the stat's name always sits beside it in words. */
export function StatGlyph({ trait, size = 44, className = "" }: { trait?: string | null; size?: number; className?: string }) {
  const part = partOf(trait);
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-xl border bg-muted/50 text-foreground ${className}`} style={{ width: size, height: size }} title={part.name}>
      <svg viewBox="0 0 40 40" width={size * 0.78} height={size * 0.78}><Drawing part={part.key} /></svg>
    </span>
  );
}
