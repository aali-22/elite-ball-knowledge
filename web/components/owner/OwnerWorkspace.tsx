'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- A new document restores the public page security policy. */

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, FlaskConical, Layers3, LockKeyhole, Search, Wallet, BookOpen, Activity } from 'lucide-react';
import type { OwnerManifest, OwnerPage, OwnerRecord, Section } from '@/lib/owner-types';

const TABS: { id: Section; label: string; note: string; icon: typeof BookOpen }[] = [
  { id: 'research', label: 'Research', note: 'Every source. The argument behind each pick.', icon: BookOpen },
  { id: 'models', label: 'Models & captures', note: 'Captured projections, matchups, and saved model reports. Model outputs are inference.', icon: Layers3 },
  { id: 'ledger', label: 'Ledger', note: 'Your tickets, evidence, and account adjustments.', icon: Wallet },
  { id: 'strategies', label: 'Strategy lab', note: 'Your rules and their paper record.', icon: FlaskConical },
  { id: 'analysis', label: 'Saved analysis', note: 'Saved AI briefs and board reasoning. AI analysis is inference.', icon: Activity },
];
const LABEL: Record<string, string> = { sportsline: 'SportsLine', forebet: 'Forebet', feedpick: 'Expert pick', sourcegame: 'Extension capture', tacticalreportrow: 'Tactical board', bookbetrow: 'Ticket', strategyrow: 'Strategy', strategypickrow: 'Paper pick', aibrief: 'AI analysis: inference', soccerprediction: 'Match preview', boardreasoningrow: 'Board reasoning', teamsynthesisrow: 'Team analysis', ledgerevidencerow: 'Account evidence', ledgeradjustmentrow: 'Adjustment', pickrow: 'Tracked pick', parlayrow: 'Tracked parlay', feedgrade: 'Graded result', expert: 'Analyst profile', mlbsnapshot: 'Saved MLB model', candidatesetrow: 'Candidate board', strategyrunrow: 'Strategy run' };
const label = (s: string) => LABEL[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase());
const date = (s: string) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
const fmt = (v: unknown) => v === null || v === undefined ? '—' : typeof v === 'number' ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(v) : String(v);
const QUIET = 'pl-label inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-[10px] hover:bg-muted disabled:opacity-40';
const HIDDEN = new Set(['parse_text', 'payload', 'payload_hash', 'error', 'attempts', 'ai_attempts']);

/** Structured source values stay structured: numbers, comparisons, paragraphs, and expandable evidence. */
function Evidence({ value, name = '' }: { value: unknown; name?: string }) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return <span className="text-sm">{value ? 'Yes' : 'No'}</span>;
  if (typeof value !== 'object') {
    const text = fmt(value);
    if (/^https?:\/\//i.test(text)) return <a href={text} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-sm text-[var(--hot)] underline underline-offset-4">Open source <ArrowUpRight className="size-3 shrink-0" /></a>;
    return <p className={`${text.length < 50 && typeof value === 'number' ? 'font-mono text-xl tabular-nums' : 'whitespace-pre-wrap text-sm leading-relaxed'} break-words`}>{text}</p>;
  }
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-xs text-muted-foreground">None recorded</span>;
    if (value.every(v => typeof v === 'string')) return <div className="grid gap-3">{value.map((v, i) => <Evidence value={v} key={i} />)}</div>;
    const flat = value.every(v => v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => x === null || typeof x !== 'object'));
    if (flat) {
      const keys = [...new Set(value.flatMap(v => Object.keys(v)))].filter(k => !HIDDEN.has(k));
      return <div className="max-w-full overflow-x-auto rounded-xl border"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr>{keys.map(k => <th className="whitespace-nowrap px-3 py-3 font-medium" key={k}>{label(k)}</th>)}</tr></thead><tbody>{value.map((v, i) => <tr className="border-t" key={i}>{keys.map(k => <td className="max-w-96 px-3 py-3 align-top" key={k}><Evidence value={v[k]} /></td>)}</tr>)}</tbody></table></div>;
    }
    return <div className="grid gap-2">{value.map((v, i) => <details key={i} className="rounded-xl border bg-background p-3"><summary className="cursor-pointer text-sm">{typeof v === 'object' && v ? String(v.label ?? v.title ?? v.name ?? v.player_name ?? v.market ?? `${label(name)} ${i + 1}`) : `${label(name)} ${i + 1}`}</summary><div className="pt-4"><Evidence value={v} /></div></details>)}</div>;
  }
  return <div className="grid min-w-0 gap-4">{Object.entries(value as Record<string, unknown>).filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== '').map(([k, v]) => {
    const complex = v && typeof v === 'object';
    return complex ? <details key={k} className="min-w-0 rounded-xl border p-4" open={['reasoning', 'quotes', 'draft', 'candidate', 'brief', 'expert_picks', 'model_picks', 'simulation'].includes(k)}><summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">{label(k)}<span className="pl-label text-[9px] text-muted-foreground">{Array.isArray(v) ? v.length : ''}<ChevronDown className="ml-2 inline size-3" /></span></summary><div className="pt-4"><Evidence value={v} name={k} /></div></details>
      : <div key={k} className="grid min-w-0 gap-1 sm:grid-cols-[10rem_1fr]"><span className="pl-label pt-1 text-[10px] text-muted-foreground">{label(k)}</span><Evidence value={v} name={k} /></div>;
  })}</div>;
}

