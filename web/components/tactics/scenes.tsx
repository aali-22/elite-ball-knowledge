"use client";

// Scene templates, keyed by the ontology's mechanism scenes. A scene is a short choreography in real units; `win` (the
// attacking side has the better of this matchup, from the computed edge) decides how it ends. The LLM never draws:
// scenes are fixed templates, and every number on screen comes from the report.
import { Ball, Court, Field, HOOP, Pitch, Player, Tag, Trail, along, type Pt } from "./fields";

export type SceneProps = { t: number; win: boolean; a: string; d: string; aLabel: string; dLabel: string };

const after = (t: number, from: number) => t >= from;
const seg = (t: number, from: number, to: number) => Math.max(0, Math.min(1, (t - from) / (to - from)));

// ---- NFL (offense moves right; line of scrimmage at x = 55, middle of the field y = 26.65) -------------------------
const LOS = 55, MID = 26.65;
const OL: Pt[] = [22.65, 24.65, 26.65, 28.65, 30.65].map((y) => [LOS - 0.8, y]);

function Line({ t, a, d, push = 0 }: { t: number; a: string; d: string; push?: number }) {
  return <>{OL.map((p, i) => <Player key={`o${i}`} at={[p[0] - push * seg(t, 0.05, 0.5), p[1]]} color={a} r={0.95} />)}
    {[24, 26, 28.4].map((y, i) => <Player key={`d${i}`} at={[LOS + 1 - push * seg(t, 0.05, 0.5), y]} color={d} r={0.95} />)}</>;
}

