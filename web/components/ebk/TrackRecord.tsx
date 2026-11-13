"use client";

// How the site's own calls have done. Each call (the matchups' lean, the score model's favourite, the simulation's)
// is set beside two plain rules ON THE SAME GAMES, because the methods call different numbers of games and a
// percentage against a different set means nothing. Counts are always shown; win shares are checked against how
// often they came true only once there are enough of them. Retrospective, and it says so.
import { Check, Minus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { gameHref, sportLabel, useTrackRecord, type TrackRecord } from "@/lib/ebk";
import { fmtDate, useLocalTime } from "@/lib/localTime";
import { DataNote } from "./DataNote";
import { LoadError } from "./LoadError";

type Sport = TrackRecord["sports"][number];
type Tally = Sport["tallies"][number];
type Cal = NonNullable<Sport["calibration"]>[number];
type Game = TrackRecord["games"][number];

const CAL_MIN = 100;  // graded win shares before "does 70% mean 70%" is drawn; under it, only the count is shown
const SMALL = 60;     // graded games under which a card says the sample is small
const pct = (r: number, n: number) => (n ? `${Math.round((r / n) * 100)}%` : "—");
const DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const ours = (t: Tally) => (t.source != null ? true : t.method.startsWith("The "));

function Bar({ right, of, hot = false }: { right: number; of: number; hot?: boolean }) {
  return (
    <span aria-hidden className="relative block h-1.5 rounded-full bg-muted">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(right / Math.max(1, of)) * 100}%`, background: hot ? "var(--hot)" : "var(--viz-muted)" }} />
    </span>
  );
}

function Line({ label, right, of, hot = false, note }: { label: string; right: number; of: number; hot?: boolean; note?: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
      <span className={hot ? "font-medium" : "text-muted-foreground"}>{label}{note && <span className="text-xs text-muted-foreground"> {note}</span>}</span>
      <span className="tabular text-right">{right} of {of} <span className="text-muted-foreground">· {pct(right, of)}</span></span>
      <span className="col-span-2"><Bar right={right} of={of} hot={hot} /></span>
    </li>
  );
}

/** One of the site's methods with the two plain rules on the games it called. */
function Method({ t }: { t: Tally }) {
  const same = t.home_right != null;
  return (
    <div className="grid gap-2 border-t pt-3" data-method={t.source ?? "lean"}>
      <ul className="grid gap-2 text-sm">
        <Line label={t.method} right={t.right} of={t.of} hot />
        {same && <Line label="Home team" right={t.home_right!} of={t.of} note="same games" />}
        {same && t.record_of != null && t.record_of > 0 && <Line label="Better record" right={t.record_right ?? 0} of={t.record_of} note={t.record_of === t.of ? "same games" : `where one team had it: ${t.record_of} of them`} />}
      </ul>
    </div>
  );
}

/** Does a stated win share come true that often? One dot per range of stated shares: across is what the method said,
 *  up is how often its favourite won. On the dashed line the two are equal. A hollow dot rests on fewer than 10 games. */
function CalibrationChart({ c }: { c: Cal }) {
  const W = 280, H = 160, L = 32, B = 22, T = 20, R = 18, LOW = 0.4;  // up starts at 40%: a favourite that wins less often than that is off the chart, and drawn on its floor
  const x = (p: number) => L + ((p - 0.5) / 0.5) * (W - L - R);
  const y = (p: number) => T + (1 - (Math.max(LOW, p) - LOW) / (1 - LOW)) * (H - T - B);
  const pts = c.buckets.filter((b) => b.n > 0 && b.said != null && b.won != null);
  const said = pts.map((b) => `said ${Math.round(b.said! * 100)}%, won ${Math.round(b.won! * 100)}% of ${b.n}`).join("; ");
  return (
    <figure className="grid gap-1.5" data-calibration={c.source}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm" role="img" aria-label={`${c.method}: ${said}`}>
        {[0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke="var(--viz-axis)" strokeWidth={0.5} />
            <text x={L - 5} y={y(p) + 3} textAnchor="end" fontSize={9} className="tabular fill-muted-foreground">{p * 100}%</text>
          </g>
        ))}
        {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((p) => <text key={p} x={x(p)} y={H - 7} textAnchor="middle" fontSize={9} className="tabular fill-muted-foreground">{Math.round(p * 100)}%</text>)}
        <line x1={x(0.5)} y1={y(0.5)} x2={x(1)} y2={y(1)} stroke="var(--viz-muted)" strokeDasharray="3 3" />
        {pts.map((b) => (
          <g key={b.lo}>
            <circle cx={x(b.said!)} cy={y(b.won!)} r={Math.max(3.5, Math.min(9, Math.sqrt(b.n) * 1.1))} fill={b.n >= 10 ? "var(--hot)" : "var(--background)"} stroke="var(--hot)" strokeWidth={1.5} fillOpacity={b.n >= 10 ? 0.85 : 1} />
            <text x={x(b.said!)} y={y(b.won!) - Math.max(3.5, Math.min(9, Math.sqrt(b.n) * 1.1)) - 3} textAnchor="middle" fontSize={9} className="tabular fill-muted-foreground">{b.n}</text>
          </g>
        ))}
      </svg>
      <figcaption className="text-xs leading-relaxed text-muted-foreground">
        Across: the win share it gave its favourite. Up: how often that favourite won. On the dashed line the two match. Each dot carries its number of games; a hollow one has under 10.
      </figcaption>
    </figure>
  );
}

function SportCard({ s, cumulative, local }: { s: Sport; cumulative: boolean; local: boolean }) {
  const mine = s.tallies.filter(ours), plain = s.tallies.filter((t) => !ours(t));
  const cals = s.calibration ?? [];
  return (
    <div className="pl-reading grid content-start gap-4 rounded-3xl border p-4 sm:p-5" data-record={s.sport}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="pl-display text-3xl">{sportLabel(s.sport)}</h3>
        <span className="pl-label text-[10px] text-muted-foreground">{s.games} graded {s.games === 1 ? "game" : "games"}{s.since ? ` since ${fmtDate(s.since, DAY, local)}` : ""}</span>
      </div>
      {mine.map((t) => <Method key={t.method} t={t} />)}
      {/* a record that is not from the log has no same-games numbers: its plain rules are listed on their own */}
      {!cumulative && plain.length > 0 && (
        <ul className="grid gap-2 border-t pt-3 text-sm">{plain.map((t) => <Line key={t.method} label={`${t.method} (baseline)`} right={t.right} of={t.of} />)}</ul>
      )}
      {cals.map((c) => (
        <div key={c.source} className="grid gap-2 border-t pt-3">
          <p className="pl-label text-[10px] text-muted-foreground">{c.method}: does a stated 70% win 70% of the time?</p>
          {c.n >= CAL_MIN ? <CalibrationChart c={c} />
            : <p className="text-xs leading-relaxed text-muted-foreground" data-calibration-wait={c.source}>Drawn once {CAL_MIN} win shares are graded: {c.n} so far.</p>}
          {c.brier != null && <p className="text-xs text-muted-foreground">Scored as a forecast: {c.brier.toFixed(3)} mean squared error over {c.n} games (0.250 is a coin flip, lower is better).</p>}
        </div>
      ))}
      {!cals.length && s.brier != null && <p className="text-xs text-muted-foreground">Simulation win shares, scored: {s.brier.toFixed(3)} mean squared error (0.250 is a coin flip, lower is better).</p>}
      <div className="grid gap-1.5 text-xs leading-relaxed text-muted-foreground">
        {(s.backfilled ?? 0) > 0 && (
          <p data-backfilled>
            <b className="font-medium text-foreground">{s.backfilled === s.games ? `All ${s.games}` : `${s.backfilled} of these ${s.games}`} games have a call added to this record after the game.</b>{" "}
            Each was made before its game (the model saves the time with every prediction), but the record itself began later. Calls written down as they are made are counted from now on.
          </p>
        )}
        {(s.last_season ?? 0) > 0 && (
          <p>
            <b className="font-medium text-foreground">{s.last_season} of these {s.games} breakdowns were on last season&apos;s numbers</b> (the season rule).
            {s.this_season ? ` On this season's numbers alone the lean was right in ${s.this_season.right} of ${s.this_season.of}.` : " None on this season's numbers has made a call yet."}
          </p>
        )}
        {((s.waiting ?? 0) > 0 || (s.late ?? 0) > 0) && (
          <p>
            Not graded: {[(s.waiting ?? 0) > 0 ? `${s.waiting} finished ${s.waiting === 1 ? "game whose" : "games whose"} final score isn't in the data yet` : null,
              (s.late ?? 0) > 0 ? `${s.late} ${s.late === 1 ? "breakdown" : "breakdowns"} built after the game had started` : null].filter(Boolean).join("; ")}.
          </p>
        )}
        {(s.notes ?? []).map((n) => <p key={n}>{n}</p>)}
        {s.games < SMALL && <p>Too few games to read much into yet.</p>}
      </div>
    </div>
  );
}

