"use client";

// College football's league page (/league/ncaaf, backlog I28). 130-odd FBS teams don't fit one plot of logos, so the page
// starts from conferences: a strip of every conference sorted by its middle team's schedule-adjusted rank in net points
// per drive (a range bar from its best team to its worst, a dot per team, a tick at the middle one). Picking a conference
// lights its logos up on the offense/defense plot (every other team a faint dot behind them) and fills the table: record
// with a badge for games against lower-division teams, adjusted rank, as-played rank and schedule rank.
import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Crest } from "@/components/ebk/Crest";
import { DataNote } from "@/components/ebk/DataNote";
import { LeaguePicker } from "@/components/ebk/LeagueBits";
import { LoadError } from "@/components/ebk/LoadError";
import { ord, teamHref, useLeague, type LeagueTeam } from "@/lib/ebk";
import { LEAGUE_NOTES } from "@/lib/framing";
import { fmtDate, useLocalTime } from "@/lib/localTime";
import { useUrlState } from "@/lib/urlState";
import { track } from "@/lib/analytics";

const NET = "ncaaf.sit.net";
// the conferences' everyday short names (the strip's first column on a phone)
const SHORT: Record<string, string> = {
  SEC: "SEC", "Big Ten": "B1G", "Big 12": "B12", ACC: "ACC", "American Athletic": "AAC", "Sun Belt": "SBC", "Mid-American": "MAC",
  "Mountain West": "MW", "Conference USA": "CUSA", "Pac-12": "P12", "FBS Independents": "IND",
};
const short = (g: string) => SHORT[g] ?? g.split(/\s+/).map((w) => w[0]).join("").slice(0, 4).toUpperCase();

type Team = { t: LeagueTeam; adj: number | null; raw: number | null; sos: number | null };

function FcsBadge({ n, small = false }: { n: number | null | undefined; small?: boolean }) {
  if (!n) return null;
  return (
    <span title={`${n} ${n > 1 ? "games" : "game"} against lower-division (FCS) teams, counted in the record`}
      className={`tabular inline-flex shrink-0 items-center rounded-[5px] border border-dashed border-muted-foreground font-mono text-muted-foreground ${small ? "h-[18px] px-1 text-[9px]" : "h-5 px-1.5 text-[10px]"}`}>
      {n} FCS
    </span>
  );
}

