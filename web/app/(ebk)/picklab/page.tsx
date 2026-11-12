"use client";

// PickLab's front page: what public analysts are picking, as facts with a link to each article. Three ways to read the
// same picks: by game (each game's picks grouped into sides, totals and each player's props), by type (every side,
// every total, every prop across the slate) and by player (all the props on one player together). The picks more than
// one analyst made are pulled to the top.
import { usePageTitle } from "@/lib/title";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Picker, SportPicker } from "@/components/ebk/Controls";
import { Crest, Face } from "@/components/ebk/Crest";
import { Reveal } from "@/components/motion/Reveal";
import { AnalystRecords, PublicPickRow, voices } from "@/components/public/PublicPickRow";
import { Skeleton } from "@/components/ui/skeleton";
import { SPORT_ORDER, gameHref, playerHref, sportLabel, useIndex, useSlate } from "@/lib/ebk";
import { localDateTime, relative } from "@/lib/format";
import { usePublicPicks, usePublicRecords, type PublicGame, type PublicPick } from "@/lib/public";
import { AWAY, HOME } from "@/lib/site";
import { useUrlChoice, useUrlState } from "@/lib/urlState";

type Kind = "sides" | "totals" | "props" | "other";
type View = "game" | "type" | "player";
type When = "upcoming" | "finished";
const KIND_LABEL: Record<Kind, string> = { sides: "Sides: spread and moneyline", totals: "Totals", props: "Player props", other: "Other picks" };
const KIND_SHORT: Record<Kind, string> = { sides: "Sides", totals: "Totals", props: "Props", other: "Other" };
const KINDS: Kind[] = ["sides", "totals", "props", "other"];

/** Which family a pick belongs to: a named player makes it a prop whatever the market is called. */
function kindOf(p: PublicPick): Kind {
  const m = (p.market ?? "").toLowerCase();
  if (p.player_name) return "props";
  if (/total|rounds|over_under/.test(m) || /\bteam total\b/i.test(p.text)) return "totals";
  if (/spread|moneyline|puck_line|run_line|_ml$/.test(m)) return "sides";
  return "other";
}

const byKind = (picks: PublicPick[]) => KINDS.map((k) => [k, picks.filter((p) => kindOf(p) === k)] as const).filter(([, ps]) => ps.length > 0);
const byPlayer = (picks: PublicPick[]) => {
  const out = new Map<string, PublicPick[]>();
  for (const p of picks) if (p.player_name) out.set(p.player_name, [...(out.get(p.player_name) ?? []), p]);
  return [...out].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
};
const awayName = (g: PublicGame) => g.away_name ?? g.away;
/** A game that has started, finished or has a graded pick: it isn't "upcoming" any more. */
const begun = (g: PublicGame) => g.final || g.picks.some((p) => p.result) || new Date(g.start).getTime() <= Date.now();
/** Analysts on both sides of the same market in one game: the picks are a split, not agreement. */
const split = (g: PublicGame, p: PublicPick) => !p.player_name && g.picks.some((q) => q !== p && !q.player_name && q.market === p.market && q.side && q.side !== p.side);
const homeName = (g: PublicGame) => g.home_name ?? g.home;

function Matchup({ g, size = "lg" }: { g: PublicGame; size?: "lg" | "sm" }) {
  const big = size === "lg";
  return (
    <span className={`flex min-w-0 flex-wrap items-center ${big ? "gap-x-3 gap-y-1" : "gap-x-2"}`}>
      {[{ code: g.away, name: awayName(g), ink: AWAY.ink }, { code: g.home, name: homeName(g), ink: HOME.ink }].map((t, i) => (
        <span key={t.code} className="flex min-w-0 items-center gap-2">
          {i === 1 && <span className={`text-muted-foreground ${big ? "text-base" : "text-xs"}`}>at</span>}
          {t.name !== t.code && <Crest sport={g.sport} team={t.code} name={t.name} size={big ? 30 : 18} color={t.ink} />}
          <span className={`min-w-0 truncate ${big ? "pl-matchup text-2xl sm:text-3xl" : "text-xs font-medium"}`}>{t.name}</span>
        </span>
      ))}
    </span>
  );
}

