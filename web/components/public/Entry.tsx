"use client";

// The ways into PickLab from the rest of the site: each says what PickLab is for in one line
// and shows it with real records, never a slogan alone. Rendered only where PickLab is on (lib/site PICKLAB).
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { labGameHref } from "@/lib/picklab";
import { MIN_GRADED, isDesk, outlet, topAnalysts, usePublicPicks, usePublicRecords, type PickRecords } from "@/lib/public";
import { SITE } from "@/lib/site";
import { AnalystChip, Avatar, RecordLine } from "./Analyst";
import { voices } from "./PublicPickRow";

type Rec = PickRecords["experts"][number];
const pill = "pl-label inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-[10px] hover:bg-muted";

/** The home page's door: the question PickLab answers, beside the three analysts doing best right now. */
export function PickLabDoor() {
  const recs = usePublicRecords(30);
  const top = topAnalysts(recs.data, 3);
  return (
    <Reveal className="grid gap-6 rounded-3xl border p-6 sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-10">
      <div className="grid gap-3">
        <p className="pl-label text-[10px] text-muted-foreground">Also on {SITE.short} · PickLab</p>
        <h2 className="pl-display text-4xl sm:text-5xl">Who is actually right?</h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Public analysts make picks every day. PickLab writes each one down and grades it on the final score.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/picklab/experts" className={pill}>See the records <ArrowRight aria-hidden className="size-3.5" /></Link>
          <Link href="/picklab" className={pill}>Upcoming picks <ArrowRight aria-hidden className="size-3.5" /></Link>
        </div>
      </div>
      {top.length > 0 && (
        <div className="pl-reading grid gap-3 rounded-2xl border p-4 sm:p-5">
          <p className="pl-label text-[10px] text-muted-foreground">Most units, last 30 days · analysts with 10+ priced picks</p>
          <ol className="grid gap-3">
            {top.map((r, i) => (
              <li key={r.key} className="grid grid-cols-[1.2rem_minmax(0,1fr)] items-center gap-2">
                <span className="tabular text-xs text-muted-foreground">{i + 1}</span>
                <AnalystChip r={r} lead={i === 0} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </Reveal>
  );
}

/** A game page's card: who has picked this game, what they picked, and how each of them has done lately. */
export function GamePicksCard({ eventId }: { eventId: string }) {
  const picks = usePublicPicks();
  const recs = usePublicRecords(30);
  const mine = picks.data?.games.find((g) => g.event_id === eventId);
  if (!mine || !mine.picks.length) return null;
  const record = new Map((recs.data?.experts ?? []).map((r) => [r.key, r]));
  // one row per named analyst, with the first thing they picked here: game lines before props, most-cited first
  const people = new Map<string, { name: string; site: string; pick: string; rec?: Rec }>();
  const ordered = [...mine.picks].sort((a, b) => Number(!!a.player_name) - Number(!!b.player_name) || b.experts - a.experts);
  for (const p of ordered) for (const s of voices(p)) {
    if (!s.author || isDesk(s.author)) continue;
    const key = `${s.site_id}|${s.author.toLowerCase()}`;
    if (!people.has(key)) people.set(key, { name: s.author, site: outlet(s.site_id), pick: p.text, rec: record.get(key) });
  }
  const rows = [...people.values()].sort((a, b) => Number(!!b.rec && b.rec.picks >= MIN_GRADED) - Number(!!a.rec && a.rec.picks >= MIN_GRADED) || (b.rec?.units ?? 0) - (a.rec?.units ?? 0));
  const all = new Set(mine.picks.flatMap((p) => p.sources.map((x) => `${x.site_id}|${x.author ?? ""}`)));
  return (
    <Reveal className="grid gap-5 rounded-3xl border p-6 sm:p-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-10">
      <div className="grid gap-2">
        <span className="pl-label text-[10px] text-muted-foreground">On PickLab</span>
        <p className="pl-display text-3xl sm:text-4xl">{all.size} {all.size === 1 ? "analyst has" : "analysts have"} picked this game</p>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">What they picked, and how each has done over the last 30 days. Analysts can be on opposite sides.</p>
        <Link href={labGameHref(eventId)} prefetch={false} className={`${pill} mt-1 justify-self-start`}>See this game&apos;s picks <ArrowRight aria-hidden className="size-3.5" /></Link>
      </div>
      {rows.length > 0 && (
        <ul className="grid">
          {rows.slice(0, 4).map((x) => (
            <li key={`${x.site}|${x.name}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-t py-2.5 first:border-t-0 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
              <Avatar name={x.name} size={34} />
              <span className="grid min-w-0">
                <span className="truncate text-sm font-medium">{x.name}</span>
                <span className="truncate text-xs text-muted-foreground">{x.site}{x.rec ? <> · <RecordLine r={x.rec} className="text-foreground" /></> : " · no graded picks yet"}</span>
              </span>
              <span className="col-span-2 text-sm leading-snug sm:col-span-1 sm:text-right">{x.pick}</span>
            </li>
          ))}
          {rows.length > 4 && <li className="pl-label border-t pt-2.5 text-[10px] text-muted-foreground">and {rows.length - 4} more</li>}
        </ul>
      )}
    </Reveal>
  );
}
