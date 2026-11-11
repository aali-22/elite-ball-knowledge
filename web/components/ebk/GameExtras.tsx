"use client";

// Two more chapters of a game's page, each shown only when the game has it: how the game can go (the model's tree,
// drawn as nested blocks whose height is the chance of that path) and what happened before (earlier meetings with
// their box scores, and each team's last games). Results are facts; the tree is model inference and says so.
import { useMemo, useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { Seen } from "@/components/motion/Scroll";
import { slug, useGameHistory, useGameTree, type Board, type GameHistory, type GameTree } from "@/lib/ebk";
import { AWAY, HOME } from "@/lib/site";
import { Chapter } from "./BoardView";
import { type Sides } from "./Charts";
import { Crest, Face } from "./Crest";

type Node = GameTree["nodes"][number];
const pctText = (p: number) => (p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);

/** "NYG by 10+" → "Giants by 10+": the tree and the box scores are written with codes, the page speaks in names. */
const named = (text: string, sides: Sides) =>
  text.replace(/^[A-Z]{2,4}\b/, (code) => sides.names[code] ?? code);

function Tree({ tree, sides }: { tree: GameTree; sides: Sides }) {
  const [focus, setFocus] = useState<string | null>(null);
  const cols = useMemo(() => {
    const kids = new Map<string | null, Node[]>();
    for (const n of tree.nodes) kids.set(n.parent ?? null, [...(kids.get(n.parent ?? null) ?? []), n]);
    // every column lists its nodes in their parents' order, so a block sits beside the block it splits
    const out: Node[][] = [];
    let row = kids.get(null) ?? [];
    while (row.length) {
      out.push(row);
      row = row.flatMap((n) => kids.get(n.id) ?? []);
    }
    return out;
  }, [tree.nodes]);
  const ink = (n: Node) => (n.id.startsWith("w:home") ? HOME.ink : n.id.startsWith("w:away") ? AWAY.ink : "var(--viz-muted)");
  const lit = (n: Node) => focus == null || n.id === focus || n.id.startsWith(`${focus}/`) || focus.startsWith(`${n.id}/`);
  const picked = tree.nodes.find((n) => n.id === focus);
  const trail = picked ? picked.id.split("/").map((_, i, a) => tree.nodes.find((n) => n.id === a.slice(0, i + 1).join("/"))).filter((n): n is Node => !!n) : [];
  return (
    <div className="grid gap-4">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
        {tree.levels.slice(0, cols.length).map((lv) => <div key={lv.level} className="pl-label text-[10px] text-muted-foreground">{lv.label}</div>)}
      </div>
      <Seen>{(seen) => (
        <div className="grid h-[26rem] gap-2 sm:h-[30rem]" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }} onMouseLeave={() => setFocus(null)}>
          {cols.map((col, ci) => (
            <div key={ci} className="flex min-w-0 flex-col gap-0.5">
              {col.map((n, i) => (
                <button key={n.id} type="button" onMouseEnter={() => setFocus(n.id)} onFocus={() => setFocus(n.id)} onClick={() => setFocus(n.id === focus ? null : n.id)}
                  aria-pressed={focus === n.id} title={`${named(n.label, sides)}: ${pctText(n.p)} of games${n.n ? ` (n=${n.n.toLocaleString()})` : ""}`}
                  className="group relative min-h-0 overflow-hidden rounded-md text-left transition-[flex-grow,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                  style={{ flexGrow: seen ? Math.max(n.p, 0.004) : 1 / col.length, flexBasis: 0, opacity: lit(n) ? 1 : 0.22, transitionDelay: `${ci * 90 + Math.min(i, 10) * 12}ms` }}>
                  <span className="absolute inset-0" style={{ background: ink(n), opacity: 0.9 - ci * 0.22 }} />
                  {n.p >= 0.045 && (
                    <span className="relative flex h-full items-center justify-between gap-2 px-2.5 text-white">
                      <span className="min-w-0 truncate text-xs font-medium sm:text-sm">{named(n.label, sides)}</span>
                      <span className="tabular shrink-0 text-xs font-semibold sm:text-sm">{pctText(n.p)}</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}</Seen>
      <p className="min-h-10 text-sm leading-relaxed" aria-live="polite">
        {picked
          ? <>{trail.map((n, i) => <span key={n.id}>{i > 0 && <span className="text-muted-foreground"> → </span>}{named(n.label, sides)}</span>)}: <b>{pctText(picked.p)}</b> of games
            {picked.parent && <span className="text-muted-foreground"> ({pctText(picked.p_cond)} of the time once the step before has happened)</span>}.</>
          : <span className="text-muted-foreground">Each block&apos;s height is the share of games that go that way. Point at one to follow its path from left to right.</span>}
      </p>
      <ul className="grid gap-1 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
        {tree.sources.map((s) => <li key={s.id}><b className="font-medium text-foreground">{s.label}.</b> {s.detail}{s.n ? ` (n=${s.n.toLocaleString()})` : ""}</li>)}
      </ul>
    </div>
  );
}

function Meetings({ h, sides, sport }: { h: GameHistory; sides: Sides; sport: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const cols = h.columns.slice(0, 6);
  const nm = (t: string) => sides.names[t] ?? t;
  const wins = (t: string) => h.record[t] ?? 0;
  const total = Math.max(1, wins(sides.home) + wins(sides.away) + (h.record.T ?? 0));
  return (
    <div className="grid gap-4">
      {h.meetings.length > 0 && (
        <div className="grid gap-2">
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            <span className="h-full" style={{ width: `${(wins(sides.away) / total) * 100}%`, background: AWAY.ink }} />
            <span className="h-full flex-1" style={{ background: HOME.ink }} />
          </div>
          <div className="tabular flex justify-between text-sm"><span><b>{wins(sides.away)}</b> {nm(sides.away)}</span><span className="text-muted-foreground">last {h.meetings.length} meetings</span><span>{nm(sides.home)} <b>{wins(sides.home)}</b></span></div>
        </div>
      )}
      <ol className="grid gap-1">
        {h.meetings.map((m) => {
          const box = h.boxes[m.event_id];
          const on = open === m.event_id;
          return (
            <li key={m.event_id} className="rounded-xl border">
              <button type="button" disabled={!box} aria-expanded={on} onClick={() => setOpen(on ? null : m.event_id)}
                className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left enabled:hover:bg-muted/50">
                <span className="tabular text-xs text-muted-foreground">{new Date(m.start).toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" })}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {[m.away, m.home].map((t) => (
                    <span key={t} className={`flex items-center gap-1.5 ${m.winner === t ? "font-semibold" : "text-muted-foreground"}`}>
                      <Crest sport={sport} team={t} name={nm(t)} size={18} /><span className="truncate">{nm(t)}</span><span className="tabular">{m.scores[t]}</span>
                    </span>
                  ))}
                  {m.overtime && <span className="pl-label text-[9px] text-muted-foreground">OT</span>}
                  {m.season_type !== "regular" && <span className="pl-label text-[9px] text-muted-foreground">{m.season_type}</span>}
                </span>
                {box && <span className="pl-label text-[10px] text-muted-foreground">{on ? "Hide" : "Box"}</span>}
              </button>
              {on && box && (
                <div className="grid gap-4 border-t p-3 sm:grid-cols-2">
                  {[m.away, m.home].map((t) => (
                    <div key={t} className="min-w-0 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2 font-normal">{nm(t)}</th>{cols.map((c) => <th key={c.key} className="px-1 py-1 text-right font-normal">{c.label}</th>)}</tr></thead>
                        <tbody className="tabular">
                          {(box[t] ?? []).filter((l) => l.played).slice(0, 8).map((l) => (
                            <tr key={l.player_id} className="border-t">
                              <td className="flex items-center gap-1.5 py-1 pr-2"><Face playerId={l.player_id} name={l.name ?? "?"} size={18} /><span className="truncate">{l.name ?? "Unnamed"}</span></td>
                              {cols.map((c) => <td key={c.key} className="px-1 py-1 text-right">{l.stats[c.key] == null ? "—" : c.pair ? `${l.stats[c.key]}-${l.stats[c.pair] ?? "—"}` : l.stats[c.key]}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="grid gap-4 sm:grid-cols-2">
        {[sides.away, sides.home].map((t) => (
          <Reveal key={t} className="pl-reading grid gap-2 rounded-2xl border p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Crest sport={sport} team={t} name={nm(t)} size={22} />{nm(t)}: last {(h.form[t] ?? []).length}</h3>
            <ol className="grid gap-1">
              {(h.form[t] ?? []).map((g) => (
                <li key={g.event_id} className="grid grid-cols-[1.4rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                  <span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold text-white ${g.result === "W" ? "bg-[var(--status-good)]" : g.result === "L" ? "bg-[var(--status-critical)]" : "bg-muted-foreground"}`}>{g.result}</span>
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">{g.home ? "v" : "at"}<Crest sport={sport} team={g.opponent} name={g.opponent} size={16} /><span className="truncate">{g.opponent}</span></span>
                  <span className="tabular">{g.pts_for}–{g.pts_against}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Only games before this one&apos;s start. {h.meetings[0]?.source ?? ""}</p>
    </div>
  );
}

/** The chapters a scheduled NBA or NFL game adds after its board; nothing renders until one of them has data. */
export function GameExtras({ b, sides, num }: { b: Board; sides: Sides; num: () => string }) {
  const id = slug(b.event_id);
  const on = b.sport === "nba" || b.sport === "nfl";
  const tree = useGameTree(id, on), history = useGameHistory(id, on);
  return (
    <>
      {tree.data && tree.data.nodes.length > 0 && (
        <Chapter n={num()} title="How it can go" lede="The model splits the game into paths: who wins, who leads at the half, and by how much. Model inference, not a forecast of record.">
          <div className="pl-reading rounded-3xl border p-4 sm:p-6"><Tree tree={tree.data} sides={sides} /></div>
        </Chapter>
      )}
      {history.data && (history.data.meetings.length > 0 || Object.keys(history.data.form).length > 0) && (
        <Chapter n={num()} title="What happened before" lede="The last times these two met, with the box score behind each result, and how each has played lately.">
          <Meetings h={history.data} sides={sides} sport={b.sport} />
        </Chapter>
      )}
    </>
  );
}
