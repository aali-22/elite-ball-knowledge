// Browser checks of the public site against running servers (the API with a site database, the web app):
//   BROWSER_TEST_BASE=http://localhost:3000 node --test tests/site.test.mjs
// PLAYWRIGHT_MODULE and BROWSER_TEST_CHANNEL (e.g. "chrome" to use the installed browser) are optional.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.BROWSER_TEST_BASE || 'http://localhost:3000';
const MEDIA = ['a.espncdn.com', 'images.fotmob.com'];
let browser;
before(async () => { browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_TEST_CHANNEL || undefined }); });
after(async () => { await browser?.close(); });

async function open(path, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
  const page = await context.newPage();
  const errors = [], hosts = new Set();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('request', (r) => { const h = new URL(r.url()).host; if (h !== new URL(BASE).host) hosts.add(h); });
  await page.addInitScript(() => {
    window.__transitions = 0;
    const real = document.startViewTransition?.bind(document);
    if (real) document.startViewTransition = (cb) => { window.__transitions++; return real(cb); };
  });
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  return { context, page, errors, hosts, response };
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('home: slate, findings and league render with no script error and no unexpected host', async () => {
  const { context, page, errors, hosts, response } = await open('/');
  try {
    assert.equal(response.status(), 200);
    await page.getByRole('heading', { name: 'Elite Ball Knowledge' }).first().waitFor();
    assert.ok(await page.locator('a[href^="/game/"]').count() > 0, 'no games on the slate');
    await page.getByRole('heading', { name: 'The league, on one plot' }).scrollIntoViewIfNeeded();
    assert.deepEqual(errors, []);
    assert.deepEqual([...hosts].filter((h) => !MEDIA.includes(h)), [], 'the page reached a host that is not the site or a media host');
  } finally { await context.close(); }
});

test('security headers on the page itself', async () => {
  const { context, response } = await open('/games');
  try {
    const h = response.headers();
    assert.match(h['content-security-policy'], /default-src 'self'/);
    assert.match(h['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(h['x-frame-options'], 'DENY');
    assert.equal(h['x-content-type-options'], 'nosniff');
    assert.equal(h['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.ok(!('x-powered-by' in h));
  } finally { await context.close(); }
});

test('a game card opens its game through a view transition, and the crest keeps its name', async () => {
  const { context, page, errors } = await open('/games');
  try {
    const card = page.locator('a[href^="/game/"]').first();
    const href = await card.getAttribute('href');
    const names = await card.evaluate((a) => [...a.querySelectorAll('span')].map((e) => getComputedStyle(e).viewTransitionName).filter((n) => n && n !== 'none'));
    assert.equal(names.length, 2);
    await card.click();
    await page.waitForURL(`**${href}`);
    await page.getByRole('heading', { name: 'What decides it' }).waitFor();
    assert.equal(await page.evaluate(() => window.__transitions), 1);
    const head = await page.evaluate(() => [...document.querySelectorAll('h1 span')].map((e) => getComputedStyle(e).viewTransitionName).filter((n) => n && n !== 'none'));
    assert.deepEqual(head, names);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('reduce motion: no view transition, and everything is visible without scrolling into it', async () => {
  const { context, page, errors } = await open('/games', { reducedMotion: 'reduce' });
  try {
    const card = page.locator('a[href^="/game/"]').first();
    const href = await card.getAttribute('href');
    await card.click();
    await page.waitForURL(`**${href}`);
    await page.getByRole('heading', { name: 'What decides it' }).waitFor();
    assert.equal(await page.evaluate(() => window.__transitions), 0);
    await page.waitForTimeout(600);
    // every block that would rise in on scroll is already fully opaque and unmoved
    const hidden = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => {
      const s = getComputedStyle(e);
      return e.getBoundingClientRect().height > 0 && Number(s.opacity) < 0.99 && e.closest('ol[class]') === null && !e.matches('[aria-hidden="true"], [aria-hidden="true"] *, svg *, button[aria-pressed] *, button[aria-pressed]') && e.children.length > 0 && Number(s.opacity) < 0.3;
    }).length);
    assert.equal(hidden, 0, 'content is still faded out under reduce motion');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('search: the shortcut opens it, a query finds a team, Enter goes there', async () => {
  const { context, page, errors } = await open('/');
  try {
    await page.keyboard.press('ControlOrMeta+k');
    const box = page.getByRole('combobox').first();
    await box.waitFor();
    const team = await page.evaluate(async () => (await (await fetch('/api/public/analytics/index')).json()).teams[0]);
    await box.fill(team.full_name.slice(0, 5));
    await page.getByRole('option', { name: new RegExp(team.full_name) }).first().waitFor();
    await page.getByRole('option', { name: new RegExp(team.full_name) }).first().click();
    await page.waitForURL(/\/teams\//);
    await page.getByRole('heading', { name: team.name }).first().waitFor();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('compare: two teams from the address give a board', async () => {
  const { context, page, errors } = await open('/');
  try {
    const [a, b] = await page.evaluate(async () => (await (await fetch('/api/public/analytics/index')).json()).teams.filter((t) => t.sport === 'nba').slice(0, 2));
    await page.goto(`${BASE}/compare?sport=nba&a=${a.team}&b=${b.team}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Where it tilts' }).waitFor();
    await page.getByText('A what-if').first().waitFor();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const path of ['/', '/games', '/findings', '/league/nba', '/compare', '/models', '/picklab', '/privacy']) {
  test(`phone width: ${path} has no sideways scroll`, async () => {
    const { context, page, errors } = await open(path, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      assert.equal(await overflow(page), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test('phone width: a game page has no sideways scroll', async () => {
  const { context, page } = await open('/games', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const href = await page.locator('a[href^="/game/"]').first().getAttribute('href');
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'What decides it' }).waitFor();
    assert.equal(await overflow(page), 0);
  } finally { await context.close(); }
});

test('light theme renders', async () => {
  const { context, page, errors } = await open('/games', { colorScheme: 'light' });
  try {
    await page.evaluate(() => localStorage.setItem('picklab-theme', 'light'));
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.notEqual(bg, 'rgb(11, 11, 11)');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('an unknown address is a 404 with a way home', async () => {
  const { context, page, response } = await open('/no-such-page');
  try {
    assert.equal(response.status(), 404);
    await page.getByRole('link', { name: 'Home' }).waitFor();
  } finally { await context.close(); }
});

test('no AI control anywhere on the public pages', async () => {
  const { context, page } = await open('/games');
  try {
    const href = await page.locator('a[href^="/game/"]').first().getAttribute('href');
    for (const path of ['/', href, '/findings', '/picklab']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      assert.equal(await page.getByRole('button', { name: /analy[sz]e|deep analysis|AI /i }).count(), 0, `an AI control on ${path}`);
    }
  } finally { await context.close(); }
});
