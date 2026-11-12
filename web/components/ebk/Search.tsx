"use client";

// The search palette: every team, player and game that has a page, plus the site's sections. Loaded on first open.
import { CommandPalette } from "@astryxdesign/core/CommandPalette";
import type { SearchSource, SearchableItem } from "@astryxdesign/core/Typeahead";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SPORT, gameHref, patient, playerHref, teamHref, when, type SearchIndex } from "@/lib/ebk";
import { Crest, Face } from "./Crest";
import { useViewNav } from "./Shell";

type Hit = SearchableItem<{ group: string; href: string; sub: string; kind: "team" | "player" | "game" | "page"; sport?: string; team?: string; playerId?: string; keys: string[] }>;

const PAGES: Hit[] = [
  { id: "page:/games", label: "Games", auxiliaryData: { group: "Pages", href: "/games", sub: "Every game with a breakdown", kind: "page", keys: ["slate", "schedule"] } },
  { id: "page:/findings", label: "Findings", auxiliaryData: { group: "Pages", href: "/findings", sub: "Everything the numbers noticed", kind: "page", keys: ["insights", "mismatch"] } },
  { id: "page:/compare", label: "Compare two teams", auxiliaryData: { group: "Pages", href: "/compare", sub: "Any two teams as if they met today", kind: "page", keys: ["versus", "what if"] } },
  { id: "page:/models", label: "How it works", auxiliaryData: { group: "Pages", href: "/models", sub: "The method, with formulas to play with", kind: "page", keys: ["method", "models"] } },
  { id: "page:/picklab/experts", label: "Analyst records", auxiliaryData: { group: "Pages", href: "/picklab/experts", sub: "PickLab: who is actually right", kind: "page", keys: ["picklab", "experts", "records"] } },
];

const BUSY: Hit = { id: "busy", label: "Search couldn't load just now", auxiliaryData: { group: "Pages", href: "", sub: "Too many requests at once. Type again in a few seconds.", kind: "page", keys: [] } };

const STOP = new Set(["tonight", "today", "game", "games", "vs", "v", "at", "the", "team", "player", "stats"]);

function build(d: SearchIndex | null): Hit[] {
  if (!d) return PAGES;
  return [
    ...d.teams.map((t): Hit => ({ id: `team:${t.sport}:${t.team}`, label: t.full_name, auxiliaryData: { group: "Teams", href: teamHref(t.sport, t.team),
      sub: SPORT[t.sport] ?? t.sport, kind: "team", sport: t.sport, team: t.team, keys: [t.team, t.name] } })),
    ...d.games.map((g): Hit => ({ id: `game:${g.event_id}`, label: g.label, auxiliaryData: { group: "Games", href: gameHref(g.event_id),
      sub: [SPORT[g.sport] ?? g.sport, when(g.start)?.day, when(g.start)?.started ? "played" : null].filter(Boolean).join(" · "), kind: "game", keys: [] } })),
    ...d.players.map((p): Hit => ({ id: `player:${p.player_id}`, label: p.name, auxiliaryData: { group: "Players", href: playerHref(p.player_id),
      sub: `${p.position} · ${p.team_name}`, kind: "player", sport: p.sport, team: p.team, playerId: p.player_id, keys: [p.team_name, p.team] } })),
    ...PAGES,
  ];
}

/** Every word of the query must be found (case and accents ignored; filler words like "tonight" dropped). A name that
 *  starts with the query ranks first, then a word that does, then anything containing it; teams before games before players. */
function rank(items: Hit[], q: string): Hit[] {
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = norm(q).split(/[^a-z0-9.']+/).filter((w) => w && !STOP.has(w));
  if (!words.length) return [];
  const whole = words.join(" ");
  const order = { team: 0, game: 1, player: 2, page: 3 };
  return items.flatMap((i) => {
    const hay = [i.label, ...i.auxiliaryData!.keys].map(norm);
    const parts = hay.flatMap((h) => h.split(/[\s@-]+/));
    // a short query ("phi") must start a word or be a team's code; only a longer one may sit inside a word
    if (!words.every((w) => parts.some((p) => p.startsWith(w)) || (w.length >= 4 && hay.some((h) => h.includes(w))))) return [];
    // a game is named after two teams: whichever comes first in its label is no better a match than the other
    // only an item's own name can make it a top match: a player isn't "lakers" because his team is
    const own = hay[0];
    const score = i.auxiliaryData!.kind !== "game" && (own === whole || own.startsWith(whole) || (i.auxiliaryData!.kind === "team" && hay.includes(whole))) ? (hay.includes(whole) && i.auxiliaryData!.kind === "team" ? -1 : 0) : words.every((w) => parts.some((p) => p.startsWith(w))) ? 1 : 2;
    return [[score, order[i.auxiliaryData!.kind], i] as const];
  }).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 24).map(([, , i]) => i);
}

/** One slip of the finger: names within one edit of a typed word (two for a long word), closest first. */
function near(items: Hit[], q: string): Hit[] {
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const w = norm(q).trim();
  if (w.length < 4 || w.includes(" ")) return [];
  const dist = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0]; row[0] = i;
      for (let j = 1; j <= b.length; j++) { const keep = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = keep; }
    }
    return row[b.length];
  };
  const max = w.length >= 7 ? 2 : 1;
  return items.flatMap((i) => {
    const best = Math.min(...[i.label, ...i.auxiliaryData!.keys].flatMap((h) => norm(h).split(/[\s@-]+/)).map((p) => dist(w, p)));
    return best <= max && i.auxiliaryData!.kind !== "game" ? [[best, i] as const] : [];
  }).sort((a, b) => a[0] - b[0]).slice(0, 8).map(([, i]) => i);
}

