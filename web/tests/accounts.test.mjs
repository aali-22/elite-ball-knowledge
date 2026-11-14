// Checks of accounts and the free / paid gate: `node --test tests/accounts.test.mjs` (from web/).
//
// Needs no provider account and no running server. It builds the site twice (accounts off, accounts on) into scratch
// folders, starts each on a scratch port with an in-memory database, and stands in for the two things the site talks
// to: the analytics API (one invented league) and Stripe (the handful of calls an upgrade makes). Every password,
// key and webhook secret is made up for the run. Webhook events are signed the way Stripe signs them.
//   ACCOUNTS_TEST_PORT=3027   the first of six ports it uses (never 3000 or 8000)
//   ACCOUNTS_TEST_REUSE=1     keep and reuse the two builds between runs
//   PLAYWRIGHT_MODULE, BROWSER_TEST_CHANNEL   as in site.test.mjs; without a browser the browser check is skipped
import { seal, unseal, signature, authentic } from '../lib/server/owner-crypto.mjs';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const NEXT = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const PORT = Number(process.env.ACCOUNTS_TEST_PORT) || 3027;
const REUSE = process.env.ACCOUNTS_TEST_REUSE === '1';
const DIST = { off: '.next-accounts-off', on: '.next-accounts-on' };
const FAKE = `http://127.0.0.1:${PORT + 3}`;
const rand = (n = 12) => randomBytes(n).toString('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- made up for this run ---------------------------------------------------------------------------------------------
const stripeKey = `sk_test_${rand(24)}`, hookKey = `whsec_${rand(24)}`, priceId = `price_${rand(8)}`;
const customerId = `cus_${rand(8)}`, paidId = `sub_${rand(8)}`, sessionId = `cs_test_${rand(8)}`;
const now = Math.floor(Date.now() / 1000);

// ---- the stand-in for the API and for Stripe --------------------------------------------------------------------------
const LEAGUE = {
  sport: 'nba', generated_at: new Date().toISOString(), of: 3, traits: [],
  teams: [
    { team: 'AAA', name: 'Alder, Ash & Co', wins: 7, losses: 2, draws: 0, offense: 0.9, defense: 0.7, traits: [], as_of: new Date().toISOString(), event_id: 'nba:1', carried: false },
    { team: 'BBB', name: 'Birch', wins: 4, losses: 5, draws: 0, offense: 0.4, defense: 0.5, traits: [], as_of: new Date().toISOString(), event_id: 'nba:2', carried: false },
    { team: 'CCC', name: '=Cedar', wins: 1, losses: 8, draws: 0, offense: 0.95, defense: 0.95, traits: [], as_of: new Date().toISOString(), event_id: 'nba:3', carried: true },
  ],
};
// PickLab by invitation: the one address the owner's list holds, and the key only the web server and the API share
const ownerEmail = `owner-${rand(4)}@example.test`, labKey = rand(24);
const labCalls = [];  // every request for a PickLab document the stand-in API saw: [path, whether it carried the key]
const stripeCalls = [];
let checkout = null;  // what the site sent when it asked Stripe for a Checkout page
const paidPlan = (status, extra = {}) => ({
  id: paidId, object: 'subscription', customer: customerId, status, cancel_at_period_end: false, cancel_at: null, canceled_at: null, ended_at: null,
  trial_start: null, trial_end: null, schedule: null, metadata: checkout?.metadata ?? {},
  items: { object: 'list', data: [{ id: `si_${rand(6)}`, quantity: 1, current_period_start: now, current_period_end: now + 30 * 86400,
    price: { id: priceId, lookup_key: null, recurring: { interval: 'month', usage_type: 'licensed' } } }] },
  ...extra,
});
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const url = new URL(req.url, FAKE), form = new URLSearchParams(body);
    const send = (o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (url.pathname === '/public/analytics/league/nba') return send(LEAGUE);
    if (['/public/picks', '/public/records', '/public/strategies'].includes(url.pathname)) {
      const keyed = req.headers['x-picklab-key'] === labKey;
      labCalls.push([url.pathname, keyed]);
      if (!keyed) return send({ detail: 'Not found' }, 404);  // as the real API: nothing without the key
      return send(url.pathname === '/public/strategies' ? [] : url.pathname === '/public/records'
        ? { since: new Date().toISOString(), sites: [], experts: [{ label: 'Stand-in Analyst', picks: 12, won: 7, lost: 5, push: 0, priced: 12, units: 1.5, roi: 0.12 }], markets: [] }
        : { generated_at: new Date().toISOString(), since: new Date().toISOString(), games: [], sites: ['stand-in'] });
    }
    if (url.pathname.startsWith('/public/')) return send({ detail: 'not found' }, 404);
    stripeCalls.push(`${req.method} ${url.pathname}`);
    if (req.headers.authorization !== `Bearer ${stripeKey}`) return send({ error: { message: 'wrong key' } }, 401);
    if (url.pathname === '/v1/customers/search') return send({ object: 'search_result', data: [], has_more: false });
    if (url.pathname === '/v1/customers' && req.method === 'POST') return send({ id: customerId, object: 'customer', email: form.get('email'), metadata: {} });
    if (url.pathname === `/v1/customers/${customerId}`) return send({ id: customerId, object: 'customer', email: null, metadata: {} });
    if (url.pathname === '/v1/subscriptions' && req.method === 'GET') return send({ object: 'list', data: [], has_more: false });
    if (url.pathname === `/v1/prices/${priceId}`) return send({ id: priceId, object: 'price', recurring: { interval: 'month', usage_type: 'licensed' } });
    if (url.pathname === '/v1/checkout/sessions' && req.method === 'POST') {
      checkout = { mode: form.get('mode'), price: form.get('line_items[0][price]'), reference: form.get('client_reference_id'), success: form.get('success_url'),
        metadata: { userId: form.get('metadata[userId]'), subscriptionId: form.get('metadata[subscriptionId]'), referenceId: form.get('metadata[referenceId]') } };
      return send({ id: sessionId, object: 'checkout.session', url: `${FAKE}/pay/${sessionId}` });
    }
    if (url.pathname === `/v1/subscriptions/${paidId}`) return send(paidPlan('active'));
    if (url.pathname === '/v1/billing_portal/sessions' && req.method === 'POST') return send({ id: `bps_${rand(6)}`, object: 'billing_portal.session', url: `${FAKE}/portal` });
    send({ error: { message: `the stand-in has no ${req.method} ${url.pathname}`, type: 'invalid_request_error' } }, 404);
  });
});

