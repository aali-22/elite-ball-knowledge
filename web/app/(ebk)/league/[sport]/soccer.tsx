"use client";

// A domestic soccer competition's page (/league/soccer/eng.1, backlog I29): the real table is the spine (place, crest,
// club, played, W-D-L, goal difference, points, last five) with a rank rail per row for the stat picked above it, and a
// ladder of every club by that stat beside it that re-sorts when the stat or the schedule switch changes. Pressing a club
// follows it in both. On a phone the table is compact and a tapped row opens that club's six ranks.
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Crest } from "@/components/ebk/Crest";
import { DataNote } from "@/components/ebk/DataNote";
import { BandMark, CompetitionPills, CompetitionSelect, FormChips, LeaguePicker, RankDot, ScheduleSwitch, StatChips } from "@/components/ebk/LeagueBits";
import { LoadError } from "@/components/ebk/LoadError";
import { StatGlyph } from "@/components/ebk/StatGlyph";
import { ord, teamHref, useLeague, type LeagueTeam } from "@/lib/ebk";
import { competitionName } from "@/lib/ebk-queries";
import { BANDS, LEAGUE_NOTES, SOCCER_STATS, bandOf, bandRange } from "@/lib/framing";
import { useUrlState } from "@/lib/urlState";

const ROW = 34;  // the ladder's step: one club per step, spaced by rank
export const gd = (n: number | null | undefined) => (n == null ? "—" : n > 0 ? `+${n}` : String(n));
export const rankIn = (t: LeagueTeam, trait: string, adj: boolean) => {
  const v = t.traits.find((x) => x.trait === trait);
  return (adj ? v?.adj_rank ?? v?.rank : v?.rank) ?? null;
};

/** Which of the six stats a competition ranks, and which it leaves out (shown locked). */
export function useSix(teams: LeagueTeam[] | undefined, statParam: string) {
  return useMemo(() => {
    const have = new Set((teams ?? []).flatMap((t) => t.traits.filter((v) => v.rank != null).map((v) => v.trait)));
    const locked = new Set(SOCCER_STATS.filter((s) => !have.has(s.id)).map((s) => s.id));
    const stat = SOCCER_STATS.find((s) => s.id === statParam && !locked.has(s.id)) ?? SOCCER_STATS.find((s) => !locked.has(s.id)) ?? SOCCER_STATS[0];
    return { locked, stat };
  }, [teams, statParam]);
}

