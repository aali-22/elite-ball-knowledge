"use client";

// One expert pick in the public view: the pick as written, its line and the price the expert listed, how many named
// experts made it, its graded result, and a link to every article (the only place its reasoning can be read).
import { Check, ExternalLink, Minus, X } from "lucide-react";
import { relative } from "@/lib/format";
import { american, type PublicPick } from "@/lib/public";

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

export function PublicPickRow({ p }: { p: PublicPick }) {
  const odds = american(p.odds);
  return (
    <li className="grid gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium">{p.text}</span>
        {odds && <span className="font-mono text-sm tabular-nums text-muted-foreground" title="The price the expert listed">{odds}</span>}
        {p.market_label && <span className="pl-label text-[10px] text-muted-foreground">{p.market_label}</span>}
        <span className="ml-auto flex items-center gap-2">
          {p.experts > 1 && (
            <span className="pl-label rounded-full bg-[var(--hot-soft)] px-2 py-0.5 text-[10px] text-foreground"
              title="Distinct named experts on this same bet">{p.experts} experts</span>
          )}
          <ResultChip result={p.result} />
        </span>
      </div>
      <ul className="grid gap-0.5">
        {p.sources.map((s) => (
          <li key={s.url} className="min-w-0 text-xs text-muted-foreground">
            <a href={s.url} target="_blank" rel="noopener" className="inline-flex max-w-full items-center gap-1 hover:text-foreground"
              title={`${s.title}${s.published_at ? ` · published ${new Date(s.published_at).toLocaleString()}` : ""}`}>
              <span className="shrink-0 font-medium text-foreground">{s.site}</span>
              {s.author && <span className="truncate">· {s.author}</span>}
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