// ---- builds and servers -----------------------------------------------------------------------------------------------
const CLEAN = { NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SITE_URL: '', DATABASE_URL: '', BETTER_AUTH_URL: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
  STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', STRIPE_PRICE_PRO: '', STRIPE_LIVE: '', STRIPE_API_BASE: '', PAYWALL: '', VERCEL: '',
  NEXT_PUBLIC_PICKLAB: '', PICKLAB_ALLOW_EMAILS: '', PICKLAB_KEY: '' };
function build(which) {
  if (REUSE && existsSync(`${WEB}/${DIST[which]}/BUILD_ID`)) return;
  const r = spawnSync(process.execPath, [NEXT, 'build'], { cwd: WEB, encoding: 'utf8',
    // API_BASE is set here too: the proxy for /api/public is fixed when the site is built
    env: { ...process.env, ...CLEAN, NEXT_DIST_DIR: DIST[which], API_BASE: FAKE, NEXT_PUBLIC_ACCOUNTS: which === 'on' ? '1' : '',
      NEXT_PUBLIC_PICKLAB: which === 'on' ? '1' : '' } });  // the site with accounts carries PickLab by invitation, as the public site does
  assert.equal(r.status, 0, `next build (accounts ${which}) failed:\n${(r.stdout + r.stderr).slice(-3000)}`);
}
const running = [];
/** `next start` for one of the builds; resolves once it answers. `site.log()` is everything it has printed. */
async function serve(which, port, env = {}) {
  let log = '';
  const child = spawn(process.execPath, [NEXT, 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: WEB, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...CLEAN, NEXT_DIST_DIR: DIST[which], API_BASE: FAKE, ACCOUNTS_DB_DIR: 'memory', BETTER_AUTH_SECRET: rand(32), ...env } });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  running.push(child);
  const stop = () => new Promise((r) => { if (child.exitCode !== null) return r(); child.once('exit', r); child.kill(); });  // the port is free again once this settles
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try { await fetch(`${base}/favicon.ico`); return { base, log: () => log, stop }; } catch { await sleep(250); }
  }
  throw new Error(`the site did not start on ${port}:\n${log}`);
}

