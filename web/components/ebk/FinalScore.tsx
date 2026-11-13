"use client";

// A finished game: the final score, beside what the site's numbers said before it started. The calls come from the
// forecast log (written down before the game and never changed), so this is the same grading the record uses.
// Right or wrong is an icon and a word, never colour alone.
import { Check, Minus, X } from "lucide-react";
import Link from "next/link";
import type { Board } from "@/lib/ebk";
import type { Sides } from "./Charts";

type Call = NonNullable<Board["calls"]>[number];
const WHAT: Record<string, string> = { score: "Score model", sim: "Simulation", lean: "Matchups" };

function Said({ c, names }: { c: Call; names: Record<string, string> }) {
  const what = WHAT[c.source] ?? c.source;
  if (!c.pick) return <li className="flex items-center gap-2 text-muted-foreground"><Minus aria-hidden className="size-4 shrink-0" /><span><b className="font-medium text-foreground">{what}</b>: an even board, no call</span></li>;
  const tone = c.right == null ? undefined : c.right ? "var(--status-good)" : "var(--status-critical)";
  return (
    <li className="flex items-center gap-2" data-call={c.source} data-right={c.right == null ? "none" : String(c.right)}>
      <span style={{ color: tone }}>{c.right == null ? <Minus aria-hidden className="size-4 shrink-0" /> : c.right ? <Check aria-hidden className="size-4 shrink-0" /> : <X aria-hidden className="size-4 shrink-0" />}</span>
      <span>
        <b className="font-medium">{what}</b>: {names[c.pick] ?? c.pick}{c.p != null ? <span className="tabular"> {Math.round(c.p * 100)}%</span> : ""}
        <span className="text-muted-foreground"> · {c.right == null ? "a tie" : c.right ? "right" : "wrong"}</span>
      </span>
    </li>
  );
}

export function FinalScore({ b, sides }: { b: Board; sides: Sides }) {
  const r = b.result;
  if (!r) return null;
  const order = b.sport === "soccer" ? [{ t: sides.home, pts: r.home_pts }, { t: sides.away, pts: r.away_pts }] : [{ t: sides.away, pts: r.away_pts }, { t: sides.home, pts: r.home_pts }];
  const calls = (b.calls ?? []).slice().sort((x, y) => Number(x.source === "lean") - Number(y.source === "lean"));  // the win share first, the count after
  const late = calls.some((c) => c.backfilled);
  return (
    <section aria-label="Final score" data-final className="pl-reading grid gap-4 rounded-3xl border p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-8 sm:p-6">
      <div className="grid gap-2">
        <span className="pl-label text-[10px] text-[var(--hot)]">Final</span>
        <p className="grid gap-1">
          {order.map(({ t, pts }) => (
            <span key={t} className={`flex items-baseline justify-between gap-4 ${r.winner === t ? "" : "text-muted-foreground"}`}>
              <span className="pl-matchup min-w-0 truncate text-2xl sm:text-3xl">{sides.names[t]}</span>
              <span className="pl-display tabular text-4xl sm:text-5xl">{pts}</span>
            </span>
          ))}
        </p>
      </div>
      <div className="grid gap-2 border-t pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
        <span className="pl-label text-[10px] text-muted-foreground">What the numbers said before it</span>
        {calls.length ? <ul className="grid gap-1.5 text-sm">{calls.map((c) => <Said key={c.source} c={c} names={sides.names} />)}</ul>
          : <p className="text-sm text-muted-foreground">No call was written down before this game started.</p>}
        <p className="text-xs leading-relaxed text-muted-foreground">
          The breakdown below is as it stood before the start.{late ? " These calls were made before the game and added to the record after it." : ""}{" "}
          <Link href="/models#record" className="underline underline-offset-2">How every call has done</Link>
        </p>
      </div>
    </section>
  );
}
