// Checks of accounts and the free / paid gate: `node --test tests/accounts.test.mjs` (from web/).
//
// Needs no provider account and no running server. It builds the site twice (accounts off, accounts on) into scratch
// folders, starts each on a scratch port with an in-memory database, and stands in for the two things the site talks
// to: the analytics API (one invented league) and Stripe (the handful of calls an upgrade makes). Every password,
// key and webhook secret is made up for the run. Webhook events are signed the way Stripe signs them.
//   ACCOUNTS_TEST_PORT=3027   the first of six ports it uses (never 3000 or 8000)
//   ACCOUNTS_TEST_REUSE=1     keep and reuse the two builds between runs
//   PLAYWRIGHT_MODULE, BROWSER_TEST_CHANNEL   as in site.test.mjs; without a browser the browser check is skipped
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
  STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', STRIPE_PRICE_PRO: '', STRIPE_LIVE: '', STRIPE_API_BASE: '', PAYWALL: '', VERCEL: '' };
function build(which) {
  if (REUSE && existsSync(`${WEB}/${DIST[which]}/BUILD_ID`)) return;
  const r = spawnSync(process.execPath, [NEXT, 'build'], { cwd: WEB, encoding: 'utf8',
    // API_BASE is set here too: the proxy for /api/public is fixed when the site is built
    env: { ...process.env, ...CLEAN, NEXT_DIST_DIR: DIST[which], API_BASE: FAKE, NEXT_PUBLIC_ACCOUNTS: which === 'on' ? '1' : '' } });
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