/** One visitor: remembers the cookies the site sets and sends them back, as a browser would. */
function visitor(base) {
  const jar = new Map();
  const call = async (path, { method = 'GET', body, origin = base } = {}) => {
    const res = await fetch(base + path, { method, redirect: 'manual', body: body === undefined ? undefined : JSON.stringify(body),
      headers: { origin, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(body === undefined ? {} : { 'content-type': 'application/json' }) } });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';'), at = pair.indexOf('='), name = pair.slice(0, at), value = pair.slice(at + 1);
      if (!value || attrs.some((a) => /^\s*max-age=0/i.test(a))) jar.delete(name); else jar.set(name, value);
      call.cookies.push(c);
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json };
  };
  call.cookies = [];
  call.me = async () => (await call('/api/pro/me')).json;
  return call;
}
const person = () => ({ email: `reader-${rand(4)}@example.test`, password: randomBytes(12).toString('base64url') });
/** An event as Stripe would send it: the body signed with the webhook secret. */
async function stripeEvent(base, type, object, secret = hookKey) {
  const payload = JSON.stringify({ id: `evt_${rand(8)}`, object: 'event', api_version: '2025-01-27.acacia', created: now, livemode: false, type, data: { object } });
  const t = Math.floor(Date.now() / 1000), v1 = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return fetch(`${base}/api/auth/stripe/webhook`, { method: 'POST', body: payload, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` } });
}

let off, on;  // the two sites
const TSCONFIG = `${WEB}/tsconfig.json`, tsconfig = readFileSync(TSCONFIG, 'utf8');  // a build into a new folder adds that folder to it
before(async () => {
  await new Promise((r) => fake.listen(PORT + 3, '127.0.0.1', r));
  build('off'); build('on');
  if (readFileSync(TSCONFIG, 'utf8') !== tsconfig) writeFileSync(TSCONFIG, tsconfig);
  off = await serve('off', PORT);
  on = await serve('on', PORT + 1);
}, { timeout: 15 * 60_000 });
after(() => {
  for (const c of running) c.kill();
  fake.close();
  if (!REUSE) for (const d of Object.values(DIST)) rmSync(`${WEB}/${d}`, { recursive: true, force: true });
});

// ---- accounts off: the site as it was ---------------------------------------------------------------------------------
test('accounts off: no page, no handler, no link, no cookie', async () => {
  const get = visitor(off.base);
  for (const path of ['/account', '/account/reset', '/pricing', '/api/auth/get-session', '/api/auth/ok', '/api/pro/me', '/api/pro/export']) {
    assert.equal((await get(path)).status, 404, `${path} should not exist`);
  }
  assert.equal((await get('/api/auth/sign-up/email', { method: 'POST', body: person() })).status, 404);
  for (const path of ['/', '/games', '/privacy']) {
    const page = await get(path);
    assert.equal(page.status, 200, path);
    assert.doesNotMatch(page.text, /Sign in/, `${path} mentions signing in`);
    assert.doesNotMatch(page.text, /href="\/(account|pricing)"/, `${path} links to an accounts page`);
  }
  assert.match((await get('/privacy')).text, /no accounts, no cookies/);
  assert.match((await get('/sitemap.xml')).text, /\/privacy/);
  assert.doesNotMatch((await get('/sitemap.xml')).text, /\/pricing/);
  assert.deepEqual(get.cookies, [], 'a site without accounts set a cookie');
});

// ---- accounts on, paywall off: the beta -------------------------------------------------------------------------------
test('accounts on: the bar offers sign-in, the plans page says free during beta, and shared pages stay shared', async () => {
  const get = visitor(on.base);
  const home = await get('/');
  assert.equal(home.status, 200);
  assert.match(home.text, /href="\/account"/);
  assert.match(home.text, /Sign in/);
  const plans = await get('/pricing');
  assert.equal(plans.status, 200);
  assert.match(plans.text, /Free during beta/);
  assert.match((await get('/privacy')).text, /no account or cookie unless you choose to sign in/);
  assert.equal((await get('/account')).status, 200);
  assert.deepEqual(get.cookies, [], 'a page set a cookie before anyone signed in');
});

test('paywall off: every feature is open to everyone, and the export needs no cookie', async () => {
  const get = visitor(on.base);
  const me = await get('/api/pro/me');
  assert.deepEqual(me.json, { paywall: false, signedIn: false, email: null, plan: 'free', features: { 'export.csv': true }, billing: null, renews: null, ending: false });
  assert.equal(me.headers.get('cache-control'), 'private, no-store');
  const csv = await get('/api/pro/export?table=power&sport=nba');
  assert.equal(csv.status, 200);
  assert.equal(csv.headers.get('cache-control'), 'private, no-store');
  assert.match(csv.headers.get('content-type'), /^text\/csv/);
  assert.match(csv.headers.get('content-disposition'), /^attachment; filename="ebk-power-nba-\d{4}-\d\d-\d\d\.csv"$/);
  const rows = csv.text.trim().split('\r\n');
  assert.equal(rows[0], 'rank,team,name,wins,losses,draws,overall,offense,defense,last_season_numbers,as_of');
  assert.match(rows[1], /^1,AAA,"Alder, Ash & Co",7,2,0,80,90,70,false,/);   // a comma in a name is quoted
  assert.match(rows[2], /^2,BBB,Birch,4,5,0,45,40,50,false,/);
  assert.match(rows[3], /^,CCC,'=Cedar,1,8,0,95,95,95,true,/);               // last season's team: unranked, last; a formula made plain text
  assert.equal((await get('/api/pro/export?table=power&sport=mlb')).status, 404);
  assert.equal((await get('/api/pro/export?table=nope')).status, 404);
});

test('sign-up, sign-out, sign-in, and a password reset whose link goes to the local log only', async () => {
  const get = visitor(on.base), who = person();
  let r = await get('/api/auth/sign-up/email', { method: 'POST', body: { ...who, name: 'Reader' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  const cookie = get.cookies.find((c) => /session_token=/.test(c));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.deepEqual((({ signedIn, email, plan }) => ({ signedIn, email, plan }))(await get.me()), { signedIn: true, email: who.email, plan: 'free' });
  assert.match((await get('/account')).text, new RegExp(who.email.replace('.', '\\.')));

  assert.equal((await get('/api/auth/sign-out', { method: 'POST', body: {} })).status, 200);
  assert.equal((await get.me()).signedIn, false);
  assert.equal((await get('/api/auth/sign-in/email', { method: 'POST', body: { email: who.email, password: `${who.password}x` } })).status, 401);
  // a page on another site can't sign anyone in here
  assert.equal((await get('/api/auth/sign-in/email', { method: 'POST', body: who, origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await get.me()).signedIn, false);

  r = await get('/api/auth/request-password-reset', { method: 'POST', body: { email: who.email, redirectTo: '/account/reset' } });
  assert.equal(r.status, 200, r.text);
  let link;
  for (let i = 0; i < 40 && !link; i++) { link = on.log().match(/password reset link for \S+: (\S+)/)?.[1]; if (!link) await sleep(100); }
  assert.ok(link, 'no reset link in the local log');
  const landing = await fetch(link, { redirect: 'manual' });
  const resetKey = new URL(landing.headers.get('location'), on.base).searchParams.get('token');
  assert.ok(resetKey, 'the reset link did not lead to /account/reset with its key');
  const fresh = randomBytes(12).toString('base64url');
  r = await get('/api/auth/reset-password', { method: 'POST', body: { newPassword: fresh, token: resetKey } });
  assert.equal(r.status, 200, r.text);
  assert.equal((await get('/api/auth/sign-in/email', { method: 'POST', body: { email: who.email, password: fresh } })).status, 200);
  assert.equal((await get.me()).signedIn, true);
});

test('in a browser: making an account from the form, on a phone, under the site security policy', async (t) => {
  let chromium;
  try { ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')); } catch { return t.skip('no browser driver (set PLAYWRIGHT_MODULE)'); }
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_TEST_CHANNEL || undefined });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [], hosts = new Set(), posts = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    page.on('request', (q) => { const u = new URL(q.url()); if (u.origin !== on.base) hosts.add(u.host); if (q.method() === 'POST') posts.push(`${q.resourceType()} ${u.pathname}`); });
    const who = person();
    await page.goto(`${on.base}/account`, { waitUntil: 'networkidle' });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(await overflow(), 0, 'the sign-in page scrolls sideways at 390px');
    assert.equal(await page.getByRole('link', { name: 'Sign in' }).count(), 1);
    await page.getByText('Create account', { exact: true }).first().click();
    await page.locator('input[type="email"]').fill(who.email);
    await page.locator('input[type="password"]').fill(who.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByText(who.email).waitFor();
    await page.getByText('Free during beta').first().waitFor();
    await page.getByRole('link', { name: 'Account' }).waitFor();   // the bar has heard
    assert.equal(await overflow(), 0, 'the account page scrolls sideways at 390px');
    assert.ok(await page.locator('a[download]').count() >= 2, 'no export links on the account page');
    assert.deepEqual(posts, ['fetch /api/auth/sign-up/email'], 'signing up is one fetch, never a form post');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(`${on.base}/`);
    assert.deepEqual(errors, []);
    assert.deepEqual([...hosts].filter((h) => !['a.espncdn.com', 'images.fotmob.com'].includes(h)), [], 'the page reached another host');
    await context.close();
  } finally { await browser.close(); }
});

// ---- accounts on, paywall on: plans matter ----------------------------------------------------------------------------
test('paywall on: signed fixture events from Stripe move an account to Pro and back, and the export follows the plan', async (t) => {
  await on.stop();
  const paid = await serve('on', PORT + 2, { PAYWALL: 'on', STRIPE_SECRET_KEY: stripeKey, STRIPE_WEBHOOK_SECRET: hookKey, STRIPE_PRICE_PRO: priceId, STRIPE_API_BASE: FAKE });
  t.after(() => paid.stop());
  const get = visitor(paid.base), who = person(), file = '/api/pro/export?table=power&sport=nba';
  const plan = async () => (await get.me()).plan;

  // nobody: refused, told to sign in
  let r = await get(file);
  assert.equal(r.status, 401);
  assert.deepEqual(r.json, { error: 'sign_in', feature: 'export.csv' });
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.equal((await get.me()).features['export.csv'], false);
  assert.match((await get('/pricing')).text, /Price to be announced/);

  // a free account: refused, told to upgrade
  assert.equal((await get('/api/auth/sign-up/email', { method: 'POST', body: { ...who, name: 'Reader' } })).status, 200);
  const me = await get.me();
  assert.deepEqual([me.paywall, me.signedIn, me.plan, me.billing, me.features['export.csv']], [true, true, 'free', 'test', false]);
  r = await get(file);
  assert.equal(r.status, 403);
  assert.deepEqual(r.json, { error: 'upgrade', feature: 'export.csv' });

  // upgrading sends the browser to Stripe's hosted Checkout; nothing is paid yet, so nothing is unlocked
  r = await get('/api/auth/subscription/upgrade', { method: 'POST', body: { plan: 'pro', successUrl: '/account', cancelUrl: '/pricing', disableRedirect: true } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.url, `${FAKE}/pay/${sessionId}`);
  assert.deepEqual([checkout.mode, checkout.price], ['subscription', priceId]);
  assert.equal(await plan(), 'free');
  assert.equal((await get(file)).status, 403);

  // an event with a bad signature, or signed with another secret, changes nothing
  const done = { id: sessionId, object: 'checkout.session', mode: 'subscription', subscription: paidId, client_reference_id: checkout.reference, metadata: checkout.metadata };
  assert.equal((await stripeEvent(paid.base, 'checkout.session.completed', done, `whsec_${rand(24)}`)).status, 400);
  assert.equal((await fetch(`${paid.base}/api/auth/stripe/webhook`, { method: 'POST', body: '{}' })).status, 400);
  assert.equal(await plan(), 'free');

  // paid: Pro
  assert.equal((await stripeEvent(paid.base, 'checkout.session.completed', done)).status, 200);
  const pro = await get.me();
  assert.deepEqual([pro.plan, pro.features['export.csv'], pro.ending], ['pro', true, false]);
  assert.ok(Date.parse(pro.renews) > Date.now());
  r = await get(file);
  assert.equal(r.status, 200);
  assert.match(r.text, /^rank,team,name/);
  // someone else, signed in and unpaid, is still refused
  const other = visitor(paid.base);
  assert.equal((await other('/api/auth/sign-up/email', { method: 'POST', body: { ...person(), name: 'Other' } })).status, 200);
  assert.equal((await other(file)).status, 403);
  // the Customer Portal is a redirect too
  r = await get('/api/auth/subscription/billing-portal', { method: 'POST', body: { returnUrl: '/account', disableRedirect: true } });
  assert.equal(r.json?.url, `${FAKE}/portal`, r.text);

  // a failed payment takes Pro away; a recovered one gives it back; a cancellation ends it
  assert.equal((await stripeEvent(paid.base, 'customer.subscription.updated', paidPlan('past_due'))).status, 200);
  assert.equal(await plan(), 'free');
  assert.equal((await get(file)).status, 403);
  assert.equal((await stripeEvent(paid.base, 'customer.subscription.updated', paidPlan('active', { cancel_at_period_end: true }))).status, 200);
  assert.deepEqual((({ plan: p, ending }) => [p, ending])(await get.me()), ['pro', true]);
  assert.equal((await get(file)).status, 200);
  assert.equal((await stripeEvent(paid.base, 'customer.subscription.deleted', paidPlan('canceled', { canceled_at: now, ended_at: now }))).status, 200);
  assert.equal(await plan(), 'free');
  assert.equal((await get(file)).status, 403);

  assert.ok(stripeCalls.includes('POST /v1/checkout/sessions') && stripeCalls.includes(`GET /v1/subscriptions/${paidId}`), `the stand-in saw: ${stripeCalls.join(', ')}`);
});

// ---- the two refusals that keep a mistake from costing anything ---------------------------------------------------------
test('a live Stripe key is refused, and a host without a database address does not start accounts', async (t) => {
  const live = await serve('on', PORT + 4, { STRIPE_SECRET_KEY: `sk_live_${rand(24)}`, STRIPE_WEBHOOK_SECRET: hookKey, STRIPE_PRICE_PRO: priceId });
  t.after(() => live.stop());
  assert.equal((await fetch(`${live.base}/api/auth/ok`)).status, 500);
  assert.match(live.log(), /not a test-mode key/);
  const hosted = await serve('on', PORT + 5, { VERCEL: '1' });
  t.after(() => hosted.stop());
  assert.equal((await fetch(`${hosted.base}/api/auth/ok`)).status, 500);
  assert.match(hosted.log(), /no DATABASE_URL on this host/);
  assert.equal((await fetch(`${hosted.base}/`)).status, 200, 'the rest of the site should still answer');
});

// ---- PickLab by invitation --------------------------------------------------------------------------------------------
const WORDS = /\b(bets?|betting|bettors?|gambl\w*|wager\w*|sportsbooks?|odds|parlays?|picks|units|21\+)\b/i;  // what the public face of PickLab never says
const seenText = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
const DATA = ['/api/public/picks', '/api/public/records', '/api/public/strategies'];
/** The site with accounts, PickLab by invitation, the owner's address on the list (written the way a person might
 *  type it into a settings page) and the key. Its own server: the shared one is stopped before these run. */
const invitation = (t) => serve('on', PORT + 1, { PICKLAB_ALLOW_EMAILS: ` ${ownerEmail.toUpperCase()} , someone-else@example.test`, PICKLAB_KEY: labKey })
  .then((site) => { t.after(() => site.stop()); return site; });

test('PickLab by invitation: a stranger sees one line and a waitlist, and its data does not exist for them', async (t) => {
  const lab = await invitation(t), get = visitor(lab.base);
  labCalls.length = 0;
  for (const path of ['/picklab', '/picklab/experts', '/picklab/strategies']) {
    const page = await get(path);
    assert.equal(page.status, 200, path);
    assert.match(page.text, /data-waitlist/, `${path} is not the waitlist page`);
    assert.match(seenText(page.text), /PickLab grades analysts\./);
    assert.doesNotMatch(seenText(page.text), WORDS, `${path} says more than its one line`);
    assert.doesNotMatch(page.text, WORDS, `${path} carries the wording in its markup or data`);
    assert.match(page.text, /<title>PickLab[^<]*<\/title>/);
    assert.match(page.text, /<meta name="description" content="PickLab grades analysts\."/);
    assert.match(page.text, /<meta name="robots" content="noindex, nofollow"/);
    assert.ok(!page.text.includes(labKey), 'the key reached a page');
  }
  for (const path of DATA) {
    const r = await get(path);
    assert.equal(r.status, 404, `${path} answered a stranger`);
    assert.equal(r.headers.get('cache-control'), 'private, no-store');
  }
  assert.deepEqual(labCalls, [], 'the API was asked for a PickLab document on behalf of a stranger');
  // the rest of the site links to the section and says nothing about it
  const home = await get('/');
  assert.match(home.text, /href="\/picklab"/);
  for (const path of ['/', '/games', '/sources', '/models']) assert.doesNotMatch(seenText((await get(path)).text), WORDS, `${path} uses the wording`);
  assert.doesNotMatch((await get('/sitemap.xml')).text, /picklab/);
  assert.match(seenText((await get('/privacy')).text), /The PickLab waitlist/);
  assert.deepEqual(get.cookies, [], 'the waitlist page set a cookie');
});

test('the waitlist takes an address once, tells nobody who is on it, and only the owner can read it', async (t) => {
  const lab = await invitation(t), get = visitor(lab.base), address = `Fan-${rand(4)}@Example.test`;
  labCalls.length = 0;
  const join = (body, extra = {}) => get('/api/pro/waitlist', { method: 'POST', body, ...extra });
  assert.equal((await join({ email: 'not an address' })).status, 400);
  assert.equal((await join({})).status, 400);  // nobody signed in and no address given
  let r = await join({ email: address });
  assert.deepEqual([r.status, r.json, r.headers.get('cache-control')], [200, { ok: true }, 'private, no-store']);
  assert.deepEqual((await join({ email: address.toLowerCase() })).json, { ok: true });  // the same answer the second time
  assert.equal((await join({ email: `bot-${rand(3)}@example.test`, website: 'http://spam.example' })).status, 200);  // a script filled the hidden field: accepted, not kept
  assert.equal((await join({ email: `x-${rand(3)}@example.test` }, { origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await get('/api/pro/waitlist')).status, 404);
  assert.equal((await get('/api/pro/waitlist?format=csv')).status, 404);

  // someone with an account who is not invited: still the waitlist, one press to join, and no data
  const reader = visitor(lab.base), who = person();
  assert.equal((await reader('/api/auth/sign-up/email', { method: 'POST', body: { ...who, name: 'Reader' } })).status, 200);
  let page = await reader('/picklab');
  assert.match(page.text, /data-waitlist/);
  assert.match(seenText(page.text).replace(/\s+/g, ' '), new RegExp(`signed in as ${who.email.replace(/\./g, '\\.')}`));
  for (const path of DATA) assert.equal((await reader(path)).status, 404);
  assert.match((await reader('/account')).text, /data-picklab-access="none"/);
  assert.deepEqual((await reader('/api/pro/waitlist', { method: 'POST', body: {} })).json, { ok: true });  // their own address
  assert.match((await reader('/account')).text, /data-picklab-access="listed"/);
  assert.match(seenText((await reader('/picklab')).text).replace(/\s+/g, ' '), /You(&#x27;|')re on the waitlist/);
  assert.equal((await reader('/api/pro/waitlist')).status, 404);
  assert.deepEqual(labCalls, []);

  // the owner: the account whose address is on the list
  const owner = visitor(lab.base), secret = randomBytes(12).toString('base64url');
  assert.equal((await owner('/api/auth/sign-up/email', { method: 'POST', body: { email: ownerEmail, password: secret, name: 'Owner' } })).status, 200);
  page = await owner('/picklab');
  assert.equal(page.status, 200);
  assert.doesNotMatch(page.text, /data-waitlist/);
  assert.match(page.text, /aria-label="PickLab"/);  // the section's own bar: the real pages
  assert.equal(page.headers.get('cache-control')?.includes('no-store') || page.headers.get('cache-control')?.includes('private'), true, 'a page drawn for one person may be stored');
  for (const path of DATA) {
    const d = await owner(path);
    assert.equal(d.status, 200, path);
    assert.equal(d.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal((await owner('/api/public/records?days=30')).json.experts[0].label, 'Stand-in Analyst');
  assert.ok(labCalls.length >= 4 && labCalls.every(([, keyed]) => keyed), 'the API was asked without the key');
  assert.match((await owner('/account')).text, /data-picklab-access="invited"/);
  const list = await owner('/api/pro/waitlist');
  assert.equal(list.status, 200);
  assert.deepEqual(list.json.people.map((p) => p.email).sort(), [address.toLowerCase(), who.email].sort());
  const csv = await owner('/api/pro/waitlist?format=csv');
  assert.match(csv.headers.get('content-type'), /^text\/csv/);
  assert.equal(csv.text.trim().split('\r\n').length, 3);
  for (const path of ['/picklab', '/account']) assert.ok(!(await owner(path)).text.includes(labKey), 'the key reached the browser');
  // signed out again, the owner is a stranger
  assert.equal((await owner('/api/auth/sign-out', { method: 'POST', body: {} })).status, 200);
  assert.match((await owner('/picklab')).text, /data-waitlist/);
  assert.equal((await owner('/api/public/picks')).status, 404);
});

test('with no list set, an account is never let in, whatever its address', async () => {
  const bare = await serve('on', PORT + 4, { PICKLAB_KEY: labKey });  // PICKLAB_ALLOW_EMAILS not set
  try {
    const get = visitor(bare.base);
    assert.equal((await get('/api/auth/sign-up/email', { method: 'POST', body: { email: ownerEmail, password: randomBytes(12).toString('base64url'), name: 'Owner' } })).status, 200);
    assert.match((await get('/picklab')).text, /data-waitlist/);
    assert.equal((await get('/api/public/picks')).status, 404);
  } finally { await bare.stop(); }
});

test('accounts off: there is no waitlist handler to post to', async () => {
  const get = visitor(off.base);
  assert.equal((await get('/api/pro/waitlist', { method: 'POST', body: { email: 'a@example.test' } })).status, 404);
  assert.equal((await get('/api/pro/waitlist')).status, 404);
});


test('owner mirror: only the bound account can read; incomplete uploads never replace active records', async (t) => {
  const syncSecret = rand(32);
  const site = await serve('on', PORT + 1, { OWNER_EMAIL: ownerEmail, OWNER_SYNC_SECRET: syncSecret, PICKLAB_ALLOW_EMAILS: `${ownerEmail},someone-else@example.test` });
  t.after(() => site.stop());
  const stranger = visitor(site.base), owner = visitor(site.base), invited = visitor(site.base);
  for (const [get, email] of [[owner, ownerEmail], [invited, 'someone-else@example.test']]) {
    assert.equal((await get('/api/auth/sign-up/email', { method: 'POST', body: { email, password: rand(16), name: 'Test reader' } })).status, 200);
  }
  const send = async input => {
    const body = JSON.stringify(input), timestamp = String(Date.now());
    return fetch(site.base + '/api/owner/sync', { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-owner-timestamp': timestamp, 'x-owner-signature': signature(body, timestamp, syncSecret) } });
  };
  for (const get of [stranger, invited]) {
    assert.equal((await get('/api/owner/data')).status, 404);
    assert.equal((await get('/account/workspace')).status, 404);
  }
  assert.equal((await fetch(site.base + '/api/owner/sync', { method: 'POST', body: '{}' })).status, 404);
  const generation = rand(16), part = 'research-00000', marker = rand(15);
  const rows = [{ id: 'test', title: marker, kind: 'feedpick', sport: 'nba', source: 'Test analyst', date: new Date().toISOString(), data: { quotes: ['An invented short excerpt.'] } }];
  const payload = seal(rows, `${generation}:${part}`, syncSecret);
  assert.ok(!JSON.stringify(payload).includes(marker));
  assert.deepEqual(unseal(payload, `${generation}:${part}`, syncSecret), rows);
  assert.throws(() => unseal(payload, `${generation}:wrong`, syncSecret));
  assert.throws(() => unseal(payload, `${generation}:${part}`, rand(32)));
  const timestamp = String(Date.now() - 600_000);
  assert.equal(authentic('{}', timestamp, signature('{}', timestamp, syncSecret), syncSecret), false);
  assert.equal((await send({ generation, part, payload })).status, 200);
  const sections = Object.fromEntries(['research','models','ledger','strategies','analysis'].map(s => [s, { count: s === 'research' ? 1 : 0, parts: s === 'research' ? [part] : [], sources: {}, sports: {} }]));
  const manifest = { version: 1, generation, updated: new Date().toISOString(), sections };
  assert.equal((await send({ generation, manifest })).status, 200);
  const data = await owner('/api/owner/data?section=research');
  assert.equal(data.status, 200);
  assert.equal(data.json.records[0].title, marker);
  assert.match(data.headers.get('cache-control'), /private.*no-store/);
  assert.equal((await owner('/api/owner/data?q=absent')).json.total, 0);
  const page = await owner('/account/workspace');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.doesNotMatch(page.headers.get('content-security-policy'), /google/);
  assert.match(page.headers.get('x-robots-tag'), /noindex/);
  assert.ok(!page.text.includes(marker), 'records must be fetched through the authenticated endpoint');
  const newer = rand(16), incomplete = { ...manifest, generation: newer };
  assert.equal((await send({ generation: newer, manifest: incomplete })).status, 409);
  assert.equal((await owner('/api/owner/data')).json.records[0].title, marker);
  for (const get of [stranger, invited]) assert.ok(!(await get('/api/owner/data')).text.includes(marker));
  await owner('/api/auth/sign-out', { method: 'POST', body: {} });
  assert.equal((await owner('/api/owner/data')).status, 404);
});