export function SoccerLeagueView({ competition }: { competition: string }) {
  const q = useLeague("soccer", competition);
  const [statParam, setStat] = useUrlState<string>("stat", SOCCER_STATS[0].id, SOCCER_STATS.map((s) => s.id));
  const [numbers, setNumbers] = useUrlState<"raw" | "adj">("numbers", "raw", ["raw", "adj"]);
  const [clubParam, setClub] = useUrlState<string>("club", "");
  const [open, setOpen] = useState<string | null>(null);
  const adj = numbers === "adj";
  const comp = q.data?.competition ?? competition, name = competitionName(comp) ?? comp;
  const teams = useMemo(() => q.data?.teams ?? [], [q.data]);
  const of = teams.length;
  const { locked, stat } = useSix(q.data?.teams, statParam);
  const followed = clubParam === "none" ? null : teams.some((t) => t.team === clubParam) ? clubParam : teams[0]?.team ?? null;
  const follow = (team: string) => setClub(team === followed ? "none" : team === teams[0]?.team ? "" : team);
  const hasAdj = teams.some((t) => t.traits.some((v) => v.trait === stat.id && v.adj_rank != null));
  // the ladder: every club by the stat picked, best first; a club without it goes last
  const ladder = useMemo(() => teams.map((t) => ({ t, rank: rankIn(t, stat.id, adj) }))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || (a.t.position ?? 99) - (b.t.position ?? 99)), [teams, stat.id, adj]);
  const at = new Map(ladder.map((x, k) => [x.t.team, k]));
  const played = Math.max(0, ...teams.map((t) => t.played ?? 0));
  const codes = (q.data?.competitions ?? []).map((c) => c.code);
  const bands = BANDS[comp] ?? [];
  const line = `${stat.line} · ${adj ? (hasAdj ? "schedule taken out" : "no schedule version, as played") : "as played"}`;
  const href = (t: LeagueTeam) => teamHref("soccer", t.team, comp);

  return (
    <main className="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:py-10">
      <PageHeader title={name} size="lg" eyebrow={<span>League · Soccer</span>} right={<LeaguePicker value="soccer" />} />
      {q.isLoading && <div className="h-96 animate-pulse rounded-3xl bg-muted" />}
      {q.isError && <LoadError what="the league" retry={() => q.refetch()} />}
      {q.data && !teams.length && <p className="text-sm text-muted-foreground">No {name} table yet.</p>}
      {q.data && teams.length > 0 && (
        <>
          <div className="hidden md:block"><CompetitionPills current={comp} codes={codes} /></div>
          <div className="md:hidden"><CompetitionSelect current={comp} codes={codes} /></div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4">
            <span className="pl-label text-[11px] text-muted-foreground">{of} clubs{played ? ` · after ${played} matches` : ""}</span>
            <DataNote summary="How this is ranked">{LEAGUE_NOTES.soccer(name)}</DataNote>
            {locked.size > 0 && <DataNote summary={LEAGUE_NOTES.locked}>{q.data.notes?.length ? q.data.notes.join(" ") : `${SOCCER_STATS.filter((s) => locked.has(s.id)).map((s) => s.label).join(", ")}: not ranked in the ${name} yet.`}</DataNote>}
          </div>

          <div className="grid gap-3">
            <div className="hidden flex-wrap items-center gap-3 md:flex">
              <span className="pl-label text-[11px] text-muted-foreground">Rank by</span>
              <StatChips stats={SOCCER_STATS} value={stat.id} onChange={setStat} locked={locked} sport="soccer" />
              <div className="ml-auto"><ScheduleSwitch on={adj} onChange={(v) => setNumbers(v ? "adj" : "raw")} sport="soccer" /></div>
            </div>
            <div className="md:hidden"><StatChips stats={SOCCER_STATS} value={stat.id} onChange={setStat} locked={locked} sport="soccer" scroll /></div>
            <div className="flex items-center justify-between gap-3 md:hidden">
              <span className="text-[13px] text-muted-foreground">{line}</span>
              <ScheduleSwitch on={adj} onChange={(v) => setNumbers(v ? "adj" : "raw")} sport="soccer" label="Schedule out" bare />
            </div>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* the table: desktop */}
            <section aria-label={`${name} table`} className="pl-reading hidden overflow-x-auto rounded-3xl border md:block">
              <table className="w-full min-w-[660px] border-collapse text-sm">
                <thead>
                  <tr className="pl-label text-left text-[10px] text-muted-foreground">
                    <th scope="col" className="w-10 py-3.5 pl-5 font-normal">#</th>
                    <th scope="col" className="px-2 py-3.5 font-normal">Club</th>
                    <th scope="col" className="px-2 py-3.5 text-right font-normal">P</th>
                    <th scope="col" className="px-2 py-3.5 text-right font-normal">W-D-L</th>
                    <th scope="col" className="px-2 py-3.5 text-right font-normal">GD</th>
                    <th scope="col" className="px-2 py-3.5 text-right font-normal">Pts</th>
                    <th scope="col" className="py-3.5 pr-2 pl-4 font-normal">Form</th>
                    <th scope="col" className="w-[190px] py-3.5 pr-5 pl-2 font-normal">{stat.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => {
                    const on = t.team === followed, band = bandOf(comp, t.position, of);
                    return (
                      <tr key={t.team} onClick={() => follow(t.team)} className={`cursor-pointer border-t border-[var(--reading-rule,var(--border))] transition-colors motion-reduce:transition-none ${on ? "bg-muted/70" : "hover:bg-muted/40"}`}>
                        <td className="relative py-0 pl-5">
                          <BandMark kind={band?.kind} className="absolute top-1.5 bottom-1.5 left-0" />
                          <span className="tabular font-mono text-muted-foreground">{t.position ?? "—"}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <button type="button" aria-pressed={on} aria-label={`Follow ${t.name}`} onClick={(e) => { e.stopPropagation(); follow(t.team); }}
                              className="grid size-9 shrink-0 place-items-center rounded-full" style={on ? { boxShadow: "0 0 0 2px var(--hot)" } : undefined}>
                              <Crest sport="soccer" team={t.team} name={t.name} size={26} />
                            </button>
                            <Link href={href(t)} onClick={(e) => e.stopPropagation()} className="pl-matchup truncate text-[19px] leading-none hover:underline">{t.name}</Link>
                          </span>
                        </td>
                        <td className="tabular px-2 text-right font-mono text-muted-foreground">{t.played ?? "—"}</td>
                        <td className="tabular px-2 text-right font-mono whitespace-nowrap text-muted-foreground">{t.wins}-{t.draws}-{t.losses}</td>
                        <td className="tabular px-2 text-right font-mono" title={t.goals_for != null ? `${t.goals_for} scored, ${t.goals_against} conceded` : undefined}>{gd(t.goal_diff)}</td>
                        <td className="tabular px-2 text-right font-mono text-[15px] font-medium">{t.points ?? "—"}</td>
                        <td className="py-1.5 pr-2 pl-4"><FormChips form={t.form} /></td>
                        <td className="py-1.5 pr-5 pl-2"><RankDot rank={rankIn(t, stat.id, adj)} of={of} on={on} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-5 py-3.5 text-xs text-muted-foreground">
                {bands.map((b) => <span key={b.label} className="inline-flex items-center gap-2"><BandMark kind={b.kind} className="h-3.5" />{b.label}</span>)}
                <span className="ml-auto">Rank rail: best on the right · press a club to follow it</span>
              </div>
            </section>

            {/* the table: phone */}
            <section aria-label={`${name} table`} className="pl-reading overflow-hidden rounded-2xl border md:hidden">
              <div className="pl-label grid grid-cols-[22px_minmax(0,1fr)_34px_34px_50px] gap-1.5 px-3 pt-3 pb-2 text-[10px] text-muted-foreground">
                <span>#</span><span>Club</span><span className="text-right">GD</span><span className="text-right">Pts</span><span className="text-right">Rank</span>
              </div>
              {teams.map((t) => {
                const isOpen = open === t.team, r = rankIn(t, stat.id, adj), band = bandOf(comp, t.position, of);
                return (
                  <div key={t.team} className={`border-t border-[var(--reading-rule,var(--border))] ${isOpen ? "bg-muted/60" : ""}`}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : t.team)}
                      className="relative grid min-h-12 w-full grid-cols-[22px_minmax(0,1fr)_34px_34px_50px] items-center gap-1.5 px-3 py-1.5 text-left">
                      <BandMark kind={band?.kind} className="absolute top-2 bottom-2 left-0" />
                      <span className="tabular font-mono text-xs text-muted-foreground">{t.position ?? "—"}</span>
                      <span className="grid min-w-0 gap-1">
                        <span className="flex min-w-0 items-center gap-2"><Crest sport="soccer" team={t.team} name={t.name} size={18} /><span className="pl-matchup truncate text-[17px] leading-none">{t.name}</span></span>
                        <FormChips form={t.form} size={14} />
                      </span>
                      <span className="tabular text-right font-mono text-xs">{gd(t.goal_diff)}</span>
                      <span className="tabular text-right font-mono text-sm font-medium">{t.points ?? "—"}</span>
                      <span className={`tabular justify-self-end rounded-full px-1.5 py-0.5 font-mono text-[11px] ${r && r <= 5 ? "bg-foreground text-background" : "bg-muted"}`}>{r ? ord(r) : "—"}</span>
                    </button>
                    {isOpen && (
                      <div className="grid gap-3 px-3 pb-3.5 pl-8">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                          {SOCCER_STATS.map((s) => {
                            const k = locked.has(s.id) ? null : rankIn(t, s.id, adj);
                            return (
                              <div key={s.id} className="grid gap-1">
                                <span className="flex justify-between gap-2 text-[11px] text-muted-foreground"><span className="truncate">{s.label}</span><span className="tabular font-mono text-foreground">{k ? ord(k) : "—"}</span></span>
                                <span aria-hidden className="relative h-1 rounded-full bg-[var(--viz-axis)]">{k != null && <span className={`absolute inset-y-0 left-0 rounded-full ${s.id === stat.id ? "bg-[var(--hot)]" : "bg-foreground"}`} style={{ width: `${((of - k) / Math.max(1, of - 1)) * 100}%` }} />}</span>
                              </div>
                            );
                          })}
                        </div>
                        <span className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="tabular font-mono">{t.wins}-{t.draws}-{t.losses} · {t.played ?? "—"} played</span>
                          <Link href={href(t)} className="pl-label underline decoration-[var(--hot)] decoration-2 underline-offset-4">Club page</Link>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="grid gap-1.5 border-t p-3 text-[11px] text-muted-foreground">
                {bands.map((b) => <span key={b.label} className="inline-flex items-center gap-2"><BandMark kind={b.kind} className="h-3" />{b.label}<span className="tabular font-mono">({bandRange(b, of)})</span></span>)}
              </div>
            </section>

            {/* the ladder: every club by the stat, best at the top, re-sorting when the stat or the schedule switch changes */}
            <aside aria-label={`${stat.label} ranking`} className="pl-reading hidden rounded-3xl border p-5 md:block">
              <div className="flex items-center gap-2.5">
                <StatGlyph trait={stat.id} size={32} className="rounded-lg" />
                <h2 className="pl-display text-3xl leading-none">{stat.label}</h2>
              </div>
              <p className="mt-1.5 mb-4 text-[13px] text-muted-foreground">{line}</p>
              <div className="pl-label mb-1.5 flex justify-between text-[10px] text-muted-foreground"><span>Best</span><span>Rank</span></div>
              <ol className="relative" style={{ height: ladder.length * ROW }}>
                {teams.map((t) => {
                  const k = at.get(t.team) ?? 0, r = ladder[k]?.rank, on = t.team === followed;
                  return (
                    <li key={t.team} className="absolute inset-x-0 transition-[top,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                      style={{ top: k * ROW, height: ROW - 2, opacity: followed && !on ? 0.5 : 1, zIndex: on ? 2 : 1 }}>
                      <button type="button" aria-pressed={on} onClick={() => follow(t.team)} className="flex h-full w-full items-center gap-2.5 rounded-lg px-1 text-left hover:bg-muted/50">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full" style={on ? { boxShadow: "0 0 0 2px var(--hot)" } : undefined}>
                          <Crest sport="soccer" team={t.team} name={t.name} size={on ? 28 : 22} />
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-sm ${on ? "font-semibold" : ""}`}>{t.name}</span>
                        <span className={`tabular font-mono text-xs ${on ? "text-[var(--hot)]" : "text-muted-foreground"}`}>{r ?? "—"}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="pl-label mt-1.5 flex justify-between text-[10px] text-muted-foreground"><span>Worst</span><span className="tabular">{of}</span></div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