function RecordCard({ row, open }: { row: OwnerRecord; open: () => void }) {
  const d = row.data, excerpts = d.reasoning ?? d.quotes;
  const quote = typeof excerpts === 'string' ? excerpts : Array.isArray(excerpts) ? excerpts.find(x => typeof x === 'string') : null;
  return <button onClick={open} className="group grid w-full min-w-0 gap-3 rounded-2xl border bg-card p-5 text-left transition-colors hover:border-[var(--hot)] sm:p-6">
    <div className="pl-label flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground"><span className="text-[var(--hot)]">{label(row.source || row.kind)}</span><span>·</span><span>{row.sport || label(row.kind)}</span><ArrowUpRight className="ml-auto size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
    <h3 className="line-clamp-3 font-medium leading-snug [overflow-wrap:anywhere]">{row.title}</h3>
    {row.kind === 'bookbetrow' ? <div className="flex gap-6 py-2">{['stake', 'paid', 'odds'].map(k => d[k] !== undefined && <div key={k}><p className="pl-label text-[8px] text-muted-foreground">{k === 'paid' ? 'Returned' : label(k)}</p><p className="font-mono text-xl">{fmt(d[k])}</p></div>)}</div>
      : quote ? <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{quote}</p> : <p className="text-xs text-muted-foreground">{label(row.kind)} · Open the complete record</p>}
    <span className="mt-auto border-t pt-3 text-[10px] text-muted-foreground">{date(row.date)}</span>
  </button>;
}

