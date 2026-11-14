"use client";

// Every game PickLab holds, three days back to two weeks ahead. By day is the default (today first, then the days to
// come, then the days behind); by type lines one family of picks up across the games still to play; by player puts
// everything on one player together.
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Picker } from "@/components/ebk/Controls";
import { LoadError } from "@/components/ebk/LoadError";
import { LabProvider } from "@/components/picklab/Context";
import { Find } from "@/components/picklab/Find";
import { DaySection } from "@/components/picklab/Game";
import { PickLine } from "@/components/picklab/Pick";
import { SportChips } from "@/components/picklab/SportChips";
import { Skeleton } from "@/components/ui/skeleton";
import { SPORT_ORDER } from "@/lib/ebk";
import { localDateTime } from "@/lib/format";
import { KINDS, KIND_LABEL, awayName, byDay, dayKey, homeName, kindOf, labGameHref, matches, phaseOf, plural, type Kind } from "@/lib/picklab";
import { usePublicPicks, type PublicGame, type PublicPick } from "@/lib/public";
import { usePageTitle } from "@/lib/title";
import { useUrlChoice, useUrlState } from "@/lib/urlState";

type View = "day" | "type" | "player";
const chip = (on: boolean) => `pl-label inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[11px] ${on ? "bg-foreground text-background" : "border text-muted-foreground hover:text-foreground"}`;

/** A pick with the game it is on named above it, for the views that are not grouped by game. */
function Row({ g, p }: { g: PublicGame; p: PublicPick }) {
  return (
    <li className="grid border-t pt-2 first:border-t-0 first:pt-0">
      <Link href={labGameHref(g.event_id)} prefetch={false} className="pl-label flex min-h-7 flex-wrap items-center justify-between gap-x-3 text-[10px] text-muted-foreground hover:text-foreground">
        <span>{awayName(g)} at {homeName(g)}</span><span>{localDateTime(g.start)}</span>
      </Link>
      <ul><PickLine p={p} sport={g.sport} /></ul>
    </li>
  );
}

function Games() {
  usePageTitle("All games · PickLab");
  const [sport, setSport] = useUrlChoice("sport");
  const [view, setView] = useUrlState<View>("view", "day", ["day", "type", "player"]);
  const [kind, setKind] = useUrlState<Kind>("kind", "sides", KINDS);
  const [q, setQ] = useUrlState<string>("q", "");
  const asked = q.trim();
  const { data, isLoading, error, refetch } = usePublicPicks();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  const all = useMemo(() => data?.games ?? [], [data]);
  const sports = useMemo(() => SPORT_ORDER.filter((s) => all.some((g) => g.sport === s)), [all]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of sports) c[s] = all.filter((g) => g.sport === s).length;
    return c;
  }, [all, sports]);
  const mine = useMemo(() => all.filter((g) => (!sport || g.sport === sport) && matches(g, asked)), [all, sport, asked]);
  const today = dayKey(now);
  const days = useMemo(() => {
    const grouped = [...byDay(mine)];
    return [...grouped.filter(([k]) => k >= today), ...grouped.filter(([k]) => k < today).reverse()];
  }, [mine, today]);
  // the cross-game views are about what is still to play
  const rows = useMemo(() => mine.filter((g) => phaseOf(g, now) !== "done").flatMap((g) => g.picks.map((p) => ({ g, p }))), [mine, now]);
  const kinds = KINDS.filter((k) => rows.some((r) => kindOf(r.p) === k));
  const picked = kinds.includes(kind) ? kind : kinds[0];
  const players = useMemo(() => {
    const out = new Map<string, { g: PublicGame; picks: PublicPick[] }>();
    for (const { g, p } of rows) if (p.player_name) { const k = `${p.player_name}|${g.event_id}`; out.set(k, { g, picks: [...(out.get(k)?.picks ?? []), p] }); }
    return [...out].map(([k, v]) => ({ name: k.split("|")[0], ...v })).sort((a, b) => b.picks.length - a.picks.length || a.name.localeCompare(b.name));
  }, [rows]);

  return (
    <LabProvider sports={sports}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Find value={q} onChange={setQ} />
          <SportChips counts={counts} total={all.length} value={sport} onChange={setSport} />
          <span className="ml-auto"><Picker label="View" value={view} onChange={setView} options={[{ value: "day", label: "By day" }, { value: "type", label: "By type" }, { value: "player", label: "By player" }]} /></span>
        </div>

        {isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        {error && !data && <LoadError what="the games" retry={() => refetch()} />}
        {data && !mine.length && <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{asked ? `Nothing for "${asked}".` : "No games with picks here."}</p>}

        {view === "day" && days.map(([day, gs]) => <DaySection key={day} day={day} games={gs} now={now} open={!!asked} />)}

        {view === "type" && picked && (
          <>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick type">
              {kinds.map((k) => (
                <button key={k} type="button" aria-pressed={picked === k} onClick={() => setKind(k)} className={chip(picked === k)}>
                  {KIND_LABEL[k]}<span className="tabular">{rows.filter((r) => kindOf(r.p) === k).length}</span>
                </button>
              ))}
            </div>
            <ul className="pl-reading grid gap-2 rounded-2xl border p-4">
              {rows.filter((r) => kindOf(r.p) === picked).map(({ g, p }, i) => <Row key={`${g.event_id}-${p.text}-${i}`} g={g} p={p} />)}
            </ul>
          </>
        )}
        {view === "type" && data && !picked && <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">Nothing on the games still to play.</p>}

        {view === "player" && (players.length ? (
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {players.map((x) => (
              <section key={`${x.name}-${x.g.event_id}`} className="pl-reading grid gap-1 rounded-2xl border p-4">
                <h2 className="pl-matchup text-2xl">{x.name}</h2>
                <Link href={labGameHref(x.g.event_id)} prefetch={false} className="pl-label text-[10px] text-muted-foreground hover:text-foreground">
                  {awayName(x.g)} at {homeName(x.g)} · {localDateTime(x.g.start)} · {plural(x.picks.length, "pick")}
                </Link>
                <ul className="divide-y">{x.picks.map((p, i) => <PickLine key={`${p.text}-${i}`} p={p} sport={x.g.sport} />)}</ul>
              </section>
            ))}
          </div>
        ) : data && <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No player picks on the games still to play.</p>)}
      </div>
    </LabProvider>
  );
}

export default function GamesPage() {
  return <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}><Games /></Suspense>;
}
