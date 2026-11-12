// Browser checks of the public site against running servers (the API with a site database, the web app):
//   BROWSER_TEST_BASE=http://localhost:3000 node --test tests/site.test.mjs
// PLAYWRIGHT_MODULE and BROWSER_TEST_CHANNEL (e.g. "chrome" to use the installed browser) are optional.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.BROWSER_TEST_BASE || 'http://localhost:3000';
const MEDIA = ['a.espncdn.com', 'images.fotmob.com'];
// SITE_PICKLAB=0 checks a site run without PickLab (the analytics alone): its pages are 404s and nothing links to it.
const PICKLAB = process.env.SITE_PICKLAB !== '0';
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

for (const path of ['/', '/games', '/findings', '/league/nba', '/compare', '/models', PICKLAB ? '/picklab' : '/sources', '/privacy']) {
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
    for (const path of ['/', href, '/findings', PICKLAB ? '/picklab' : '/sources']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      assert.equal(await page.getByRole('button', { name: /analy[sz]e|deep analysis|AI /i }).count(), 0, `an AI control on ${path}`);
    }
  } finally { await context.close(); }
});

// ---- server rendering: the page that arrives already carries its content ------------------------------------------------

test('a game page arrives with its findings in the HTML, before any script runs', async () => {
  const slate = await (await fetch(`${BASE}/api/public/analytics/slate?days=10`)).json();
  const game = slate.games.find((g) => g.headline) ?? slate.games[0];
  const path = `/game/${game.event_id.replace(':', '-')}`;
  const html = await (await fetch(`${BASE}${path}`)).text();
  const plain = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  assert.ok(plain.includes(game.home.name) && plain.includes(game.away.name), 'the teams are not in the HTML');
  const board = await (await fetch(`${BASE}/api/public/analytics${path}`)).json();
  const claim = board.insights.find((f) => f.kind !== 'balance').claim.split('.')[0].replace(/\s+/g, ' ');
  assert.ok(plain.includes(claim), `the first finding is not in the HTML: ${claim}`);
  assert.match(html, /<title>[^<]*(?: at | v )[^<]*<\/title>/, "the tab title is not the game's own");
  assert.match(html, /<meta name="description" content="[^"]{40,}/);
});

test('with scripts off: content is visible, numbers show their value, charts are drawn', async () => {
  const slate = await (await fetch(`${BASE}/api/public/analytics/slate?days=10`)).json();
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/game/${slate.games[0].event_id.replace(':', '-')}`, { waitUntil: 'load' });
    const state = await page.locator('main').evaluate((main) => {
      const hidden = [...main.querySelectorAll('[data-reveal]')].filter((el) => Number(getComputedStyle(el).opacity) < 1).length;
      const counts = [...main.querySelectorAll('.pl-count')];
      return { hidden, reveals: main.querySelectorAll('[data-reveal]').length, counts: counts.length,
        unseen: counts.filter((el) => getComputedStyle(el).visibility !== 'visible' || !/\d/.test(el.textContent)).length,
        text: main.innerText.length };
    });
    assert.ok(state.reveals > 3 && state.hidden === 0, `${state.hidden} of ${state.reveals} blocks are still hidden without scripts`);
    assert.ok(state.counts > 0 && state.unseen === 0, 'a number does not show its value without scripts');
    assert.ok(state.text > 3000, 'the page is nearly empty without scripts');
    for (const path of ['/', '/games', '/league/nba', '/findings']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
      assert.ok((await page.locator('main a[href^="/game/"], main a[href^="/teams/"]').count()) > 3, `${path} has no content without scripts`);
    }
  } finally { await context.close(); }
});

test('a visitor in another time zone and language: the page is taken over with no mismatch, then shows local times', async () => {
  const slate = await (await fetch(`${BASE}/api/public/analytics/slate?days=10`)).json();
  const game = slate.games.find((g) => !g.time_tbd) ?? slate.games[0];
  for (const path of ['/', '/games', `/game/${game.event_id.replace(':', '-')}`, '/league/nba', '/findings', '/models', `/teams/${game.sport}/${game.home.team.split(':').pop()}`]) {
    const { context, page, errors } = await open(path, { timezoneId: 'Asia/Tokyo', locale: 'de-DE' });
    try {
      await page.waitForTimeout(300);
      assert.deepEqual(errors, [], `${path} logged an error while being taken over`);
    } finally { await context.close(); }
  }
  const { context, page } = await open('/games', { timezoneId: 'Asia/Tokyo', locale: 'en-US' });
  try {
    await page.waitForTimeout(300);
    const card = await page.locator('a[href^="/game/"]').first().innerText();
    assert.ok(!/E[SD]T/.test(card), `times did not switch to the visitor's zone: ${card.slice(0, 80)}`);
  } finally { await context.close(); }
});