/** One call on one finished game: who it named, the share it gave, and whether that was right (an icon and a word,
 *  never colour alone). */
function Call({ what, pick, p, winner }: { what: string; pick: string | null | undefined; p?: number | null; winner: string | null }) {
  if (!pick) return <span className="inline-flex items-center gap-1"><Minus aria-hidden className="size-3" />{what}: no call</span>;
  if (!winner) return <span className="inline-flex items-center gap-1"><Minus aria-hidden className="size-3" />{what} {pick}: tie</span>;
  const right = pick === winner;
  return (
    <span className="inline-flex items-center gap-1" style={{ color: right ? "var(--status-good)" : "var(--status-critical)" }}>
      {right ? <Check aria-hidden className="size-3" /> : <X aria-hidden className="size-3" />}
      {what} {pick}{p != null ? ` ${Math.round(p * 100)}%` : ""}<span className="sr-only">: {right ? "right" : "wrong"}</span>
    </span>
  );
}

function GameRow({ g, local }: { g: Game; local: boolean }) {
  const model = g.score_pick ? { pick: g.score_pick, p: g.score_p } : g.sim_pick ? { pick: g.sim_pick, p: g.sim_p } : null;
  return (
    <li className="grid gap-x-3 gap-y-0.5 border-t py-1.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
      <Link href={gameHref(g.event_id)} className="min-w-0 truncate hover:underline">
        {g.label} <span className="text-xs text-muted-foreground">{sportLabel(g.sport)} · {fmtDate(g.start, DAY, local)}{g.last_season ? " · last season's numbers" : ""}{g.backfilled ? " · added after" : ""}</span>
      </Link>
      <span className="tabular flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>{g.score}</span>
        {model && <Call what="Model" pick={model.pick} p={model.p} winner={g.winner ?? null} />}
        <Call what="Matchups" pick={g.lean} winner={g.winner ?? null} />
      </span>
    </li>
  );
}