const plain = (name: string) => name.normalize("NFKD").replace(/[^A-Za-z ]/g, "").toLowerCase().trim();
type Ids = Map<string, string>;

function PlayerBlock({ name, picks, game, ids }: { name: string; picks: PublicPick[]; game?: PublicGame; ids: Ids }) {
  const id = ids.get(plain(name));
  return (
    <div className="grid gap-1 rounded-xl bg-muted/40 p-3">
      <div className="flex items-center gap-2.5">
        <Face playerId={id ?? ""} name={name} size={30} />
        {id ? <Link href={playerHref(id)} className="min-w-0 flex-1 truncate text-sm font-semibold underline decoration-border underline-offset-4 hover:decoration-[var(--hot)]" title={`${name}: his numbers and who he faces`}>{name}</Link>
          : <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>}
        <span className="pl-label shrink-0 text-[10px] text-muted-foreground">{picks.length} {picks.length === 1 ? "prop" : "props"}</span>
      </div>
      {game && <Matchup g={game} size="sm" />}
      <ul className="divide-y">{picks.map((p, i) => <PublicPickRow key={`${p.text}-${i}`} p={p} />)}</ul>
    </div>
  );
}

function Section({ kind, picks, ids }: { kind: Kind; picks: PublicPick[]; ids: Ids }) {
  return (
    <section className="grid gap-2">
      <h3 className="pl-label flex items-center gap-2 text-[10px] text-muted-foreground">{KIND_LABEL[kind]}<span className="tabular rounded-full bg-muted px-1.5 py-0.5">{picks.length}</span></h3>
      {kind === "props"
        ? <div className="grid gap-2 sm:grid-cols-2">{byPlayer(picks).map(([name, ps]) => <PlayerBlock key={name} name={name} picks={ps} ids={ids} />)}</div>
        : <ul className="divide-y">{picks.map((p, i) => <PublicPickRow key={`${p.text}-${i}`} p={p} />)}</ul>}
    </section>
  );
}

function GameCard({ g, hasBoard, ids }: { g: PublicGame; hasBoard: boolean; ids: Ids }) {
  return (
    <article className="pl-reading grid gap-4 rounded-2xl border p-4 sm:p-5">
      <header className="grid gap-2">
        <div className="pl-label flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
          <span>{sportLabel(g.sport)}</span>{g.slot && g.slot !== sportLabel(g.sport) && <span>· {g.slot}</span>}
          <span>· {g.final ? "Final" : localDateTime(g.start)}</span>
          <span className="ml-auto">{g.picks.length} {g.picks.length === 1 ? "pick" : "picks"}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2><Matchup g={g} /></h2>
          {hasBoard && <Link href={gameHref(g.event_id)} className="pl-label shrink-0 rounded-full border px-3 py-1.5 text-[10px] hover:bg-muted">The numbers on this game →</Link>}
        </div>
      </header>
      {byKind(g.picks).map(([k, ps]) => <Section key={k} kind={k} picks={ps} ids={ids} />)}
    </article>
  );
}