export function CollegeLeagueView() {
  const local = useLocalTime();
  const q = useLeague("ncaaf");
  const [confParam, setConf] = useUrlState<string>("conf", "");
  const teams = useMemo<Team[]>(() => (q.data?.teams ?? []).map((t) => {
    const v = t.traits.find((x) => x.trait === NET);
    return { t, adj: v?.adj_rank ?? v?.rank ?? null, raw: v?.rank ?? null, sos: v?.sos_rank ?? null };
  }), [q.data]);
  const of = Math.max(2, ...((q.data?.teams ?? []).flatMap((t) => t.traits.filter((x) => x.trait === NET).map((x) => x.of ?? 0))), teams.length);
  const x = (rank: number) => ((of - rank) / Math.max(1, of - 1)) * 100;  // best on the right
  // every conference by the median of its teams' adjusted ranks (the middle team's; with an even count, the midpoint of
  // the two middle teams, so a two-team group isn't ranked by its better team alone), strongest first
  const confs = useMemo(() => {
    const by = new Map<string, number[]>();
    for (const r of teams) if (r.t.group && r.adj != null) by.set(r.t.group, [...(by.get(r.t.group) ?? []), r.adj]);
    return [...by].map(([g, ranks]) => {
      const s = [...ranks].sort((a, b) => a - b), n = s.length;
      const mid = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
      return { g, ranks: s, mid, mean: s.reduce((a, b) => a + b, 0) / n };
    }).sort((a, b) => a.mid - b.mid || a.mean - b.mean || a.g.localeCompare(b.g));
  }, [teams]);
  const midText = (m: number) => (Number.isInteger(m) ? ord(m) : m.toFixed(1));
  const conf = confs.some((c) => c.g === confParam) ? confParam : confs[0]?.g ?? "";
  const pick = (g: string) => { setConf(g === confs[0]?.g ? "" : g); track("league_conf_pick", { sport: "ncaaf" }); };
  const mine = teams.filter((r) => r.t.group === conf).sort((a, b) => (a.adj ?? 999) - (b.adj ?? 999));
  const built = (q.data?.teams ?? []).map((t) => t.as_of).sort().at(-1);
  const plotted = teams.filter((r) => r.t.offense != null && r.t.defense != null);

  return (
    <main className="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:py-10">
      <PageHeader title="College football" size="lg" eyebrow={<span>League · College football</span>} right={<LeaguePicker value="ncaaf" />} />
      {q.isLoading && <div className="h-96 animate-pulse rounded-3xl bg-muted" />}
      {q.isError && <LoadError what="the league" retry={() => q.refetch()} />}
      {q.data && !teams.length && <p className="text-sm text-muted-foreground">No college football teams with a breakdown in the last two weeks.</p>}
      {q.data && teams.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4">
            <span className="pl-label text-[11px] text-muted-foreground">FBS · {teams.length} teams{built ? ` · built ${fmtDate(built, { month: "short", day: "numeric" }, local)}` : ""}</span>
            <DataNote summary="How this is ranked">{LEAGUE_NOTES.cfb}</DataNote>
          </div>

          <section aria-label="Conference strength" className="pl-reading rounded-3xl border px-3 pt-4 pb-2 sm:px-5 sm:pt-5">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1">
              <h2 className="pl-display text-[26px] leading-none sm:text-4xl">Conference strength</h2>
              <span className="text-[13px] text-muted-foreground">Pick one to light it up below</span>
              <span className="pl-label ml-auto hidden text-[10px] text-muted-foreground md:inline">Worst ← net points per drive → best</span>
            </div>
            {confs.map((c) => {
              const on = c.g === conf, lo = x(c.ranks[c.ranks.length - 1]), hi = x(c.ranks[0]);
              return (
                <button key={c.g} type="button" aria-pressed={on} onClick={() => pick(c.g)}
                  aria-label={`${c.g}: median rank ${midText(c.mid)} of ${of}, best ${ord(c.ranks[0])}, worst ${ord(c.ranks[c.ranks.length - 1])}`}
                  className={`grid min-h-11 w-full grid-cols-[44px_minmax(0,1fr)_40px] items-center gap-2.5 rounded-lg border-t border-[var(--reading-rule,var(--border))] px-1 text-left transition-colors motion-reduce:transition-none md:min-h-12 md:grid-cols-[210px_minmax(0,1fr)_80px] md:gap-5 md:px-2.5 ${on ? "bg-muted/70" : "hover:bg-muted/40"}`}>
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <span className={`w-11 shrink-0 font-mono text-xs ${on ? "text-[var(--hot)]" : "text-muted-foreground"}`}>{short(c.g)}</span>
                    <span className={`hidden truncate text-sm md:inline ${on ? "font-semibold" : ""}`}>{c.g}</span>
                  </span>
                  <span aria-hidden className="relative h-6">
                    <span className="absolute inset-x-0 top-[11px] h-0.5 rounded-full bg-[var(--viz-grid)]" />
                    <span className="absolute top-[9px] h-1.5 rounded-full transition-colors motion-reduce:transition-none"
                      style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 0.6)}%`, background: on ? "color-mix(in oklab, var(--hot) 45%, transparent)" : "color-mix(in oklab, var(--foreground) 18%, transparent)" }} />
                    {c.ranks.map((r, i) => (
                      <span key={i} className={`absolute top-2 hidden size-2 -translate-x-1/2 rounded-full sm:block ${on ? "bg-[var(--hot)]" : "bg-muted-foreground/70"}`} style={{ left: `${x(r)}%` }} />
                    ))}
                    <span className={`absolute top-0.5 h-5 w-[3px] -translate-x-1/2 rounded-full ${on ? "bg-foreground" : "bg-muted-foreground"}`} style={{ left: `${x(c.mid)}%` }} />
                  </span>
                  <span className="tabular text-right font-mono text-[11px] text-muted-foreground md:text-xs"><span className="hidden md:inline">mid </span>{midText(c.mid)}</span>
                </button>
              );
            })}
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            {/* the league at a glance: every team a faint dot, the conference's logos large */}
            <section aria-label="The league at a glance" className="pl-reading hidden rounded-3xl border p-5 md:block">
              <h2 className="pl-display text-3xl leading-none">The league at a glance</h2>
              <p className="mt-1.5 mb-5 text-[13px] text-muted-foreground">Offense and defense, schedule taken out. {conf} in front, the other {plotted.length - mine.filter((r) => r.t.offense != null).length} behind.</p>
              <div className="relative mb-7 ml-7 aspect-square max-h-[560px] border-b border-l border-[var(--viz-axis)]">
                <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-[var(--viz-grid)]" />
                <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-[var(--viz-grid)]" />
                <span className="pl-label absolute top-2 right-2 text-[10px] text-muted-foreground">Good at both</span>
                <span className="pl-label absolute bottom-2 left-2 text-[10px] text-muted-foreground">Struggling at both</span>
                {plotted.map((r) => {
                  const lit = r.t.group === conf, label = `${r.t.name}: offense ${Math.round(r.t.offense! * 100)}, defense ${Math.round(r.t.defense! * 100)}, ${r.t.wins}-${r.t.losses}`;
                  const size = lit ? 32 : 6;
                  return lit ? (
                    <Link key={r.t.team} href={teamHref("ncaaf", r.t.team)} aria-label={label} title={label}
                      className="absolute z-[2] grid place-items-center rounded-full bg-[var(--surface,var(--background))] ring-2 ring-foreground/40 transition-[left,bottom,width,height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:ring-[var(--hot)] motion-reduce:transition-none"
                      style={{ left: `calc(${r.t.offense! * 100}% - ${size / 2}px)`, bottom: `calc(${r.t.defense! * 100}% - ${size / 2}px)`, width: size, height: size }}>
                      <Crest sport="ncaaf" team={r.t.team} name={r.t.name} size={26} />
                    </Link>
                  ) : (
                    <span key={r.t.team} aria-hidden title={label} className="absolute z-[1] rounded-full bg-muted-foreground/35"
                      style={{ left: `calc(${r.t.offense! * 100}% - ${size / 2}px)`, bottom: `calc(${r.t.defense! * 100}% - ${size / 2}px)`, width: size, height: size }} />
                  );
                })}
                <span className="pl-label absolute inset-x-0 -bottom-6 text-center text-[10px] text-muted-foreground">Offense →</span>
                <span className="pl-label absolute inset-y-0 -left-6 rotate-180 text-center text-[10px] text-muted-foreground [writing-mode:vertical-rl]">Defense →</span>
              </div>
            </section>

            {/* the conference's table */}
            <section aria-label={`${conf} table`} className="pl-reading hidden overflow-x-auto rounded-3xl border md:block">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pt-5 pb-2.5">
                <h2 className="pl-display text-3xl leading-none">{conf}</h2>
                <span className="text-[13px] text-muted-foreground">by net points per drive, schedule out</span>
              </div>
              <table className="w-full min-w-[500px] border-collapse text-sm">
                <thead>
                  <tr className="pl-label text-left text-[10px] text-muted-foreground">
                    <th scope="col" className="py-2 pr-2 pl-5 font-normal">Team</th>
                    <th scope="col" className="p-2 font-normal">Record</th>
                    <th scope="col" className="p-2 text-right font-normal">Rank /{of}</th>
                    <th scope="col" className="p-2 text-right font-normal" title="The rank before the schedule is taken out">As played</th>
                    <th scope="col" className="py-2 pr-5 pl-2 text-right font-normal" title={`How hard the schedule has been: 1st = hardest of ${of}`}>Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((r) => (
                    <tr key={r.t.team} className="border-t border-[var(--reading-rule,var(--border))]">
                      <td className="py-2 pr-2 pl-5">
                        <Link href={teamHref("ncaaf", r.t.team)} className="flex min-w-0 items-center gap-2.5 hover:underline">
                          <Crest sport="ncaaf" team={r.t.team} name={r.t.name} size={26} /><span className="pl-matchup truncate text-lg leading-none">{r.t.name}</span>
                        </Link>
                      </td>
                      <td className="p-2"><span className="flex items-center gap-2"><span className="tabular font-mono">{r.t.wins}-{r.t.losses}</span><FcsBadge n={r.t.fcs_games} /></span></td>
                      <td className="tabular p-2 text-right font-mono text-[15px] font-medium">{r.adj ? ord(r.adj) : "—"}</td>
                      <td className="tabular p-2 text-right font-mono text-xs text-muted-foreground">{r.raw ? ord(r.raw) : "—"}</td>
                      <td className="tabular py-2 pr-5 pl-2 text-right font-mono text-xs text-muted-foreground">{r.sos ? ord(r.sos) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t px-5 pt-3 pb-4 text-xs text-muted-foreground">Schedule: 1st = hardest of {of} · as played: the rank before the schedule is taken out</p>
            </section>

            {/* phone: the conference's teams, each with its two sides as bars */}
            <section aria-label={`${conf} teams`} className="pl-reading overflow-hidden rounded-2xl border md:hidden">
              <div className="px-4 pt-4 pb-2">
                <h2 className="pl-display text-[26px] leading-none">{conf}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Rank of {of} in net points per drive, schedule out</p>
              </div>
              {mine.map((r) => (
                <Link key={r.t.team} href={teamHref("ncaaf", r.t.team)} className="grid grid-cols-[30px_minmax(0,1fr)_46px] items-center gap-2.5 border-t border-[var(--reading-rule,var(--border))] px-4 py-2.5">
                  <Crest sport="ncaaf" team={r.t.team} name={r.t.name} size={28} />
                  <span className="grid min-w-0 gap-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="pl-matchup truncate text-[17px] leading-none">{r.t.name}</span>
                      <span className="tabular shrink-0 font-mono text-[11px] text-muted-foreground">{r.t.wins}-{r.t.losses}</span>
                      <FcsBadge n={r.t.fcs_games} small />
                    </span>
                    <span className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1 font-mono text-[9px] text-muted-foreground">
                      <span>Off</span><span aria-hidden className="relative h-1 rounded-full bg-[var(--viz-axis)]"><span className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${Math.round((r.t.offense ?? 0) * 100)}%` }} /></span>
                      <span>Def</span><span aria-hidden className="relative h-1 rounded-full bg-[var(--viz-axis)]"><span className="absolute inset-y-0 left-0 rounded-full bg-[var(--viz-pos)]" style={{ width: `${Math.round((r.t.defense ?? 0) * 100)}%` }} /></span>
                    </span>
                  </span>
                  <span className="tabular justify-self-end font-mono text-[15px] font-medium">{r.adj ? ord(r.adj) : "—"}</span>
                </Link>
              ))}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