function PassRush({ t, win, a, d }: SceneProps) {
  const qb = along([[LOS - 1.5, MID], [LOS - 7, MID]], seg(t, 0, 0.3));
  const edge = win ? along([[LOS + 1, 33.5], [LOS - 3, 35.5], [LOS - 6, 34]], seg(t, 0.05, 0.7))
    : along([[LOS + 1, 33.5], [LOS - 3, 33.5], [LOS - 7, 28]], seg(t, 0.05, 0.72));
  const wr = along([[LOS, 16], [LOS + 10, 16], [LOS + 15, 21]], seg(t, 0, 0.75));
  const thrown = win && after(t, 0.58);
  const ball = thrown ? along([qb, [LOS + 15, 21]], seg(t, 0.58, 0.8)) : qb;
  return (<Field attack={a} defend={d} focus={[35, 80]}>
    <Line t={t} a={a} d={d} push={1.5} />
    <Trail path={[[LOS + 1, 33.5], [LOS - 3, win ? 35.5 : 33.5], win ? [LOS - 6, 34] : [LOS - 7, 28]]} color={d} dashed />
    <Trail path={[[LOS, 16], [LOS + 10, 16], [LOS + 15, 21]]} color={a} dashed />
    <Player at={edge} color={d} label="E" ring={!win} />
    <Player at={wr} color={a} label="W" /><Player at={qb} color={a} label="Q" ring />
    <Ball at={ball} />
    {after(t, 0.74) && <Tag at={[LOS - 7, 21]} text={win ? "Clean pocket" : "Sack"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Field>);
}

function DeepShot({ t, win, a, d }: SceneProps) {
  const qb = along([[LOS - 1.5, MID], [LOS - 7, MID]], seg(t, 0, 0.3));
  const wr = along([[LOS, 11], [LOS + 20, 11.5], [LOS + 40, 13]], seg(t, 0, 0.85));
  const cb = along([[LOS + 6, 12], [LOS + 22, 13], [LOS + 37, 14.5]], seg(t, 0, 0.85));
  const s = along([[LOS + 18, MID], win ? [LOS + 28, 21] : [LOS + 36, 15]], seg(t, 0.25, 0.85));
  const ball = after(t, 0.45) ? along([qb, [LOS + 39, 13]], seg(t, 0.45, 0.85)) : qb;
  return (<Field attack={a} defend={d} focus={[40, 100]}>
    <Line t={t} a={a} d={d} />
    <Trail path={[[LOS, 11], [LOS + 40, 13]]} color={a} dashed /><Trail path={[[LOS + 18, MID], win ? [LOS + 28, 21] : [LOS + 36, 15]]} color={d} dashed />
    <Player at={wr} color={a} label="W" ring /><Player at={cb} color={d} label="C" /><Player at={s} color={d} label="S" ring={!win} />
    <Player at={qb} color={a} label="Q" /><Ball at={ball} />
    {after(t, 0.86) && <Tag at={[LOS + 36, 20]} text={win ? "Explosive: +40" : "Broken up"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Field>);
}

function PassConcept({ t, win, a, d }: SceneProps) {
  const qb = along([[LOS - 1.5, MID], [LOS - 5, MID]], seg(t, 0, 0.25));
  const slant = along([[LOS, 16], [LOS + 5, 16], [LOS + 11, 22], [LOS + (win ? 20 : 11.5), win ? 24 : 22.5]], seg(t, 0, 0.9), [0, .25, .55, 1]);
  const lb = along([[LOS + 5, 24], [LOS + (win ? 7 : 10.5), win ? 27 : 22.3]], seg(t, 0.15, 0.55));
  const curl = along([[LOS, 36], [LOS + 11, 36], [LOS + 9.5, 35.5]], seg(t, 0, 0.6));
  const ball = after(t, 0.42) ? along([qb, [LOS + 11, 22]], seg(t, 0.42, 0.56)) : qb;
  return (<Field attack={a} defend={d} focus={[38, 82]}>
    <Line t={t} a={a} d={d} />
    <Trail path={[[LOS, 16], [LOS + 5, 16], [LOS + 11, 22]]} color={a} dashed /><Trail path={[[LOS, 36], [LOS + 11, 36], [LOS + 9.5, 35.5]]} color={a} dashed />
    <Player at={slant} color={a} label="W" ring /><Player at={curl} color={a} label="W" />
    <Player at={lb} color={d} label="L" ring={!win} /><Player at={[LOS + 12, 37]} color={d} label="C" />
    <Player at={qb} color={a} label="Q" /><Ball at={after(t, 0.56) ? (win ? slant : lb) : ball} />
    {after(t, 0.8) && <Tag at={[LOS + 14, 30]} text={win ? "Completion + YAC" : "Undercut"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Field>);
}

function RunFunnel({ t, win, a, d }: SceneProps) {
  const rb = along([[LOS - 6, MID], [LOS - 1, 25], [LOS + 4, 23], win ? [LOS + 16, 18] : [LOS + 1.5, 24.5]], seg(t, 0.1, 0.85), [0, .35, .6, 1]);
  const box = [[LOS + 4, 21], [LOS + 4.5, 31], [LOS + 6, 26.6], [LOS + 1.2, 22], [LOS + 1.2, 31.5]].map((p, i) =>
    along([p as Pt, win ? [p[0] - 1, p[1] + (i % 2 ? 1.5 : -1.5)] as Pt : [LOS + 2, 24.5] as Pt], seg(t, 0.35, 0.8)));
  return (<Field attack={a} defend={d} focus={[38, 82]}>
    <Line t={t} a={a} d={d} push={-1} />
    <Trail path={[[LOS - 6, MID], [LOS - 1, 25], [LOS + 4, 23], win ? [LOS + 16, 18] : [LOS + 1.5, 24.5]]} color={a} dashed />
    {box.map((p, i) => <Player key={i} at={p} color={d} label="D" />)}
    <Player at={[LOS - 3, MID]} color={a} label="Q" /><Player at={rb} color={a} label="R" ring /><Ball at={rb} />
    {after(t, 0.82) && <Tag at={[LOS + 10, 31]} text={win ? "Explosive run" : "Stuffed"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Field>);
}

function ThirdDown({ t, win, a, d }: SceneProps) {
  const sticks = LOS + 7;
  const wr = along([[LOS, 18], [LOS + 6, 18], [win ? sticks + 2 : sticks - 1.5, 21]], seg(t, 0, 0.8));
  const qb = along([[LOS - 1.5, MID], [LOS - 5, MID]], seg(t, 0, 0.25));
  return (<Field attack={a} defend={d} focus={[30, 90]}>
    <line x1={sticks} x2={sticks} y1={0} y2={53.3} stroke="#facc15" strokeWidth={0.5} />
    <Tag at={[sticks, 12]} text="3rd & 7" tone="#a16207" />
    <Line t={t} a={a} d={d} />
    <Player at={wr} color={a} label="W" ring /><Player at={along([[LOS + 9, 17], [win ? sticks + 3 : sticks - 0.5, 20.5]], seg(t, 0.3, 0.8))} color={d} label="C" />
    <Player at={qb} color={a} label="Q" /><Ball at={after(t, 0.5) ? along([qb, wr], seg(t, 0.5, 0.75)) : qb} />
    {after(t, 0.82) && <Tag at={[sticks, 30]} text={win ? "Moves the chains" : "Short: punt"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Field>);
}

function RedZone({ t, win, a, d }: SceneProps) {
  const L = 100;
  const qb = along([[L - 1.5, MID], [L - 6, MID]], seg(t, 0, 0.3));
  const wr = along([[L, 18], [L + 6, 18], [L + 12, win ? 24 : 21]], seg(t, 0, 0.75));
  const kick = !win && after(t, 0.75);
  return (<Field attack={a} defend={d} focus={[80, 120]}>
    {[[L + 4, 20], [L + 8, 26], [L + 6, 33], [L + 2, 24], [L + 2, 30]].map((p, i) =>
      <Player key={i} at={along([p as Pt, [p[0] + 2, p[1] + (win ? 3 : -1)] as Pt], seg(t, 0.2, 0.7))} color={d} label="D" />)}
    <Player at={wr} color={a} label="W" ring={win} /><Player at={qb} color={a} label="Q" />
    <Ball at={kick ? along([[L - 7, MID], [120, MID]], seg(t, 0.75, 0.95)) : after(t, 0.5) && win ? along([qb, wr], seg(t, 0.5, 0.75)) : qb} />
    {after(t, 0.78) && <Tag at={[110, 17]} text={win ? "Touchdown" : "Field goal"} tone={win ? "#15803d" : "#a16207"} />}
  </Field>);
}

function DriveChart({ t, win, a, d }: SceneProps) {
  const end = win ? 110 : 82;
  const x = 25 + (end - 25) * seg(t, 0.05, 0.85);
  return (<Field attack={a} defend={d}>
    <rect x={25} y={MID - 1} width={x - 25} height={2} fill={a} opacity={0.8} rx={1} />
    <Player at={[x, MID]} color={a} label="▶" r={1.4} />
    {after(t, 0.86) && <Tag at={[end - 6, MID - 6]} text={win ? "Touchdown drive" : "Stalls: field goal"} tone={win ? "#15803d" : "#a16207"} />}
  </Field>);
}

// ---- Soccer (attacking right, goal at x = 105) ------------------------------------------------------------------------
function OffsideTrap({ t, win, a, d }: SceneProps) {
  const lineX = win ? 80 + 1 * seg(t, 0.4, 0.6) : 80 + 4.5 * seg(t, 0.25, 0.4);
  const backs: Pt[] = [14, 27, 41, 54].map((y) => [lineX, y]);
  const striker = along([[79, 34], [85, 33], [97, 32]], seg(t, 0.3, 0.8), [0, .25, 1]);
  const passer: Pt = [62, 42];
  const passAt = 0.4;
  const ball = after(t, passAt) ? along([passer, win ? [97, 32] : [90, 33]], seg(t, passAt, 0.72)) : passer;
  return (<Pitch>
    <line x1={lineX} x2={lineX} y1={0} y2={68} stroke={d} strokeWidth={0.4} strokeDasharray="1.2 0.8" />
    {backs.map((p, i) => <Player key={i} at={p} color={d} r={1.2} />)}
    <Player at={[103, 34]} color="#facc15" label="GK" r={1.1} />
    <Player at={passer} color={a} label="8" r={1.2} /><Player at={striker} color={a} label="9" r={1.2} ring />
    <Ball at={ball} soccer />
    {after(t, 0.45) && !win && <Tag at={[86, 26]} text="Offside: trap sprung" tone="#b91c1c" />}
    {after(t, 0.78) && win && <Tag at={[95, 25]} text="Through on goal" tone="#15803d" />}
  </Pitch>);
}

function PressTrap({ t, win, a, d }: SceneProps) {
  const fb: Pt = [20, 6];
  const pressers = ([[30, 22], [32, 36], [34, 50]] as Pt[]).map((p, i) =>
    along([p, i === 0 ? [21.5, 9] : i === 1 ? [24, 12] : [30, 18]], seg(t, 0.3, 0.6)));
  const ball = after(t, 0.6) && win ? along([fb, [42, 14]], seg(t, 0.6, 0.8))
    : after(t, 0.25) ? along([[12, 24], fb], seg(t, 0.25, 0.4)) : [12, 24] as Pt;
  return (<Pitch>
    <Player at={[3, 34]} color={a} label="GK" r={1.1} /><Player at={[12, 24]} color={a} label="4" r={1.2} /><Player at={[12, 44]} color={a} label="5" r={1.2} />
    <Player at={fb} color={a} label="2" r={1.2} ring /><Player at={[42, 14]} color={a} label="8" r={1.2} />
    {pressers.map((p, i) => <Player key={i} at={p} color={d} r={1.2} />)}
    <Ball at={ball} soccer />
    {after(t, 0.65) && <Tag at={[30, 4]} text={win ? "Press beaten" : "Trapped: turnover"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Pitch>);
}

function Shape({ t, win, a, d, aLabel, dLabel }: SceneProps) {
  const atk: Pt[] = [[8, 34], [22, 12], [20, 28], [20, 40], [22, 56], [40, 22], [38, 34], [40, 46], [62, 14], [66, 34], [62, 54]];
  const def: Pt[] = [[97, 34], [84, 14], [86, 28], [86, 40], [84, 54], [72, 16], [70, 28], [70, 40], [72, 52], [58, 28], [58, 40]];
  const push = seg(t, 0.1, 0.8) * (win ? 6 : 2);
  return (<Pitch>
    {atk.map((p, i) => <Player key={`a${i}`} at={[p[0] + push, p[1]]} color={a} r={1.1} />)}
    {def.map((p, i) => <Player key={`d${i}`} at={[p[0] + push * 0.6, p[1]]} color={d} r={1.1} />)}
    {[14, 34, 54].map((y) => <Trail key={y} path={[[66 + push, y], [95, 34 + (y - 34) * 0.3]]} color={a} dashed opacity={win ? 0.8 : 0.3} />)}
    <Tag at={[25, 4]} text={aLabel} tone={a} /><Tag at={[80, 4]} text={dLabel} tone={d} />
  </Pitch>);
}

function SetPiece({ t, win, a, d }: SceneProps) {
  const ball = along([[105, 0.5], [97, win ? 30 : 36], win ? [104, 33] : [80, 40]], seg(t, 0.15, 0.85), [0, .6, 1]);
  return (<Pitch>
    <rect x={94} y={26} width={6} height={8} fill="#facc15" opacity={0.18} /><rect x={94} y={36} width={6} height={8} fill="#facc15" opacity={0.1} />
    {([[96, 29], [95, 35], [98, 38], [93, 32]] as Pt[]).map((p, i) => <Player key={`a${i}`} at={along([p, [p[0] + 1, p[1] - 1]], seg(t, 0.2, 0.6))} color={a} r={1.1} ring={i === 0 && win} />)}
    {([[97, 31], [96, 37], [99, 34], [94, 30]] as Pt[]).map((p, i) => <Player key={`d${i}`} at={p} color={d} r={1.1} />)}
    <Player at={[103, 34]} color="#facc15" label="GK" r={1.1} /><Ball at={ball} soccer />
    {after(t, 0.86) && <Tag at={[90, 22]} text={win ? "Near-post header" : "Cleared"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Pitch>);
}

// ---- NBA (feet; attacking the right basket, HOOP = [88.75, 25]) ---------------------------------------------------
const CORNER_T: Pt = [91, 3.5], CORNER_B: Pt = [91, 46.5];

function HalfCourt({ t, win, a, d }: SceneProps) { // pick-and-roll against a drop big
  const g = along([[64, 27], [69, 23], [73, 21]], seg(t, 0, 0.5));
  const c = along([[69, 25.5], [69, 25.5], [win ? 84 : 81, 25.5]], seg(t, 0.1, 0.6), [0, .35, 1]);
  const big = along([[80, 25], win ? [75, 22.5] : [79, 24]], seg(t, 0.25, 0.55));
  const gd = along([[66, 28], [69, 27.5], [72, 24]], seg(t, 0, 0.6));
  const ball = win ? (after(t, 0.62) ? along([g, c, HOOP], seg(t, 0.55, 0.85)) : g)
    : after(t, 0.55) ? along([[73, 21], [86, 23], [83, 31]], seg(t, 0.55, 0.9), [0, .7, 1]) : g;
  return (<Court>
    <Trail path={[[69, 25.5], [win ? 84 : 81, 25.5]]} color={a} dashed /><Trail path={[[64, 27], [69, 23], [73, 21]]} color={a} dashed />
    {[CORNER_T, CORNER_B, [70, 6] as Pt].map((p, i) => <Player key={i} at={p} color={a} label="F" r={1.25} />)}
    {[[88, 7], [88, 43], [72, 9]].map((p, i) => <Player key={i} at={p as Pt} color={d} r={1.25} />)}
    <Player at={gd} color={d} r={1.25} /><Player at={big} color={d} label="C" r={1.25} ring={!win} />
    <Player at={c} color={a} label="C" r={1.25} ring={win} /><Player at={g} color={a} label="G" r={1.25} />
    <Ball at={ball} hoops />
    {after(t, 0.82) && <Tag at={[70, 36]} text={win ? "Roll man: layup" : "Contested pull-up"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Court>);
}

function Transition({ t, win, a, d }: SceneProps) { // bringing it up against pressure
  const g = win ? along([[20, 25], [40, 23], [55, 26], [72, 24]], seg(t, 0, 0.75)) : along([[20, 25], [40, 23], [46, 24.5]], seg(t, 0, 0.45));
  const pest = win ? along([[44, 26], [45, 24], [55, 27]], seg(t, 0.2, 0.8)) : along([[44, 26], [46, 24.5], [12, 25]], seg(t, 0.25, 0.95), [0, .25, 1]);
  const ball = win || !after(t, 0.45) ? g : pest;
  return (<Court focus={[0, 94]}>
    <Trail path={win ? [[20, 25], [40, 23], [55, 26], [72, 24]] : [[46, 24.5], [12, 25]]} color={win ? a : d} dashed />
    {[[30, 8], [32, 42], [26, 30]].map((p, i) => <Player key={i} at={along([p as Pt, [p[0] + (win ? 40 : 14), p[1]] as Pt], seg(t, 0, 0.8))} color={a} r={1.25} />)}
    {[[60, 10], [62, 40], [70, 25]].map((p, i) => <Player key={i} at={p as Pt} color={d} r={1.25} />)}
    <Player at={g} color={a} label="G" r={1.25} ring={win} /><Player at={pest} color={d} label="G" r={1.25} ring={!win} />
    <Ball at={ball} hoops />
    {after(t, 0.7) && <Tag at={win ? [70, 14] : [20, 14]} text={win ? "Clean entry" : "Turnover: fast break"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Court>);
}

function Glass({ t, win, a, d }: SceneProps) { // a miss, and who gets the second chance
  const shooter: Pt = [70, 10];
  const crash = along([[78, 18], [83, 26], [84, 31]], seg(t, 0.2, 0.6));
  const box = along([[85, 24], win ? [86, 27] : [84.5, 30]], seg(t, 0.25, 0.55));
  const ball = !after(t, 0.15) ? shooter : !after(t, 0.62) ? along([shooter, [87.5, 24.5], [84, 31]], seg(t, 0.15, 0.62), [0, .65, 1])
    : win ? along([[84, 31], HOOP], seg(t, 0.68, 0.85)) : along([[84, 31], [70, 30]], seg(t, 0.7, 0.9));
  return (<Court>
    <Trail path={[[78, 18], [83, 26], [84, 31]]} color={a} dashed />
    <Player at={shooter} color={a} label="G" r={1.25} /><Player at={[72, 13]} color={d} r={1.25} />
    {[[82, 40], [66, 30]].map((p, i) => <Player key={i} at={p as Pt} color={a} label="F" r={1.25} />)}
    {[[82, 36], [70, 28], [86, 20]].map((p, i) => <Player key={i} at={p as Pt} color={d} r={1.25} />)}
    <Player at={crash} color={a} label="C" r={1.25} ring={win} /><Player at={box} color={d} label="C" r={1.25} ring={!win} />
    <Ball at={ball} hoops />
    {after(t, 0.8) && <Tag at={[72, 44]} text={win ? "Offensive board: putback" : "Defensive rebound"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Court>);
}

function Spacing({ t, win, a, d }: SceneProps) { // drive and kick to the corner
  const g = along([[62, 25], [72, 23], [80, 21.5]], seg(t, 0, 0.4));
  const help = win ? along([[87, 8], [82, 19], [84, 12]], seg(t, 0.15, 0.85), [0, .4, 1]) : along([[87, 8], [83, 18], [90, 6]], seg(t, 0.15, 0.7), [0, .45, 1]);
  const ball = after(t, 0.45) ? (win && after(t, 0.68) ? along([CORNER_T, HOOP], seg(t, 0.68, 0.9)) : along([g, CORNER_T], seg(t, 0.45, 0.62))) : g;
  return (<Court>
    <Trail path={[[62, 25], [72, 23], [80, 21.5]]} color={a} dashed /><Trail path={win ? [[87, 8], [82, 19], [84, 12]] : [[87, 8], [83, 18], [90, 6]]} color={d} dashed />
    <Player at={CORNER_T} color={a} label="F" r={1.25} ring /><Player at={CORNER_B} color={a} label="F" r={1.25} />
    <Player at={[68, 42]} color={a} label="G" r={1.25} /><Player at={[84, 31]} color={a} label="C" r={1.25} />
    {[[86, 41], [70, 38], [83, 28], [66, 27]].map((p, i) => <Player key={i} at={p as Pt} color={d} r={1.25} />)}
    <Player at={help} color={d} r={1.25} ring={!win} /><Player at={g} color={a} label="G" r={1.25} />
    <Ball at={ball} hoops />
    {after(t, 0.75) && <Tag at={[74, 6]} text={win ? "Open corner three" : "Run off the line"} tone={win ? "#15803d" : "#b91c1c"} />}
  </Court>);
}

export const SCENES: Record<string, (p: SceneProps) => React.ReactElement> = {
  "nfl.pass_rush": PassRush, "nfl.deep_shot": DeepShot, "nfl.pass_concept": PassConcept, "nfl.run_funnel": RunFunnel,
  "nfl.third_down": ThirdDown, "nfl.red_zone": RedZone, "nfl.drive_chart": DriveChart,
  "soccer.offside_trap": OffsideTrap, "soccer.press_trap": PressTrap, "soccer.shape": Shape, "soccer.set_piece": SetPiece,
  "nba.half_court": HalfCourt, "nba.transition": Transition, "nba.glass": Glass, "nba.spacing": Spacing,
};