function Picks() {
  usePageTitle("Analyst picks · PickLab");
  const only = useSearchParams().get("game");
  const [sport, setSport] = useUrlChoice("sport");
  const [view, setView] = useUrlState<View>("view", "game", ["game", "type", "player"]);
  const [when, setWhen] = useUrlState<When>("show", "upcoming", ["upcoming", "finished"]);
  const [kind, setKind] = useUrlState<Kind | "all">("kind", "all", ["all", ...KINDS]);
  const { data, isLoading, error } = usePublicPicks();
  const recs = usePublicRecords(30);
  const records = useMemo(() => new Map((recs.data?.experts ?? []).filter((r) => r.picks >= 5)
    .map((r) => [`${r.site_id}|${r.label.toLowerCase()}`, `${r.won}-${r.lost}${r.push ? `-${r.push}` : ""}`])), [recs.data]);
  const slate = useSlate(undefined, 14);
  const boards = useMemo(() => new Set(slate.data?.games.map((g) => g.event_id)), [slate.data]);
  const index = useIndex();
  const ids = useMemo<Ids>(() => new Map((index.data?.players ?? []).map((x) => [plain(x.name), x.player_id])), [index.data]);
  const sports = useMemo(() => {
    const have = new Set(data?.games.map((g) => g.sport));
    return SPORT_ORDER.filter((s) => have.has(s));
  }, [data]);
  const all = useMemo(() => data?.games ?? [], [data]);
  const finished = all.filter((g) => begun(g) && (!sport || g.sport === sport)).reduce((n, g) => n + g.picks.length, 0);
  const one = only ? all.find((g) => g.event_id.replace(":", "-") === only) : undefined;
  const games = useMemo(() => (one ? [one] : all)
    .filter((g) => one || ((!sport || g.sport === sport) && (when === "finished") === begun(g)))
    .map((g) => ({ ...g, picks: g.picks.filter((p) => kind === "all" || kindOf(p) === kind) }))
    .filter((g) => g.picks.length > 0)
    .sort((a, b) => (when === "finished" ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start))),
  [all, one, sport, when, kind]);
  const rows = useMemo(() => games.flatMap((g) => g.picks.map((p) => ({ g, p }))), [games]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const g of all) if ((!sport || g.sport === sport) && (when === "finished") === begun(g)) for (const p of g.picks) { c.all++; c[kindOf(p)] = (c[kindOf(p)] ?? 0) + 1; }
    return c;
  }, [all, sport, when]);
  const bylines = (p: PublicPick) => voices(p).length;
  const agreed = useMemo(() => rows.filter((r) => bylines(r.p) > 1 && !split(r.g, r.p)).sort((a, b) => bylines(b.p) - bylines(a.p)).slice(0, 6), [rows]);
  const players = useMemo(() => {
    const out = new Map<string, { g: PublicGame; picks: PublicPick[] }>();
    for (const { g, p } of rows) if (p.player_name) { const k = `${p.player_name}|${g.event_id}`; out.set(k, { g, picks: [...(out.get(k)?.picks ?? []), p] }); }
    return [...out].map(([k, v]) => ({ name: k.split("|")[0], ...v })).sort((a, b) => b.picks.length - a.picks.length || a.name.localeCompare(b.name));
  }, [rows]);

  return (
    <AnalystRecords.Provider value={records}>
    <div className="grid gap-6">
      <PageHeader size="lg" title="Analyst picks" eyebrow={<span>Public picks, written down and graded</span>}
        lede={<>What analysts at {data?.sites.join(", ") ?? "public outlets"} are picking, as they wrote it, with a link to read why.
          When a game ends, each pick is graded against the final score.</>}
        right={data && <span className="pl-label text-muted-foreground">Updated {relative(data.generated_at)}</span>} />

      <div className="grid gap-3 border-t pt-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* one game's picks are that game's, started or not: the slate-wide choices would do nothing, so they aren't offered */}
          {!one && <Picker label="Which games" value={when} onChange={setWhen} options={[{ value: "upcoming", label: "Upcoming" }, { value: "finished", label: `Past games${finished ? ` (${finished})` : ""}` }]} />}
          <Picker label="Group picks" value={view} onChange={setView} options={[{ value: "game", label: "By game" }, { value: "type", label: "By type" }, { value: "player", label: "By player" }]} />
          {!one && <SportPicker sports={sports} value={sport} onChange={setSport} />}
        </div>
        {view !== "player" && !one && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick type">
            {(["all", ...KINDS] as const).filter((k) => k === "all" || counts[k]).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                className={`pl-label inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-2 text-[10px] ${kind === k ? "bg-foreground text-background" : "border text-muted-foreground hover:text-foreground"}`}>
                {k === "all" ? "All picks" : KIND_SHORT[k]}<span className="tabular">{counts[k] ?? 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="grid min-w-0 gap-4">
          {isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          {error && <p className="text-sm text-muted-foreground">The picks couldn&apos;t load. Try again in a minute.</p>}
          {data && !rows.length && <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{when === "upcoming" ? "No picks for upcoming games match this filter." : "No picks on past games match this filter yet."}</p>}

          {agreed.length > 0 && view === "game" && kind === "all" && !one && (
            <section className="grid gap-3 rounded-2xl border border-[var(--hot)]/40 bg-[var(--hot-soft)] p-4 sm:p-5">
              <h2 className="pl-label text-foreground">Where analysts agree</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {agreed.map(({ g, p }, i) => (
                  <li key={`${g.event_id}-${p.text}-${i}`} className="pl-reading grid gap-1.5 rounded-xl border p-3">
                    <Matchup g={g} size="sm" />
                    <ul><PublicPickRow p={p} /></ul>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {one && (
            <p className="flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
              <span>Showing only the picks on <b className="font-medium">{awayName(one)} at {homeName(one)}</b>.</span>
              <Link href="/picklab" className="pl-label rounded-full border px-3 py-1.5 text-[10px] hover:bg-muted">Show every game</Link>
            </p>
          )}
          {rows.length > 0 && <p className="pl-label text-muted-foreground">{view === "player" ? `${players.length} ${players.length === 1 ? "player" : "players"} · ${players.reduce((n, x) => n + x.picks.length, 0)} props`
            : `${games.length} ${games.length === 1 ? "game" : "games"} · ${rows.length} ${rows.length === 1 ? "pick" : "picks"}`}</p>}

          {view === "game" && games.map((g, i) => <Reveal key={g.event_id} delay={Math.min(i, 5) * 0.04}><GameCard g={g} hasBoard={boards.has(g.event_id)} ids={ids} /></Reveal>)}

          {view === "type" && KINDS.map((k) => {
            const mine = rows.filter((r) => kindOf(r.p) === k);
            if (!mine.length) return null;
            return (
              <section key={k} className="pl-reading grid gap-3 rounded-2xl border p-4 sm:p-5">
                <h2 className="pl-display text-3xl">{KIND_SHORT[k]} <span className="tabular text-xl text-muted-foreground">{mine.length}</span></h2>
                <ul className="grid gap-3">
                  {mine.map(({ g, p }, i) => (
                    <li key={`${g.event_id}-${p.text}-${i}`} className="grid gap-1 border-t pt-3 first:border-t-0 first:pt-0">
                      <span className="flex flex-wrap items-center justify-between gap-2"><Matchup g={g} size="sm" /><span className="pl-label text-[10px] text-muted-foreground" title="Your local time">{g.final ? "Final" : localDateTime(g.start)}</span></span>
                      <ul><PublicPickRow p={p} /></ul>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {view === "player" && (players.length
            ? <div className="grid gap-3 sm:grid-cols-2">{players.map((x, i) => <Reveal key={`${x.name}-${x.g.event_id}`} delay={Math.min(i, 6) * 0.03}><PlayerBlock name={x.name} picks={x.picks} game={x.g} ids={ids} /></Reveal>)}</div>
            : data && <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No player props on these games.</p>)}
        </div>

        <aside className="grid gap-3 rounded-2xl border p-4 text-sm leading-relaxed text-muted-foreground lg:sticky lg:top-16">
          <h2 className="pl-label text-foreground">How to read this</h2>
          <p>Each row is a pick as its analyst wrote it, with the line and price they listed and a link to the article. The reasoning stays on the publisher&apos;s page.</p>
          <p><b className="font-medium text-foreground">By game</b> sorts a game&apos;s picks into sides, totals and each player&apos;s props. <b className="font-medium text-foreground">By type</b> lines up the whole slate. <b className="font-medium text-foreground">By player</b> puts every prop on one player together.</p>
          <p>Times are in your own time zone. A pick that says something its tag can&apos;t grade (a combined stat, one team&apos;s total) is shown as written and left ungraded.</p>
          <p>Once the game ends the pick is graded against the final score. Those grades are what the <Link href="/picklab/experts" className="underline decoration-[var(--hot)] decoration-2 underline-offset-4">records</Link> count.</p>
        </aside>
      </div>
    </div>
    </AnalystRecords.Provider>
  );
}

export default function PublicPicksPage() {
  return <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}><Picks /></Suspense>;
}
