import 'server-only';
import { sql } from 'drizzle-orm';
import { ACCOUNTS } from '@/lib/site';
import { EVENT_ID, lineKey, textKey } from '@/lib/excerpt-keys';
import { SECTIONS, type OwnerManifest, type OwnerRecord, type Section } from '@/lib/owner-types';
import { getDb } from './db';
import { who } from './entitlement';
import { authentic, unseal, type Sealed } from './owner-crypto.mjs';

export const OWNER_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Referrer-Policy': 'no-referrer' };
export const ownerMissing = () => Response.json({ detail: 'Not found' }, { status: 404, headers: OWNER_HEADERS });
const configured = () => ACCOUNTS && Boolean(process.env.OWNER_EMAIL?.trim()) && /^[a-f0-9]{64}$/i.test(process.env.OWNER_SYNC_SECRET ?? '');
type Result = { rows: Record<string, unknown>[] };
type Snapshot = { user_id: string; generation: string; manifest: string };
async function snapshot(): Promise<Snapshot | undefined> {
  const result = await (await getDb()).execute(sql`select user_id, generation, manifest from owner_snapshot where slot = 'current'`) as Result;
  return result.rows[0] as Snapshot | undefined;
}
/** A separate owner check: invitations to ordinary PickLab never grant access here. */
export async function ownerAccess(headers: Headers): Promise<boolean> {
  if (!configured()) return false;
  const me = (await who(headers)).user;
  if (!me || me.email.toLowerCase() !== process.env.OWNER_EMAIL!.trim().toLowerCase()) return false;
  const saved = await snapshot();
  return !saved || saved.user_id === me.id;
}
export async function ownerManifest(headers: Headers): Promise<OwnerManifest | null> {
  if (!(await ownerAccess(headers))) return null;
  const saved = await snapshot();
  return saved ? JSON.parse(saved.manifest) as OwnerManifest : null;
}
export async function ownerData(req: Request): Promise<Response> {
  if (!(await ownerAccess(req.headers))) return ownerMissing();
  const saved = await snapshot();
  if (!saved) return Response.json({ ready: false }, { headers: OWNER_HEADERS });
  const manifest = JSON.parse(saved.manifest) as OwnerManifest;
  const q = new URL(req.url).searchParams, section = q.get('section') ?? 'research';
  if (!SECTIONS.includes(section as Section)) return ownerMissing();
  const page = Math.max(0, Math.min(100_000, Number(q.get('page')) || 0)) | 0;
  const search = (q.get('q') ?? '').trim().toLowerCase().slice(0, 200), sport = q.get('sport'), source = q.get('source');
  const records: OwnerRecord[] = [];
  const db = await getDb();
  const chunks = await db.execute(sql`select part, payload from owner_chunk where generation = ${saved.generation} and user_id = ${saved.user_id} and part like ${section + '-%'}`) as Result;
  const byPart = new Map(chunks.rows.map(r => { const c = r as { part: string; payload: string }; return [c.part, c.payload]; }));
  for (const part of manifest.sections[section as Section].parts) {
    const payload = byPart.get(part);
    if (!payload) throw new Error('Owner snapshot is incomplete');
    const chunk = unseal(JSON.parse(payload) as Sealed, `${saved.generation}:${part}`, process.env.OWNER_SYNC_SECRET!) as OwnerRecord[];
    for (const row of chunk) {
      if (sport && row.sport !== sport || source && row.source !== source) continue;
      if (search && !JSON.stringify(row).toLowerCase().includes(search)) continue;
      records.push(row);
    }
  }
  // Model reports vary greatly in size. Keep every response below the hosting payload limit.
  const pages: OwnerRecord[][] = [];
  let batch: OwnerRecord[] = [], size = 2;
  for (const row of records) {
    const bytes = Buffer.byteLength(JSON.stringify(row)) + 1;
    if (batch.length && (batch.length >= 30 || size + bytes > 2_500_000)) { pages.push(batch); batch = []; size = 2; }
    batch.push(row); size += bytes;
  }
  if (batch.length) pages.push(batch);
  return Response.json({ records: pages[page] ?? [], total: records.length, page, pages: pages.length, updated: manifest.updated }, { headers: OWNER_HEADERS });
}

