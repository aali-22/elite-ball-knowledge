"use client";

// The Champions League's page (/league/soccer/uefa.champions, backlog I29): the 36-club league phase in its three bands
// (round of 16, knockout play-off, out), each club tagged with the domestic league it plays in (from the five domestic
// tables), points drawn as blocks, a highlight by country, and the stats the competition ranks with a rank rail per row.
// Match-level stats the competition leaves out are shown locked, with the reason behind a data note.
import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Crest } from "@/components/ebk/Crest";
import { DataNote } from "@/components/ebk/DataNote";
import { BAND_INK, CompetitionPills, CompetitionSelect, LeaguePicker, RankDot, ScheduleSwitch, StatChips } from "@/components/ebk/LeagueBits";
import { LoadError } from "@/components/ebk/LoadError";
import { ord, teamHref, useLeague, type LeagueTeam } from "@/lib/ebk";
import { COMPETITIONS } from "@/lib/ebk-queries";
import { BANDS, LEAGUE_NOTES, SOCCER_STATS, UCL_PHASE_MATCHES, bandRange } from "@/lib/framing";
import { useUrlState } from "@/lib/urlState";
import { gd, rankIn, useSix } from "./soccer";
import { Lock } from "lucide-react";

const UCL = "uefa.champions";
const COUNTRIES = COMPETITIONS.filter((c) => c.tag);
const tagOf = (t: LeagueTeam) => COMPETITIONS.find((c) => c.code === t.domestic)?.tag ?? null;

function Blocks({ points, available, ink }: { points: number | null | undefined; available: number; ink: string }) {
  return (
    <span role="img" aria-label={`${points ?? 0} of ${available} points`} className="flex gap-[3px]">
      {Array.from({ length: available }, (_, i) => (
        <span key={i} aria-hidden className="h-2.5 max-w-3 min-w-1 flex-1 rounded-[2px]" style={{ background: i < (points ?? 0) ? ink : "var(--viz-grid)" }} />
      ))}
    </span>
  );
}