export function TrackRecordSection() {
  const local = useLocalTime();
  const q = useTrackRecord();
  const d = q.data;
  const ref = useRef<HTMLElement>(null);
  const ready = !!d && d.sports.length > 0;
  // a link to #record arrives before this section has loaded: go to it once it is on the page
  useEffect(() => {
    if (ready && window.location.hash === "#record") ref.current?.scrollIntoView({ block: "start" });
  }, [ready]);
  const head = (
    <div className="grid gap-3">
      <span className="pl-display text-6xl text-[var(--hot)]">04</span>
      <h2 className="pl-display text-4xl">How it has done</h2>
    </div>
  );
  if (q.isError) return <section ref={ref} id="record" className="grid scroll-mt-20 gap-5 border-t pt-5">{head}<LoadError what="the record" retry={() => q.refetch()} /></section>;
  if (!d) return <section ref={ref} id="record" className="grid scroll-mt-20 gap-5 border-t pt-5" aria-busy="true">{head}<div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72 rounded-3xl" /><Skeleton className="h-72 rounded-3xl" /></div></section>;
  if (!d.sports.length) return null;
  const cumulative = !!d.cumulative;
  return (
    <section ref={ref} id="record" className="grid scroll-mt-20 gap-5 border-t pt-5">
      <div className="grid gap-3">
        {head}
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {cumulative ? "Every call made before its game, against the final score. Each method sits beside two plain rules on the same games: the home team, and the team with the better record."
            : "Every game whose breakdown was built before it started and whose final score is known, against two plain rules for scale."}
        </p>
        <DataNote summary="How grading works">{d.method}</DataNote>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {d.sports.map((s) => <SportCard key={s.sport} s={s} cumulative={cumulative} local={local} />)}
      </div>
      <details className="rounded-2xl border p-4">
        <summary className="pl-label cursor-pointer text-[11px]">Every graded game ({d.games.length})</summary>
        <ul className="mt-3 grid gap-1 text-sm">{d.games.map((g) => <GameRow key={g.event_id} g={g} local={local} />)}</ul>
      </details>
    </section>
  );
}