const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi, (m, e: string) => {
  const k = e.toLowerCase();
  if (k[0] === '#') { const n = k[1] === 'x' ? parseInt(k.slice(2), 16) : Number(k.slice(1)); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[k] ?? m;
});
/** Paragraphs from an excerpt field: a string split on blank lines, a list of strings, or quote objects. */
const paragraphs = (v: unknown): string[] => {
  if (typeof v === 'string') return v.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(paragraphs);
  if (v && typeof v === 'object') { const o = v as Record<string, unknown>; return paragraphs(o.text ?? o.quote ?? o.paragraph ?? o.content); }
  return [];
};
export type OwnerExcerpt = { url: string; site: string; author: string | null; k: string | null; tk: string; paras: string[]; quotes: string[] };
/** The analysts' own reasoning for the requested games, read from the research section newest first. */
export async function ownerExcerpts(req: Request): Promise<Response> {
  if (!(await ownerAccess(req.headers))) return ownerMissing();
  const wanted = new Set((new URL(req.url).searchParams.get('events') ?? '').split(',').map(s => s.trim()).filter(s => EVENT_ID.test(s)).slice(0, 40));
  const events: Record<string, OwnerExcerpt[]> = {};
  const saved = wanted.size ? await snapshot() : undefined;
  if (!saved) return Response.json({ events }, { headers: OWNER_HEADERS });
  const manifest = JSON.parse(saved.manifest) as OwnerManifest;
  const parts = manifest.sections.research.parts.slice(0, 12), cutoff = new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10);
  const db = await getDb();
  read: for (let i = 0; i < parts.length; i += 3) {
    const batch = parts.slice(i, i + 3);
    const rows = await db.execute(sql`select part, payload from owner_chunk where generation = ${saved.generation} and user_id = ${saved.user_id} and part in (${sql.join(batch.map(p => sql`${p}`), sql`, `)})`) as Result;
    const byPart = new Map(rows.rows.map(r => { const c = r as { part: string; payload: string }; return [c.part, c.payload]; }));
    for (const part of batch) {
      const payload = byPart.get(part);
      if (!payload) throw new Error('Owner snapshot is incomplete');
      const chunk = unseal(JSON.parse(payload) as Sealed, `${saved.generation}:${part}`, process.env.OWNER_SYNC_SECRET!) as OwnerRecord[];
      for (const row of chunk) {
        const d = row.data ?? {}, id = d.event_id;
        if (row.kind !== 'feedpick' || typeof id !== 'string' || !wanted.has(id) || typeof d.article_url !== 'string') continue;
        const paras = paragraphs(d.reasoning), quotes = paragraphs(d.quotes);
        if (!paras.length && !quotes.length) continue;
        const article = (d.article && typeof d.article === 'object' ? d.article : {}) as Record<string, unknown>;
        const author = [d.author, article.author].find((v): v is string => typeof v === 'string' && v.trim() !== '') ?? null;
        const draft = d.draft && typeof d.draft === 'object' ? d.draft as Parameters<typeof lineKey>[0] : null;
        (events[id] ??= []).push({ url: d.article_url, site: row.source, author, k: lineKey(draft), tk: textKey(decode(typeof d.text === 'string' ? d.text : '')), paras, quotes });
      }
      const last = chunk.at(-1)?.date?.slice(0, 10) ?? '';
      if (last && last < cutoff) break read;
    }
  }
  return Response.json({ events }, { headers: OWNER_HEADERS });
}