export function UclView() {
  const q = useLeague("soccer", UCL);
  const [statParam, setStat] = useUrlState<string>("stat", SOCCER_STATS[0].id, SOCCER_STATS.map((s) => s.id));
  const [numbers, setNumbers] = useUrlState<"raw" | "adj">("numbers", "raw", ["raw", "adj"]);
  const [lg, setLg] = useUrlState<string>("country", "all", ["all", ...COUNTRIES.map((c) => c.tag!), "other"]);
  const adj = numbers === "adj";
  const teams = useMemo(() => q.data?.teams ?? [], [q.data]);
  const of = teams.length;
  const { locked, stat } = useSix(q.data?.teams, statParam);
  const played = Math.max(0, ...teams.map((t) => t.played ?? 0));
  const available = 3 * played;
  const codes = (q.data?.competitions ?? []).map((c) => c.code);
  const hit = (t: LeagueTeam) => lg === "all" || (lg === "other" ? !tagOf(t) : tagOf(t) === lg);
  const counts = (k: string) => teams.filter((t) => (k === "other" ? !tagOf(t) : tagOf(t) === k)).length;
  const chips = [{ k: "all", label: "All", n: of }, ...COUNTRIES.map((c) => ({ k: c.tag!, label: c.country!, n: counts(c.tag!) })), { k: "other", label: "Other", n: counts("other") }];
  const lockedNames = SOCCER_STATS.filter((s) => locked.has(s.id)).map((s) => s.label.toLowerCase());
  const pill = (on: boolean) => `inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors motion-reduce:transition-none ${on ? "border-foreground bg-foreground text-background" : "hover:bg-muted/60"}`;

  return (
    <main className="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:py-10">
      <PageHeader title="Champions League" size="lg" eyebrow={<span>League · Soccer</span>} right={<LeaguePicker value="soccer" />} />
      {q.isLoading && <div className="h-96 animate-pulse rounded-3xl bg-muted" />}
      {q.isError && <LoadError what="the league" retry={() => q.refetch()} />}
      {q.data && !teams.length && <p className="text-sm text-muted-foreground">No Champions League table yet.</p>}
      {q.data && teams.length > 0 && (
        <>
          <div className="hidden md:block"><CompetitionPills current={UCL} codes={codes} /></div>
          <div className="md:hidden"><CompetitionSelect current={UCL} codes={codes} /></div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
            <span className="pl-label text-[11px] text-muted-foreground">League phase · {of} clubs · {Math.min(played, UCL_PHASE_MATCHES)} of {UCL_PHASE_MATCHES} matchdays</span>
            {locked.size > 0 && (
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-dashed px-3 text-xs text-muted-foreground">
                <Lock aria-hidden className="size-3.5" />{lockedNames.join(", ").replace(/^./, (c) => c.toUpperCase())} not ranked yet
              </span>
            )}
            {locked.size > 0 && <DataNote summary={LEAGUE_NOTES.locked}>{q.data.notes.join(" ") || `${lockedNames.join(", ")}: not ranked in this competition yet.`}</DataNote>}
            <DataNote summary="How the league phase works">{LEAGUE_NOTES.ucl(available)}</DataNote>
          </div>

          <div className="grid gap-3">
            <div role="group" aria-label="Highlight a league" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none]">
              <span className="pl-label hidden self-center text-[11px] text-muted-foreground md:inline">Highlight</span>
              {chips.map((c) => (
                <button key={c.k} type="button" aria-pressed={lg === c.k} onClick={() => setLg(c.k)} className={`${pill(lg === c.k)} shrink-0`}>
                  {c.label}<span className="tabular font-mono text-[11px] opacity-70">{c.n}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="pl-label hidden text-[11px] text-muted-foreground md:inline">Rank by</span>
              <div className="hidden md:block"><StatChips stats={SOCCER_STATS} value={stat.id} onChange={setStat} locked={locked} sport="soccer" /></div>
              <div className="w-full md:hidden"><StatChips stats={SOCCER_STATS} value={stat.id} onChange={setStat} locked={locked} sport="soccer" scroll /></div>
              <div className="md:ml-auto"><ScheduleSwitch on={adj} onChange={(v) => setNumbers(v ? "adj" : "raw")} sport="soccer" /></div>
            </div>
          </div>

          {BANDS[UCL].map((b) => {
            const rows = teams.filter((t) => t.position != null && t.position >= b.from && t.position <= b.to);
            const ink = BAND_INK[b.kind];
            return (
              <section key={b.kind} aria-label={b.label} className="pl-reading overflow-hidden rounded-3xl border">
                <div className="relative flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b px-5 pt-4 pb-3">
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: ink }} />
                  <h2 className="pl-display text-3xl leading-none">{b.label}</h2>
                  <span className="tabular font-mono text-xs text-muted-foreground">{bandRange(b, of)}</span>
                  <span className="text-[13px] text-muted-foreground lg:ml-auto">{b.what}</span>
                </div>
                {/* desktop rows */}
                <div className="hidden lg:block">
                  <div className="pl-label grid grid-cols-[40px_minmax(0,1fr)_52px_32px_64px_44px_40px_minmax(110px,170px)_150px] items-center gap-2 px-5 pt-2.5 pb-1.5 text-[10px] text-muted-foreground">
                    <span>#</span><span>Club</span><span>League</span><span className="text-right">P</span><span className="text-right">W-D-L</span><span className="text-right">GD</span><span className="text-right">Pts</span><span className="pl-3">Points</span><span>{stat.label}</span>
                  </div>
                  {rows.map((t) => {
                    const on = hit(t), ringed = on && lg !== "all";
                    return (
                      <div key={t.team} className="grid min-h-12 grid-cols-[40px_minmax(0,1fr)_52px_32px_64px_44px_40px_minmax(110px,170px)_150px] items-center gap-2 border-t border-[var(--reading-rule,var(--border))] px-5 transition-opacity duration-300 motion-reduce:transition-none"
                        style={{ opacity: on ? 1 : 0.28 }}>
                        <span className="tabular font-mono text-[13px] text-muted-foreground">{t.position}</span>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full" style={ringed ? { boxShadow: "0 0 0 2px var(--hot)" } : undefined}><Crest sport="soccer" team={t.team} name={t.name} size={24} /></span>
                          <Link href={teamHref("soccer", t.team, UCL)} className="pl-matchup truncate text-[19px] leading-none hover:underline">{t.name}</Link>
                        </span>
                        <span className="justify-self-start rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground">{tagOf(t) ?? "—"}</span>
                        <span className="tabular text-right font-mono text-[13px] text-muted-foreground">{t.played ?? "—"}</span>
                        <span className="tabular text-right font-mono text-[13px] text-muted-foreground">{t.wins}-{t.draws}-{t.losses}</span>
                        <span className="tabular text-right font-mono text-[13px]">{gd(t.goal_diff)}</span>
                        <span className="tabular text-right font-mono text-[15px] font-medium">{t.points ?? "—"}</span>
                        <span className="pl-3"><Blocks points={t.points} available={available} ink={ink} /></span>
                        <RankDot rank={rankIn(t, stat.id, adj)} of={of} />
                      </div>
                    );
                  })}
                </div>
                {/* phone and tablet rows */}
                <div className="lg:hidden">
                  {rows.map((t) => {
                    const on = hit(t), r = rankIn(t, stat.id, adj);
                    return (
                      <Link key={t.team} href={teamHref("soccer", t.team, UCL)} className="grid min-h-14 grid-cols-[24px_minmax(0,1fr)_30px_48px] items-center gap-2 border-t border-[var(--reading-rule,var(--border))] px-4 py-2 transition-opacity duration-300 motion-reduce:transition-none"
                        style={{ opacity: on ? 1 : 0.28 }}>
                        <span className="tabular font-mono text-xs text-muted-foreground">{t.position}</span>
                        <span className="grid min-w-0 gap-1.5">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="grid shrink-0 place-items-center rounded-full" style={on && lg !== "all" ? { boxShadow: "0 0 0 2px var(--hot)" } : undefined}><Crest sport="soccer" team={t.team} name={t.name} size={20} /></span>
                            <span className="pl-matchup truncate text-[17px] leading-none">{t.name}</span>
                            <span className="shrink-0 rounded border px-1 font-mono text-[9px] tracking-wider text-muted-foreground">{tagOf(t) ?? "—"}</span>
                          </span>
                          <Blocks points={t.points} available={available} ink={ink} />
                        </span>
                        <span className="tabular text-right font-mono text-sm font-medium">{t.points ?? "—"}</span>
                        <span className="tabular justify-self-end rounded-full bg-muted px-1.5 py-0.5 font-mono text-[11px]" title={`${stat.label} rank`}>{r ? ord(r) : "—"}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <p className="-mt-3 text-xs text-muted-foreground">One block per point, of the {available} available so far · rank rail: {stat.label.toLowerCase()}, best on the right</p>
        </>
      )}
    </main>
  );
}
