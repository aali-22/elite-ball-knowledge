"use client";

// Any two teams as if they met today: pick a league and two teams, get the same breakdown a real game gets.
// The choice lives in the address (?sport=&a=&b=) so a comparison can be shared.
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { BoardView } from "@/components/ebk/BoardView";
import { sidesOf } from "@/components/ebk/Cards";
import { InsightViz } from "@/components/ebk/Charts";
import { SportPicker } from "@/components/ebk/Controls";
import { Crest } from "@/components/ebk/Crest";
import { Reveal } from "@/components/motion/Reveal";
import { Seen } from "@/components/motion/Scroll";
import { slug, useCompare, useLeague } from "@/lib/ebk";
import { AWAY, HOME } from "@/lib/site";

const SPORTS = ["nba", "nfl", "soccer"];

function TeamSelect({ label, value, onChange, teams, ink, sport }: {
  label: string; value: string | null; onChange: (v: string) => void; teams: { team: string; name: string }[]; ink: string; sport: string;
}) {
  const cur = teams.find((t) => t.team === value);
  return (
    <label className="pl-reading grid gap-3 rounded-3xl border p-4 sm:p-5" style={{ boxShadow: `inset 0 3px 0 ${ink}` }}>
      <span className="pl-label text-[10px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-3">
        {cur ? <Crest sport={sport} team={cur.team} name={cur.name} size={56} color={ink} /> : <span className="size-14 rounded-2xl border border-dashed" />}
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label}
          className="pl-matchup h-12 min-w-0 flex-1 rounded-xl border bg-background px-3 text-xl sm:text-2xl">
          <option value="" disabled>Choose a team</option>
          {teams.map((t) => <option key={t.team} value={t.team}>{t.name}</option>)}
        </select>
      </span>
    </label>
  );
}

function Compare() {
  const router = useRouter();
  const sp = useSearchParams();
  const sport = SPORTS.includes(sp.get("sport") ?? "") ? sp.get("sport")! : "nba";
  const league = useLeague(sport);
  const teams = useMemo(() => [...(league.data?.teams ?? [])].sort((x, y) => x.name.localeCompare(y.name)), [league.data]);
  const known = (v: string | null) => (v && teams.some((t) => slug(t.team) === slug(v)) ? teams.find((t) => slug(t.team) === slug(v))!.team : null);
  const a = known(sp.get("a")), b = known(sp.get("b"));
  const set = (next: { sport?: string; a?: string | null; b?: string | null }) => {
    const q = new URLSearchParams();
    const s = next.sport ?? sport;
    q.set("sport", s);
    const na = "a" in next ? next.a : next.sport ? null : a, nb = "b" in next ? next.b : next.sport ? null : b;
    if (na) q.set("a", slug(na));
    if (nb) q.set("b", slug(nb));
    router.replace(`/compare?${q}`, { scroll: false });
  };
  const board = useCompare(sport, a, b);
  const d = board.data;
  const sides = d ? sidesOf(d) : null;
  const balance = d?.insights.find((f) => f.kind === "balance");
  // two strong teams to start from, so the page is never empty
  const suggest = useMemo(() => [...(league.data?.teams ?? [])].filter((t) => t.offense != null && t.defense != null)
    .sort((x, y) => (y.offense! + y.defense!) - (x.offense! + x.defense!)).slice(0, 2), [league.data]);
  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-4 py-6 sm:gap-14 sm:py-10">
      <PageHeader title="Compare" size="lg" eyebrow={<span>What if they met today</span>}
        lede="Pick any two teams. Their newest identities are set against each other with the same formula and the same rules a scheduled game gets."
        right={<SportPicker sports={SPORTS} value={sport} onChange={(s) => s && set({ sport: s })} all={false} label="League" />} />
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <TeamSelect label="Home" sport={sport} value={a} onChange={(v) => set({ a: v })} teams={teams.filter((t) => t.team !== b)} ink={HOME.ink} />
        <span className="pl-display justify-self-center text-4xl text-muted-foreground">vs</span>
        <TeamSelect label="Away" sport={sport} value={b} onChange={(v) => set({ b: v })} teams={teams.filter((t) => t.team !== a)} ink={AWAY.ink} />
      </div>
      {(!a || !b) && suggest.length === 2 && (
        <button type="button" onClick={() => set({ a: suggest[0].team, b: suggest[1].team })} className="pl-label justify-self-start rounded-full border px-4 py-2 text-[10px] hover:bg-muted">
          Try {suggest[0].name} v {suggest[1].name}
        </button>
      )}
      {league.data && !teams.length && <p className="text-sm text-muted-foreground">No teams in this league have a breakdown in the last two weeks.</p>}
      {board.isLoading && a && b && <div className="h-80 animate-pulse rounded-3xl bg-muted" />}
      {d && sides && (
        <>
          {balance && (
            <Reveal className="pl-reading grid gap-3 rounded-3xl border p-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-8 sm:p-7">
              <div className="grid gap-1.5">
                <span className="pl-label text-[10px] text-muted-foreground">The whole board</span>
                <p className="pl-matchup text-2xl sm:text-3xl">{balance.title}</p>
                <p className="text-sm text-muted-foreground">{balance.claim}</p>
              </div>
              <Seen>{(seen) => <InsightViz f={balance} sides={sides} seen={seen} labels={{}} />}</Seen>
            </Reveal>
          )}
          {d.notes.map((x) => <p key={x} className="rounded-xl border-l-2 border-[var(--status-warning)] bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{x}</p>)}
          <BoardView b={d} />
        </>
      )}
    </main>
  );
}

export default function ComparePage() {
  return <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-10"><div className="h-80 animate-pulse rounded-3xl bg-muted" /></main>}><Compare /></Suspense>;
}