export function Search({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const go = useViewNav();
  const qc = useQueryClient();
  // a touch screen has no Escape key and no use for keyboard hints: it gets a close button in the footer instead
  const [touch, setTouch] = useState(false);
  useEffect(() => { setTouch(window.matchMedia("(pointer: coarse)").matches); }, []);
  const items = useRef<Hit[]>(PAGES);
  const failed = useRef(false); // the index didn't load: say so instead of "nothing by that name"
  // The index is fetched once and awaited by every search, so a query typed before it arrives still gets its answer.
  const load = useCallback(async () => {
    try {
      const d = await qc.ensureQueryData<SearchIndex | null>({ queryKey: ["ebk", "index"], staleTime: 10 * 60_000,
        // a failed load throws, so it is never cached as "the site has no pages": the next search asks again
        queryFn: async () => { const r = await patient("/api/public/analytics/index"); if (!r.ok) throw new Error(`index ${r.status}`); return r.json(); } });
      items.current = build(d);
      failed.current = false;
    } catch { items.current = PAGES; failed.current = true; }
    return items.current;
  }, [qc]);
  const shown = useRef<Hit[]>([]); // what the list holds right now, best match first
  const source = useMemo<SearchSource<Hit>>(() => ({
    bootstrap: async () => { const all = await load(); return (shown.current = [...all.filter((i) => i.auxiliaryData!.kind === "game").slice(0, 5), ...PAGES]); },
    search: async (q) => {
      const all = await load();
      const hits = rank(all, q);
      const found = hits.length ? hits : near(all, q);
      return (shown.current = found.length || !failed.current ? found : [BUSY]);
    },
  }), [load]);
  const pick = useCallback((id: string) => {
    if (id === BUSY.id) return; // not a page: typing again retries the load
    const hit = items.current.find((i) => i.id === id);
    if (hit) { setOpen(false); go(hit.auxiliaryData!.href); }
  }, [go, setOpen]);
  // Enter with nothing highlighted goes to the best match (the palette itself only acts on a highlighted row).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const box = e.target as HTMLElement | null;
      if (e.key !== "Enter" || e.isComposing || box?.getAttribute("role") !== "combobox" || box.getAttribute("aria-activedescendant")) return;
      const first = shown.current[0];
      if (first && (box as HTMLInputElement).value.trim()) { e.preventDefault(); e.stopPropagation(); pick(first.id); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, pick]);
  return (
    <CommandPalette<Hit> isOpen={open} onOpenChange={setOpen} searchSource={source} label="Search teams, players and games"
      emptySearchText="Nothing by that name has a page yet. Teams, NBA players and NFL receivers, backs and tight ends have pages; quarterbacks don't yet." emptyBootstrapText="Type a team, a player or a game"
      onValueChange={pick}
      footer={touch ? (
        <div className="flex justify-end border-t p-2">
          <button type="button" onClick={() => setOpen(false)} className="pl-label min-h-10 rounded-full border px-4 text-[10px] text-muted-foreground hover:text-foreground">Close</button>
        </div>
      ) : undefined}
      renderItem={(i) => {
        const a = i.auxiliaryData!;
        return (
          <span className="flex min-w-0 items-center gap-3">
            {a.kind === "team" && a.team && a.sport ? <Crest sport={a.sport} team={a.team} name={i.label} size={28} />
              : a.kind === "player" && a.playerId ? <Face playerId={a.playerId} name={i.label} size={28} />
              : <span aria-hidden className="pl-label grid size-7 shrink-0 place-items-center rounded-md bg-muted text-[9px] text-muted-foreground">{a.kind === "game" ? "VS" : "GO"}</span>}
            <span className="grid min-w-0">
              <span className="truncate text-sm font-medium">{i.label}</span>
              <span className="truncate text-xs text-muted-foreground">{a.sub}</span>
            </span>
          </span>
        );
      }} />
  );
}

