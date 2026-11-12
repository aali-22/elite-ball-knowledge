"use client";

// How the site's own calls have done, beside two plain rules for scale. A small, retrospective sample, and it says so.
import Link from "next/link";
import { gameHref, sportLabel, useTrackRecord, when } from "@/lib/ebk";

const pct = (r: number, n: number) => (n ? `${Math.round((r / n) * 100)}%` : "—");

export function TrackRecordSection() {
  const q = useTrackRecord();
  const d = q.data;
  if (!d || !d.sports.length) return null;
  return (
    <section id="record" className="grid scroll-mt-20 gap-5 border-t pt-5">
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
              {s.games < 60 && <p className="text-xs text-muted-foreground">Too few games to read much into yet.</p>}
            </div>
          );
        })}
      </div>
      <details className="rounded-2xl border p-4">
        <summary className="pl-label cursor-pointer text-[11px]">Every graded game</summary>
        <ul className="mt-3 grid gap-1 text-sm">
          {d.games.map((g) => {
            const won = g.winner && g.lean ? g.lean === g.winner : null;
            return (
              <li key={g.event_id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-t py-1.5 first:border-t-0">
                <Link href={gameHref(g.event_id)} className="min-w-0 truncate hover:underline">{g.label} <span className="text-xs text-muted-foreground">{sportLabel(g.sport)} · {when(g.start)?.day}</span></Link>
                <span className="tabular text-xs text-muted-foreground">{g.score}{won == null ? " · even board" : won ? " · lean right" : " · lean wrong"}</span>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
