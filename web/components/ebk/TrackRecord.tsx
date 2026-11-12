"use client";

// How the site's own calls have done, beside two plain rules for scale. A small, retrospective sample, and it says so.
import { Check, Minus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Crest } from "./Crest";
import { gameHref, sportLabel, useTrackRecord, when } from "@/lib/ebk";
import { useLocalTime } from "@/lib/localTime";

const pct = (r: number, n: number) => (n ? `${Math.round((r / n) * 100)}%` : "—");

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
  if (!d || !d.sports.length) return null;
  return (
    <section ref={ref} id="record" className="grid scroll-mt-20 gap-5 border-t pt-5">
      <div className="grid gap-3">
        <span className="pl-display text-6xl text-[var(--hot)]">04</span>
        <h2 className="pl-display text-4xl">How it has done</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{d.method}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {d.sports.map((s) => {
          const best = Math.max(...s.tallies.map((t) => (t.of ? t.right / t.of : 0)));
          return (
            <div key={s.sport} className="pl-reading grid content-start gap-3 rounded-3xl border p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-2"><h3 className="pl-display text-3xl">{sportLabel(s.sport)}</h3><span className="pl-label text-[10px] text-muted-foreground">{s.games} finished games</span></div>
              <table className="w-full text-sm">
                <caption className="sr-only">{sportLabel(s.sport)}: how often each way of picking the winner was right</caption>
                <thead><tr className="pl-label text-left text-[10px] text-muted-foreground"><th className="py-1.5 font-normal">Picking the winner by</th><th className="py-1.5 text-right font-normal">Right</th><th className="w-[40%] py-1.5 font-normal"><span className="sr-only">Share</span></th></tr></thead>
                <tbody className="tabular">
                  {s.tallies.map((t) => {
                    const ours = t.method.startsWith("The ");
                    return (
                      <tr key={t.method} className="border-t">
                        <td className={`py-2 pr-2 ${ours ? "font-medium" : "text-muted-foreground"}`}>{t.method}{ours ? "" : " (baseline)"}</td>
                        <td className="py-2 text-right">{t.right} of {t.of} <span className="text-muted-foreground">· {pct(t.right, t.of)}</span></td>
                        <td className="py-2 pl-3"><span className="relative block h-1.5 rounded-full bg-muted"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(t.right / Math.max(1, t.of)) * 100}%`, background: ours ? "var(--hot)" : "var(--viz-muted)", opacity: t.of && t.right / t.of === best ? 1 : 0.7 }} /></span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {s.brier != null && <p className="text-xs text-muted-foreground">Simulation win shares, scored: {s.brier.toFixed(3)} mean squared error (0.250 is a coin flip, lower is better).</p>}
              {(s.last_season ?? 0) > 0 && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <b className="font-medium text-foreground">{s.last_season} of these {s.games} breakdowns were on last season&apos;s numbers</b> (the season rule), so this is mostly a test of last season&apos;s teams.
                  {s.this_season ? ` On this season's numbers alone the lean was right in ${s.this_season.right} of ${s.this_season.of}.` : " None on this season's numbers has made a call yet."}
                </p>
              )}
              {((s.waiting ?? 0) > 0 || (s.late ?? 0) > 0) && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Not graded: {[(s.waiting ?? 0) > 0 ? `${s.waiting} finished ${s.waiting === 1 ? "game whose" : "games whose"} final score isn't in the data yet (it arrives with each team's next breakdown)` : null,
                    (s.late ?? 0) > 0 ? `${s.late} ${s.late === 1 ? "breakdown" : "breakdowns"} built after the game had started` : null].filter(Boolean).join("; ")}.
                </p>
              )}
              {(s.notes ?? []).map((n) => <p key={n} className="text-xs leading-relaxed text-muted-foreground">{n}</p>)}
              {s.games < 60 && <p className="text-xs text-muted-foreground">Too few games to read much into yet.</p>}
            </div>
          );
        })}
      </div>
      <details className="rounded-2xl border p-4">
        <summary className="pl-label cursor-pointer text-[11px]">Every graded game ({d.games.length})</summary>
        <ul className="mt-3 grid gap-1 text-sm">
          {d.games.map((g) => {
            const won = g.winner && g.lean ? g.lean === g.winner : null;
            return (
              <li key={g.event_id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-t py-1.5 first:border-t-0">
                {/* the team the board leaned to, then whether that was right: an icon and a word, never colour alone */}
                {g.lean ? <Crest sport={g.sport} team={g.lean} name={g.lean} size={22} /> : <span aria-hidden className="size-[22px] rounded-full border border-dashed" />}
                <Link href={gameHref(g.event_id)} className="min-w-0 truncate hover:underline">{g.label} <span className="text-xs text-muted-foreground">{sportLabel(g.sport)} · {when(g.start, false, local)?.day}{g.last_season ? " · last season's numbers" : ""}</span></Link>
                <span className="tabular flex items-center gap-1.5 text-xs text-muted-foreground">{g.score}
                  {!g.lean ? <span className="inline-flex items-center gap-1"><Minus aria-hidden className="size-3" />even board, no call</span>
                    : won == null ? <span className="inline-flex items-center gap-1"><Minus aria-hidden className="size-3" />tie</span>
                    : won ? <span className="inline-flex items-center gap-1" style={{ color: "var(--status-good)" }}><Check aria-hidden className="size-3" />lean right</span>
                    : <span className="inline-flex items-center gap-1" style={{ color: "var(--status-critical)" }}><X aria-hidden className="size-3" />lean wrong</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