/** The Mac can only replace encrypted snapshots; it receives no session or account-management powers. */
export async function ownerSync(req: Request): Promise<Response> {
  if (!configured()) return ownerMissing();
  const bytes = Number(req.headers.get('content-length'));
  if (bytes > 3_000_000) return new Response(null, { status: 413, headers: OWNER_HEADERS });
  const body = await req.text();
  if (Buffer.byteLength(body) > 3_000_000) return new Response(null, { status: 413, headers: OWNER_HEADERS });
  const secret = process.env.OWNER_SYNC_SECRET!;
  if (!authentic(body, req.headers.get('x-owner-timestamp'), req.headers.get('x-owner-signature'), secret)) return ownerMissing();
  let input: { generation: string; part?: string; payload?: Sealed; manifest?: OwnerManifest };
  try { input = JSON.parse(body); } catch { return new Response(null, { status: 400, headers: OWNER_HEADERS }); }
  if (!/^[a-f0-9]{32}$/.test(input.generation ?? '')) return new Response(null, { status: 400, headers: OWNER_HEADERS });
  const db = await getDb();
  const users = await db.execute(sql`select id from "user" where lower(email) = ${process.env.OWNER_EMAIL!.trim().toLowerCase()}`);
  const userId = ((users as Result).rows[0] as { id: string } | undefined)?.id;
  if (!userId) return ownerMissing();
  const saved = await snapshot();
  // Existing data is bound to the original account's id. A new account using an old address cannot claim it.
  if (saved && saved.user_id !== userId) return ownerMissing();
  if (input.part && input.payload) {
    if (!/^(research|models|ledger|strategies|analysis)-\d{5}$/.test(input.part)) return new Response(null, { status: 400, headers: OWNER_HEADERS });
    try {
      const value = unseal(input.payload, `${input.generation}:${input.part}`, secret);
      if (!Array.isArray(value) || value.length > 1000 || !value.every(x => x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.data === 'object')) throw new Error('Invalid chunk');
    } catch { return new Response(null, { status: 400, headers: OWNER_HEADERS }); }
    await db.execute(sql`insert into owner_chunk (generation, part, user_id, payload) values (${input.generation}, ${input.part}, ${userId}, ${JSON.stringify(input.payload)}) on conflict (generation, part) do update set payload = excluded.payload where owner_chunk.user_id = excluded.user_id`);
  } else if (input.manifest) {
    const m = input.manifest;
    if (m.version !== 1 || m.generation !== input.generation || !Number.isFinite(Date.parse(m.updated))) return new Response(null, { status: 400, headers: OWNER_HEADERS });
    const uploaded = await db.execute(sql`select part, payload from owner_chunk where generation = ${m.generation} and user_id = ${userId}`) as Result;
    const byPart = new Map(uploaded.rows.map(r => { const c = r as { part: string; payload: string }; return [c.part, c.payload]; }));
    for (const section of SECTIONS) {
      const s = m.sections?.[section];
      if (!s || !Number.isSafeInteger(s.count) || s.count < 0 || !Array.isArray(s.parts) || s.parts.length > 2000 || new Set(s.parts).size !== s.parts.length || s.parts.some(p => !new RegExp(`^${section}-\\d{5}$`).test(p))) return new Response(null, { status: 400, headers: OWNER_HEADERS });
      let count = 0;
      for (const part of s.parts) {
        const payload = byPart.get(part);
        if (!payload) return new Response(null, { status: 409, headers: OWNER_HEADERS });
        count += (unseal(JSON.parse(payload), `${m.generation}:${part}`, secret) as unknown[]).length;
      }
      if (count !== s.count) return new Response(null, { status: 409, headers: OWNER_HEADERS });
    }
    await db.execute(sql`insert into owner_snapshot (slot, user_id, generation, manifest) values ('current', ${userId}, ${m.generation}, ${JSON.stringify(m)}) on conflict (slot) do update set generation = excluded.generation, manifest = excluded.manifest, updated_at = now() where owner_snapshot.user_id = excluded.user_id`);
    // Retain recent snapshots for in-flight readers; remove abandoned uploads after that grace period.
    await db.execute(sql`delete from owner_chunk where generation <> ${m.generation} and created_at < now() - interval '15 minutes'`);
  } else return new Response(null, { status: 400, headers: OWNER_HEADERS });
  return Response.json({ ok: true }, { headers: OWNER_HEADERS });
}