test('unknown games, teams, players and leagues are real 404s inside the site', async () => {
  for (const path of ['/game/nba-nope', '/teams/nba/XXX', '/players/nba-p0', '/league/mlb']) {
    assert.equal((await fetch(`${BASE}${path}`)).status, 404, `${path} did not answer 404`);
  }
  // an address that tries to climb out of its folder is refused: by the site (404) or by the host before it (400)
  assert.ok([400, 404].includes((await fetch(`${BASE}/game/..%2F..%2Fx`)).status));
  // the framework sends a 404's body for the browser to draw, so the page itself is checked in one
  const { context, page, response } = await open('/game/nba-nope');
  try {
    assert.equal(response.status(), 404);
    await page.getByRole('heading', { name: 'Out of bounds' }).waitFor();
    assert.ok(await page.getByRole('navigation', { name: 'Main' }).isVisible(), "the 404 has lost the site's bar");
    assert.match(await page.title(), /not found/i);
  } finally { await context.close(); }
});

test('the sources page stands on its own, outside PickLab', async () => {
  const html = await (await fetch(`${BASE}/sources`)).text();
  assert.ok(html.includes('Where the analytics come from'), 'the sources are not in the HTML');
  const old = await fetch(`${BASE}/picklab/sources`, { redirect: 'manual' });
  assert.ok([307, 308].includes(old.status) && old.headers.get('location').endsWith('/sources'), 'the old address does not lead to the new one');
});

test(PICKLAB ? 'PickLab is on: its pages answer and the site links to them' : 'PickLab is off: no page, no link, no pick anywhere', async () => {
  const slate = await (await fetch(`${BASE}/api/public/analytics/slate?days=10`)).json();
  const game = `/game/${slate.games[0].event_id.replace(':', '-')}`;
  if (PICKLAB) {
    assert.equal((await fetch(`${BASE}/picklab`)).status, 200);
    assert.ok((await (await fetch(BASE)).text()).includes('href="/picklab"'));
    return;
  }
  for (const path of ['/picklab', '/picklab/experts', '/picklab/strategies']) assert.equal((await fetch(`${BASE}${path}`)).status, 404, `${path} still answers`);
  for (const path of ['/api/public/picks', '/api/public/records', '/api/public/strategies']) assert.equal((await fetch(`${BASE}${path}`)).status, 404, `${path} still answers`);
  for (const path of ['/', '/games', game, '/sources', '/privacy', '/models']) {
    const html = (await (await fetch(`${BASE}${path}`)).text()).replace(/<script[\s\S]*?<\/script>/g, '');
    assert.ok(!/href="\/picklab/.test(html), `${path} links to PickLab`);
    assert.ok(!/PickLab|analysts? (has|have) picked/i.test(html.replace(/<[^>]+>/g, ' ')), `${path} mentions PickLab`);
  }
  const map = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.ok(!map.includes('/picklab') && map.includes('/sources'));
  const src = await (await fetch(`${BASE}/api/public/sources`)).json();
  assert.ok(src.data.length > 0 && src.sources.length === 0 && src.strategies.length === 0);
});

test("each page names its own address as canonical, never the home page's", async () => {
  const canon = async (path) => (await (await fetch(`${BASE}${path}`, { headers: { 'user-agent': 'Googlebot/2.1' } })).text()).match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  for (const path of ['/games', '/findings', '/league/nba', '/models', '/sources', '/privacy']) {
    const href = await canon(path);
    assert.ok(href && new URL(href).pathname === path, `${path} says its canonical is ${href}`);
  }
  assert.equal(new URL(await canon('/')).pathname, '/');
});

test('phone: the section row hides and returns without moving the page (no flicker)', async () => {
  const { context, page } = await open('/games', { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  try {
    await page.evaluate(() => {
      window.__sizes = new Set();
      const header = document.querySelector('header');
      const tick = () => { window.__sizes.add(`${Math.round(header.getBoundingClientRect().height)}/${document.documentElement.scrollHeight}`); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const client = await context.newCDPSession(page);
    const drag = (dy) => client.send('Input.synthesizeScrollGesture', { x: 200, y: 500, yDistance: -dy, speed: 700, gestureSourceType: 'touch' });
    const hidden = () => page.evaluate(() => getComputedStyle(document.querySelector('nav[aria-label="Sections"]')).opacity === '0');
    await drag(400); await page.waitForTimeout(500);
    assert.equal(await hidden(), true, 'the row did not hide on a scroll down');
    for (const dy of [-12, 12, -10, 14]) { await drag(dy); await page.waitForTimeout(250); }  // a reader's small adjustments
    assert.equal(await hidden(), true, 'small adjustments brought the row back');
    await drag(-120); await page.waitForTimeout(500);
    assert.equal(await hidden(), false, 'the row did not return on a scroll up');
    const sizes = await page.evaluate(() => [...window.__sizes]);
    assert.equal(sizes.length, 1, `the header or the page changed height while scrolling: ${sizes.join(' ')}`);
  } finally { await context.close(); }
});
