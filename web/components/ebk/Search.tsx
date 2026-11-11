"use client";

// The search palette: every team, player and game that has a page, plus the site's sections. Loaded on first open.
import { CommandPalette } from "@astryxdesign/core/CommandPalette";
import type { SearchSource, SearchableItem } from "@astryxdesign/core/Typeahead";
import { useMemo } from "react";
import { SPORT, gameHref, playerHref, teamHref, useIndex, when } from "@/lib/ebk";
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

export function Search({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const go = useViewNav();
  const index = useIndex(open);
  const items = useMemo<Hit[]>(() => {
    const d = index.data;
    if (!d) return PAGES;
    return [
      ...d.teams.map((t): Hit => ({ id: `team:${t.sport}:${t.team}`, label: t.full_name, auxiliaryData: { group: "Teams", href: teamHref(t.sport, t.team),
        sub: SPORT[t.sport] ?? t.sport, kind: "team", sport: t.sport, team: t.team, keys: [t.team, t.name] } })),
      ...d.games.map((g): Hit => ({ id: `game:${g.event_id}`, label: g.label, auxiliaryData: { group: "Games", href: gameHref(g.event_id),
        sub: [SPORT[g.sport] ?? g.sport, when(g.start)?.day].filter(Boolean).join(" · "), kind: "game", keys: [] } })),
      ...d.players.map((p): Hit => ({ id: `player:${p.player_id}`, label: p.name, auxiliaryData: { group: "Players", href: playerHref(p.player_id),
        sub: `${p.position} · ${p.team_name}`, kind: "player", sport: p.sport, team: p.team, playerId: p.player_id, keys: [p.team_name, p.team] } })),
      ...PAGES,
    ];
  }, [index.data]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  // Ranked substring search: a name that starts with the query first, then word starts, then anything containing it.
  const source = useMemo<SearchSource<Hit>>(() => ({
    bootstrap: () => [...items.filter((i) => i.auxiliaryData!.kind === "game").slice(0, 5), ...PAGES],
    search: (q) => {
      const s = q.trim().toLowerCase();
      if (!s) return [];
      const score = (i: Hit) => {
        const hay = [i.label, ...i.auxiliaryData!.keys].map((x) => x.toLowerCase());
        if (hay.some((h) => h.startsWith(s))) return 0;
        if (hay.some((h) => h.split(/[\s@-]+/).some((w) => w.startsWith(s)))) return 1;
        return hay.some((h) => h.includes(s)) ? 2 : 9;
      };
      return items.map((i) => [score(i), i] as const).filter(([n]) => n < 9).sort((a, b) => a[0] - b[0]).slice(0, 24).map(([, i]) => i);
    },
  }), [items]);
  return (
    <CommandPalette<Hit> isOpen={open} onOpenChange={setOpen} searchSource={source} label="Search teams, players and games"
      emptySearchText="Nothing by that name has a page yet" emptyBootstrapText={index.isLoading ? "Loading…" : "Type a team, a player or a game"}
      onValueChange={(id) => { const hit = byId.get(id); if (hit) { setOpen(false); go(hit.auxiliaryData!.href); } }}
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