export function OwnerWorkspace({ manifest }: { manifest: OwnerManifest | null }) {
  const [section, setSection] = useState<Section>('research'), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [sport, setSport] = useState(''), [source, setSource] = useState(''), [page, setPage] = useState(0);
  const [result, setResult] = useState<OwnerPage | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState<OwnerRecord | null>(null);
  useEffect(() => { const timer = setTimeout(() => { setSearch(query); setPage(0); }, 300); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (!manifest) return;
    const controller = new AbortController();
    setBusy(true); setError('');
    const q = new URLSearchParams({ section, q: search, sport, source, page: String(page) });
    fetch(`/api/owner/data?${q}`, { cache: 'no-store', signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error(r.status === 404 ? 'Your session ended. Sign in again to continue.' : 'Your records could not be loaded. Try again.');
      setResult(await r.json());
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [manifest, section, search, sport, source, page]);
  useEffect(() => {
    if (!selected) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', close);
    const before = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', close); document.body.style.overflow = before; };
  }, [selected]);
  const current = TABS.find(t => t.id === section)!;
  const choose = (s: Section) => { setSection(s); setPage(0); setSport(''); setSource(''); setQuery(''); setSearch(''); setResult(null); };
  const stats = manifest?.sections[section];
  return <main className="mx-auto min-h-dvh max-w-[1600px] px-4 pb-12 sm:px-8">
    <header className="flex min-h-20 items-center justify-between gap-3 border-b"><a href="/account" className="pl-label inline-flex min-h-11 items-center gap-2 text-[10px]"><ArrowLeft className="size-4" />Account</a><span className="pl-label flex items-center gap-2 text-[9px] text-muted-foreground"><LockKeyhole className="size-3.5 text-[var(--hot)]" />Only your account</span></header>
    <div className="grid gap-5 pb-10 pt-10 sm:grid-cols-[1fr_auto] sm:items-end sm:pt-14"><div><p className="pl-label mb-3 text-[10px] text-[var(--hot)]">PickLab · Your private workspace</p><h1 className="pl-display text-6xl sm:text-8xl">The whole picture.</h1></div><p className="max-w-64 text-xs leading-relaxed text-muted-foreground">{manifest ? <>Last synced<br /><span className="text-foreground">{date(manifest.updated)}</span></> : 'Your first sync is being prepared.'}<br />Extension captures stay connected to your Mac.</p></div>
    <nav aria-label="Private workspace sections" className="mb-8 grid grid-cols-2 gap-2 lg:grid-cols-5">{TABS.map(t => <button key={t.id} onClick={() => choose(t.id)} aria-pressed={section === t.id} className={`flex min-h-24 flex-col items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-colors ${section === t.id ? 'border-[var(--hot)] bg-[var(--hot)] text-[var(--hot-ink)]' : 'bg-card hover:bg-muted'}`}><span className="flex w-full items-center justify-between"><t.icon className="size-4" /><span className="font-mono text-lg">{manifest?.sections[t.id].count.toLocaleString() ?? '—'}</span></span><span className="pl-label text-[10px]">{t.label}</span></button>)}</nav>
    {!manifest ? <div className="rounded-2xl border bg-card p-8"><h2 className="pl-display text-3xl">Ready for your records.</h2><p className="mt-3 text-sm text-muted-foreground">This area opens only for your account. Your Mac will send the first encrypted snapshot here.</p></div> : <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-5"><div><h2 className="pl-display text-4xl">{current.label}</h2><p className="mt-2 text-sm text-muted-foreground">{current.note}</p></div><p className="pl-label text-[9px] text-muted-foreground">{result?.total.toLocaleString() ?? stats?.count.toLocaleString()} records</p></div>
      <div className="mb-6 grid gap-3 rounded-2xl border bg-card p-3 md:grid-cols-[1fr_12rem_14rem]"><label className="flex min-h-11 items-center gap-3 px-2"><Search className="size-4 shrink-0 text-muted-foreground" /><input aria-label="Search your records" placeholder="Search a team, analyst, ticket, or phrase" value={query} onChange={e => setQuery(e.target.value)} className="w-full min-w-0 bg-transparent text-sm outline-none" /></label><select aria-label="Sport" value={sport} onChange={e => { setSport(e.target.value); setPage(0); }} className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="">All sports</option>{Object.keys(stats?.sports ?? {}).filter(Boolean).sort().map(s => <option key={s} value={s}>{label(s)}</option>)}</select><select aria-label="Source or record type" value={source} onChange={e => { setSource(e.target.value); setPage(0); }} className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="">All sources & types</option>{Object.keys(stats?.sources ?? {}).filter(Boolean).sort().map(s => <option key={s} value={s}>{label(s)}</option>)}</select></div>
      {error && <p role="alert" className="mb-5 rounded-xl border p-5 text-sm text-[var(--hot)]">{error}</p>}
      {busy && !result && <p role="status" className="py-20 text-center text-sm text-muted-foreground">Opening your records…</p>}
      <div aria-busy={busy} className={`grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3 ${busy ? 'opacity-50' : ''}`}>{result?.records.map(row => <RecordCard key={`${row.kind}:${row.id}`} row={row} open={() => setSelected(row)} />)}</div>
      {result && !result.total && <p className="py-20 text-center text-sm text-muted-foreground">No records match these filters.</p>}
      {result && result.pages > 1 && <div className="mt-8 flex items-center justify-between gap-3"><button className={QUIET} disabled={page === 0 || busy} onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 350, behavior: 'smooth' }); }}><ChevronLeft className="size-4" />Previous</button><span className="pl-label text-[9px]">{page + 1} / {result.pages}</span><button className={QUIET} disabled={page + 1 >= result.pages || busy} onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 350, behavior: 'smooth' }); }}>Next<ChevronRight className="size-4" /></button></div>}
    </>}
    <footer className="pl-label mt-12 flex flex-wrap gap-3 border-t pt-5 text-[9px] text-muted-foreground"><LockKeyhole className="size-3" /><span>Private records · No visit tracking on this page</span><span className="ml-auto">Captured and computed on your Mac</span></footer>
    {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-3 backdrop-blur sm:p-8" role="dialog" aria-modal="true" aria-label={selected.title}><div className="mx-auto max-w-5xl rounded-3xl border bg-card p-5 sm:p-9"><div className="sticky top-0 z-10 -mx-2 mb-6 flex items-center justify-between gap-4 bg-card py-3"><span className="pl-label text-[9px] text-[var(--hot)]">{label(selected.source || selected.kind)} · {selected.sport}</span><button autoFocus onClick={() => setSelected(null)} className={QUIET}>Close · Esc</button></div><h2 className="mb-2 break-words text-2xl font-medium sm:text-3xl">{selected.title}</h2><p className="mb-8 text-xs text-muted-foreground">{date(selected.date)} · {label(selected.kind)}</p><Evidence value={selected.data} /></div></div>}
  </main>;
}
