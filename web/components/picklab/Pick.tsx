"use client";

// One pick on a card or a game page: what was picked, who picked it with their record this season league by league,
// its result once graded, and (for the account that has them) the analyst's own words behind a "Why?".
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { ResultChip } from "@/components/public/PublicPickRow";
import { outletOf, track } from "@/lib/analytics";
import { sportLabel } from "@/lib/ebk";
import type { Excerpt } from "@/lib/excerpts";
import { pickText, shortSport, voices } from "@/lib/picklab";
import { MIN_PRICED, american, signed, type PublicPick } from "@/lib/public";
import { useLab } from "./Context";

type Source = PublicPick["sources"][number];
const TONE: Record<string, { line: string; ink: string }> = {
  covers: { line: "var(--site-covers-line)", ink: "var(--site-covers-ink)" },
  actionnetwork: { line: "var(--site-action-line)", ink: "var(--site-action-ink)" },
  bettingpros: { line: "var(--site-bp-line)", ink: "var(--site-bp-ink)" },
};
const tone = (siteId?: string | null) => TONE[siteId ?? ""] ?? { line: "var(--border)", ink: "var(--foreground)" };

/** "NBA 46-38 −1.1u · NFL 12-9": an analyst's graded picks this season, the game's own league first. */
export function SeasonRecord({ s, sport }: { s: Source; sport: string }) {
  const { records } = useLab();
  const mine = s.author ? records.get(`${s.site_id}|${s.author.toLowerCase()}`) : undefined;
  if (!mine) return null;
  const order = [sport, ...Object.keys(mine).filter((k) => k !== sport).sort()].filter((k) => mine[k]?.picks);
  if (!order.length) return null;
  return (
    <span className="tabular inline-flex flex-wrap gap-x-2 text-foreground">
      {order.map((k) => {
        const r = mine[k];
        return (
          <span key={k} title={`${s.author}, ${sportLabel(k)} this season: ${r.picks} graded, ${r.priced} with a listed price`}>
            <span className="pl-label text-[9px] text-muted-foreground">{shortSport(k)}</span> {r.won}-{r.lost}{r.push ? `-${r.push}` : ""}
            {r.priced >= MIN_PRICED && <span className="text-muted-foreground"> {signed(r.units)}u</span>}
          </span>
        );
      })}
    </span>
  );
}

function Why({ e, s }: { e: Excerpt; s?: Source }) {
  const [all, setAll] = useState(false);
  const quoted = e.paras.length === 0;
  const paras = quoted ? e.quotes : e.paras;
  const t = tone(s?.site_id), site = s?.site ?? e.site, rest = paras.length - 1;
  return (
    <div className="grid gap-2 border-l-2 pl-3" style={{ borderColor: t.line }}>
      <div className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="font-medium">{s?.author ?? e.author ?? site}</span><span style={{ color: t.ink }}>{site}</span>
      </div>
      {(all ? paras : paras.slice(0, 1)).map((x, i) => <p key={i} className="text-[15px] leading-relaxed">{quoted ? `“${x}”` : x}</p>)}
      {rest > 0 && !all && (
        <button type="button" onClick={() => setAll(true)} className="min-h-9 justify-self-start text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          {rest} more {quoted ? (rest === 1 ? "quote" : "quotes") : rest === 1 ? "paragraph" : "paragraphs"}
        </button>
      )}
      <a href={e.url} target="_blank" rel="noopener" onClick={() => track("article_click", { outlet: outletOf(e.url) })}
        className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm underline underline-offset-4" style={{ color: t.ink }}>
        Read the full article on {site}<ExternalLink aria-hidden className="size-3.5" />
      </a>
    </div>
  );
}

/** `compact`: a card's row (the first analyst, "+ n" for the rest). Otherwise every analyst, each with a record. */
export function PickLine({ p, sport, why = [], compact = false }: { p: PublicPick; sport: string; why?: Excerpt[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const who = voices(p), odds = american(p.odds);
  const shown = compact ? who.slice(0, 1) : who;
  const byUrl = new Map(p.sources.map((s) => [s.url, s]));
  return (
    <li className="grid gap-2 py-2.5">
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-medium leading-snug">
            {pickText(p.text)}{odds && !p.text.includes(odds) && <span className="font-mono text-sm tabular-nums text-muted-foreground"> {odds}</span>}
          </span>
          <ul className="grid gap-0.5">
            {shown.map((s, i) => (
              <li key={s.url} className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <a href={s.url} target="_blank" rel="noopener" title={s.title} onClick={() => track("article_click", { outlet: outletOf(s.url) })}
                  className="inline-flex min-h-7 min-w-0 items-center gap-1 hover:text-foreground">
                  <span className="truncate">{s.author ? `${s.author}, ${s.site}` : s.site}</span>
                  {compact && i === 0 && who.length > 1 && <span className="shrink-0">+ {who.length - 1}</span>}
                </a>
                <SeasonRecord s={s} sport={sport} />
              </li>
            ))}
          </ul>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
          {who.length > 1 && <span className="pl-label tabular rounded-full bg-[var(--hot-soft)] px-2 py-0.5 text-[10px]" title="Different analysts who made this same pick">{who.length}</span>}
          <ResultChip result={p.result} />
          {why.length > 0 && (
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
              className={`min-h-9 rounded-full px-3 text-[13px] ${open ? "bg-foreground text-background" : "border hover:bg-muted"}`}>
              {open ? "Hide why" : "Why?"}
            </button>
          )}
        </span>
      </div>
      {open && <div className="grid gap-4">{why.map((e) => <Why key={e.url} e={e} s={byUrl.get(e.url)} />)}</div>}
      {!compact && p.result_detail && <div className="font-mono text-xs tabular-nums text-muted-foreground">{p.result_detail}</div>}
    </li>
  );
}
