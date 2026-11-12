"use client";

// One expert pick in the public view: the pick as written, its line and the price the expert listed, how many named
// experts made it, its graded result, and a link to every article (the only place its reasoning can be read).
import { Check, ExternalLink, Minus, X } from "lucide-react";
import { relative } from "@/lib/format";
import { createContext, useContext } from "react";
import { american, type PublicPick } from "@/lib/public";

/** "site|analyst" → their graded record over the last 30 days, when the page has loaded it. */
export const AnalystRecords = createContext<Map<string, string>>(new Map());

// Result colours always travel with an icon and a word (never colour alone).
const RESULT: Record<string, { label: string; color: string; Icon: typeof Check }> = {
  won: { label: "Won", color: "var(--status-good)", Icon: Check },
  lost: { label: "Lost", color: "var(--status-critical)", Icon: X },
  push: { label: "Push", color: "var(--viz-muted)", Icon: Minus },
  void: { label: "Void", color: "var(--viz-muted)", Icon: Minus },
};

export function ResultChip({ result }: { result?: string | null }) {
  const r = result ? RESULT[result] : null;
  if (!r) return null;
  return (
    <span className="pl-label inline-flex items-center gap-1 text-[10px]" style={{ color: r.color }}>
      <r.Icon aria-hidden className="size-3" />{r.label}
    </span>
  );
}

const unnamed = (a?: string | null) => !a || /\bstaff\b/i.test(a);

/** One line per analyst at an outlet. The same person repeating a pick is one voice, and an outlet's staff byline is
 * dropped when a named analyst at that outlet made the same pick (it is usually the same article, republished). */
export function voices(p: PublicPick) {
  const seen = new Set<string>();
  const named = new Set(p.sources.filter((s) => !unnamed(s.author)).map((s) => s.site_id));
  return p.sources.filter((s) => {
    if (unnamed(s.author) && named.has(s.site_id)) return false;
    const k = `${s.site_id}|${unnamed(s.author) ? "" : s.author!.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function PublicPickRow({ p }: { p: PublicPick }) {
  const odds = american(p.odds);
  // one line per analyst at an outlet: the same person repeating a pick in a later article is still one voice
  const sources = voices(p);
  const records = useContext(AnalystRecords);
  return (
    <li className="grid gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium">{p.text}</span>
        {odds && !p.text.includes(odds) && <span className="font-mono text-sm tabular-nums text-muted-foreground" title="The price the analyst listed">{odds}</span>}
        {!odds && <span className="pl-label text-[9px] text-muted-foreground" title="This pick listed no price, so it counts in records but not in units">no price listed</span>}
        {p.market_label && <span className="pl-label text-[10px] text-muted-foreground">{p.market_label}</span>}
        <span className="ml-auto flex items-center gap-2">
          {sources.length > 1 && (
            <span className="pl-label rounded-full bg-[var(--hot-soft)] px-2 py-0.5 text-[10px] text-foreground"
              title="Different analysts who made this same bet">{sources.length} analysts</span>
          )}
          <ResultChip result={p.result} />
        </span>
      </div>
      <ul className="grid gap-0.5">
        {sources.map((s) => (
          <li key={s.url} className="min-w-0 text-xs text-muted-foreground">
            <a href={s.url} target="_blank" rel="noopener" className="inline-flex min-h-8 max-w-full items-center gap-1 hover:text-foreground sm:min-h-0"
              title={`${s.title}${s.published_at ? ` · published ${new Date(s.published_at).toLocaleString()}` : ""}`}>
              <span className="shrink-0 font-medium text-foreground">{s.site}</span>
              {s.author && <span className="truncate">· {s.author}</span>}
              {s.author && records.get(`${s.site_id}|${s.author.toLowerCase()}`) && (
                <span className="tabular shrink-0" title="This analyst's graded picks over the last 30 days: won-lost">· {records.get(`${s.site_id}|${s.author.toLowerCase()}`)}</span>
              )}
              {s.published_at && <span className="shrink-0">· {relative(s.published_at)}</span>}
              <ExternalLink aria-hidden className="size-3 shrink-0" />
            </a>
          </li>
        ))}
      </ul>
      {p.result_detail && <div className="font-mono text-xs tabular-nums text-muted-foreground">{p.result_detail}</div>}
    </li>
  );
}
