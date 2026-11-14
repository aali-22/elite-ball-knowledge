"use client";

// One game in PickLab, for every league: who is on which side, every pick sorted into sides, totals and each
// player's, with the analyst's record this season beside each name. Where the site has its own breakdown of the game
// (the NBA, the NFL, soccer) it sits in a second tab, so the picks and the numbers are read in one place.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { GameView } from "@/app/(ebk)/game/[id]/view";
import { LoadError } from "@/components/ebk/LoadError";
import { LabProvider, useViewer } from "@/components/picklab/Context";
import { FollowStar, SplitBar, Teams } from "@/components/picklab/Game";
import { PickLine } from "@/components/picklab/Pick";
import { Skeleton } from "@/components/ui/skeleton";
import { playerHref, sportLabel, useIndex } from "@/lib/ebk";
import { SHAPE } from "@/lib/ebk-queries";
import { useExcerpts } from "@/lib/excerpts";
import { localDateTime } from "@/lib/format";
import { KINDS, KIND_LABEL, SLUG, awayName, byKind, byPlayer, fromSlug, homeName, kindOf, plural, sideSplit, type Kind } from "@/lib/picklab";
import { usePublicPicks, type PublicGame, type PublicPick } from "@/lib/public";
import { usePageTitle } from "@/lib/title";
import { useUrlState } from "@/lib/urlState";

type Tab = "picks" | "numbers";
const plain = (name: string) => name.normalize("NFKD").replace(/[^A-Za-z ]/g, "").toLowerCase().trim();
const pill = (on: boolean) => `pl-label inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[11px] ${on ? "bg-foreground text-background" : "border text-muted-foreground hover:text-foreground"}`;

function Picks({ g }: { g: PublicGame }) {
  const { owner } = useViewer();
  const [kind, setKind] = useUrlState<Kind | "all">("kind", "all", ["all", ...KINDS]);
  const { find } = useExcerpts(useMemo(() => [g.event_id], [g.event_id]), owner);
  const index = useIndex(g.sport === "nba" || g.sport === "nfl");
  const ids = useMemo(() => new Map((index.data?.players ?? []).map((x) => [plain(x.name), x.player_id])), [index.data]);
  const groups = byKind(g.picks);
  const sided = useMemo(() => { const x = sideSplit(g); return x.away.length + x.home.length > 0; }, [g]);
  const shown = groups.filter(([k]) => kind === "all" || k === kind);
  const rows = (ps: PublicPick[]) => <ul className="divide-y">{ps.map((p, i) => <PickLine key={`${p.text}-${i}`} p={p} sport={g.sport} why={find(g.event_id, p)} />)}</ul>;
  return (
    <div className={`grid gap-6 lg:items-start ${sided ? "lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-8" : ""}`}>
      {sided && <aside className="pl-reading rounded-2xl border p-4 lg:sticky lg:top-28"><SplitBar g={g} names /></aside>}
      <div className="grid min-w-0 gap-4">
        {groups.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick type">
            <button type="button" aria-pressed={kind === "all"} onClick={() => setKind("all")} className={pill(kind === "all")}>All<span className="tabular">{g.picks.length}</span></button>
            {groups.map(([k, ps]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={pill(kind === k)}>{KIND_LABEL[k]}<span className="tabular">{ps.length}</span></button>)}
          </div>
        )}
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {shown.map(([k, ps]) => (
            <section key={k} className={`pl-reading rounded-2xl border px-4 pb-1 pt-3 ${k === "props" && shown.length > 1 ? "xl:row-span-3" : ""}`}>
              <h2 className="pl-label pb-1 text-[10px] text-muted-foreground">{KIND_LABEL[k]} · {ps.length}</h2>
              {k !== "props" ? rows(ps) : byPlayer(ps).map(([name, mine]) => {
                const id = ids.get(plain(name));
                return (
                  <div key={name} className="border-t pt-2.5 first:border-t-0">
                    {id ? <Link href={playerHref(id)} className="pl-matchup text-[22px] underline decoration-border underline-offset-4 hover:decoration-[var(--hot)]">{name}</Link>
                      : <span className="pl-matchup text-[22px]">{name}</span>}
                    {rows(mine)}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Game() {
  const { id } = useParams<{ id: string }>();
  const ok = SLUG.test(id), eventId = ok ? fromSlug(id) : "";
  const { data, isLoading, error, refetch } = usePublicPicks();
  const g = data?.games.find((x) => x.event_id === eventId);
  const numbers = SHAPE.game.test(id);  // a league the site breaks games down for
  const [tab, setTab] = useUrlState<Tab>("tab", "picks", ["picks", "numbers"]);
  usePageTitle(g ? `${awayName(g)} at ${homeName(g)} · PickLab` : "Game · PickLab");
  const back = <Link href="/picklab" className="pl-label inline-flex min-h-11 items-center gap-1.5 text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden className="size-3.5" />Today</Link>;

  if (isLoading) return <div className="grid gap-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>;
  if (error && !data) return <LoadError what="this game" retry={() => refetch()} />;
  if (!g) {
    return (
      <div className="grid gap-3">
        {back}
        <h1 className="pl-display text-4xl">Not on the board</h1>
        <p className="max-w-md text-sm text-muted-foreground">PickLab holds games from three days back to two weeks ahead. This one is outside that, or has no picks.</p>
        {numbers && <div className="mt-4"><GameView id={id} embedded /></div>}
      </div>
    );
  }
  const kinds = new Set(g.picks.map(kindOf));
  return (
    <LabProvider sports={[g.sport]}>
      <div className="grid gap-5">
        <header className="grid gap-3">
          <div className="flex items-center justify-between gap-3">{back}<FollowStar g={g} labelled /></div>
          <p className="pl-label text-muted-foreground">{sportLabel(g.sport)}{g.slot && g.slot !== sportLabel(g.sport) ? ` · ${g.slot}` : ""} · {g.final ? "Final" : localDateTime(g.start)}</p>
          <h1 aria-label={`${awayName(g)} at ${homeName(g)}`}><span className="sm:hidden"><Teams g={g} size={36} /></span><span className="hidden sm:block"><Teams g={g} size={52} /></span></h1>
        </header>
        {numbers && (
          <div role="tablist" aria-label="This game" className="flex gap-1.5 border-b pb-3">
            <button type="button" role="tab" aria-selected={tab === "picks"} onClick={() => setTab("picks")} className={pill(tab === "picks")}>Picks<span className="tabular">{g.picks.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === "numbers"} onClick={() => setTab("numbers")} className={pill(tab === "numbers")}>The numbers</button>
          </div>
        )}
        {tab === "numbers" && numbers ? <GameView id={id} embedded /> : <Picks g={g} />}
        {tab === "picks" && <p className="text-xs text-muted-foreground">{plural(g.picks.length, "pick")} in {plural(kinds.size, "group")}. Records beside a name count that analyst&apos;s graded picks this season, league by league.</p>}
      </div>
    </LabProvider>
  );
}

export default function GamePage() {
  return <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}><Game /></Suspense>;
}
