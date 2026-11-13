// Browser checks of the public site against running servers (the API with a site database, the web app):
//   BROWSER_TEST_BASE=http://localhost:3000 node --test tests/site.test.mjs
// PLAYWRIGHT_MODULE and BROWSER_TEST_CHANNEL (e.g. "chrome" to use the installed browser) are optional.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.BROWSER_TEST_BASE || 'http://localhost:3000';
const MEDIA = ['a.espncdn.com', 'images.fotmob.com'];
// SITE_ANALYTICS=1 checks a build with visit counting on (NEXT_PUBLIC_GA_ID): Google's analytics hosts are then the
// only other hosts a page may reach. Their requests are stopped here, so a test run counts no visit anywhere.
const ANALYTICS = process.env.SITE_ANALYTICS === '1';
const GOOGLE = /(^|\.)(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)$/;
const expected = (host) => MEDIA.includes(host) || (ANALYTICS && GOOGLE.test(host));
// SITE_PICKLAB=0 checks a site run without PickLab (the analytics alone): its pages are 404s and nothing links to it.
// SITE_PICKLAB=invite checks a site where PickLab is by invitation (the public site): one page with one line and a
// waitlist, nothing of it anywhere else, and its data answers nobody who isn't signed in and invited.
const MODE = process.env.SITE_PICKLAB === '0' ? 'off' : process.env.SITE_PICKLAB === 'invite' ? 'invite' : 'open';
const PICKLAB = MODE === 'open';  // PickLab's own pages are there for every visitor
const HAS = MODE !== 'off';       // the site has a PickLab address at all
let browser;
before(async () => { browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_TEST_CHANNEL || undefined }); });
after(async () => { await browser?.close(); });

async function open(path, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
  const page = await context.newPage();
  if (ANALYTICS) await context.route((url) => GOOGLE.test(url.hostname), (route) => route.abort());
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
    assert.deepEqual([...hosts].filter((h) => !expected(h)), [], 'the page reached a host that is not the site or a media host');
    if (ANALYTICS) assert.ok([...hosts].some((h) => GOOGLE.test(h)), 'analytics is on but the page never asked for it');
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

test('a game card shows its finding as a picture: a stat drawing, its ranks, and where they sit in the league', async () => {
  const { context, page, errors } = await open('/games', { reducedMotion: 'reduce' });
  try {
    const cards = page.locator('main a[href^="/game/"]');
    assert.ok(await cards.count() > 0);
    const seen = await cards.evaluateAll((all) => all.map((a) => ({
      rail: a.querySelector('[role="img"]')?.getAttribute('aria-label') ?? null,
      drawing: a.querySelectorAll('svg').length,
      inside: a.querySelectorAll('a, button, summary').length,  // the card is one link: nothing in it is pressed on its own
      // no sentence cut off mid-way: a clamped line must fit what it holds
      cut: [...a.querySelectorAll('p')].some((e) => getComputedStyle(e).webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 2),
      // with less motion asked for, no logo waits off-screen at zero opacity
      faded: [...a.querySelectorAll('[role="img"] *:not(svg *)')].filter((e) => Number(getComputedStyle(e).opacity) < 0.99).length,
    })));
    assert.ok(seen.some((c) => c.rail && /\d+(st|nd|rd|th) of \d+/.test(c.rail)), 'no card draws its ranks');
    for (const c of seen) {
      assert.ok(c.drawing >= 2, 'a card has no stat drawing');
      assert.equal(c.inside, 0);
      assert.equal(c.cut, false, 'a card cuts a sentence off');
      assert.equal(c.faded, 0);
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('phone: the edge deck is as tall as the card on screen, not the tallest card', async () => {
  const { context, page, errors } = await open('/', { viewport: { width: 390, height: 844 } });
  try {
    const deck = page.locator('section[aria-roledescription="carousel"]');
    if (await deck.count()) {
      const off = () => deck.evaluate((d) => {
        const track = d.querySelector('[tabindex="0"]'), slide = track.children[0];
        return Math.abs(track.getBoundingClientRect().height - slide.getBoundingClientRect().height);
      });
      // the card grows as its chart arrives and the deck follows it: settled within a few seconds
      let gap = await off();
      for (let i = 0; i < 20 && gap >= 2; i++) { await page.waitForTimeout(250); gap = await off(); }
      assert.ok(gap < 2, `the deck is ${gap}px off its first card`);
      const heights = await deck.evaluate((d) => [...d.querySelector('[tabindex="0"]').children].map((s) => s.firstElementChild.offsetHeight));
      assert.ok(new Set(heights).size > 1 || heights.length < 2, 'every card is stretched to the same height');
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('a finding card draws its ranks, and asks for the whole league only when it is opened', async () => {
  const { context, page, errors } = await open('/findings');
  try {
    const asked = [];
    page.on('request', (r) => { if (r.url().includes('/analytics/trait/')) asked.push(r.url()); });
    const card = page.locator('main article').filter({ has: page.locator('summary', { hasText: 'The whole league' }) }).first();
    await card.waitFor();
    assert.match(await card.locator('[role="img"]').first().getAttribute('aria-label'), /\d+(st|nd|rd|th)/);
    assert.ok(await card.locator('a[href^="/game/"]').count() === 1, "a card has lost its way into the game");
    assert.equal(asked.length, 0, 'the page asked for league charts nobody opened');
    await card.locator('summary', { hasText: 'The whole league' }).click();
    await card.locator('[role="group"] button').nth(7).waitFor();  // every team's logo, at least eight of them
    assert.ok(asked.length >= 1);
    assert.equal(await overflow(page), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('a game page draws its lead finding on the whole league, with the exact sentence one tap away', async () => {
  const { context, page, errors } = await open('/games');
  try {
    const href = await page.locator('main a[href^="/game/"]').first().getAttribute('href');
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'What decides it' }).waitFor();
    const charts = page.locator('main [role="group"][aria-label*="every team"]:visible');
    await charts.first().locator('button').nth(7).waitFor();
    const note = page.locator('main summary:visible', { hasText: 'The numbers' }).first();
    await note.click();
    assert.ok((await note.locator('xpath=..').innerText()).length > 60, 'the data note is empty');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('the league page draws any stat as one picture: every logo at its rank, and a pressed logo becomes the marked team', async () => {
  const { context, page, errors } = await open('/league/nba');
  try {
    await page.getByRole('heading', { name: 'Rank any stat' }).waitFor();
    const chart = page.locator('main [role="group"][aria-label*="every team"]').last();
    await chart.locator('button').nth(7).waitFor();
    const marked = () => chart.locator('xpath=ancestor::div[contains(@class,"pl-reading")][1]').locator('a[href^="/teams/"]').innerText();
    const before = await marked();
    const other = chart.locator('button').filter({ hasNot: page.locator(`[title="${before}"]`) }).last();
    const name = (await other.getAttribute('aria-label')).split(':')[0];
    await other.click();
    await page.waitForFunction((n) => [...document.querySelectorAll('main a[href^="/teams/"]')].some((a) => a.textContent.trim() === n && a.className.includes('underline')), name);
    assert.notEqual(await marked(), before);
    // the stats are listed by part of the game
    assert.ok(await page.locator('main select optgroup').count() >= 4);
    assert.equal(await overflow(page), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

if (PICKLAB) test('PickLab says what it is for: three doors with their numbers, analysts as a ranked list, and a door on the home page', async () => {
  const { context, page, errors } = await open('/picklab');
  try {
    await page.evaluate(() => localStorage.setItem('picklab-public-age-ok', '1'));
    // not "network idle": a page served from a stored copy is refreshed by the browser in the background, and that
    // request never counts as finished
    await page.reload({ waitUntil: 'load' });
    const doors = page.getByRole('navigation', { name: 'What is in PickLab' }).locator('a');
    await doors.first().waitFor();
    assert.equal(await doors.count(), 3);
    assert.deepEqual(await doors.evaluateAll((all) => all.map((a) => a.getAttribute('href'))), ['/picklab', '/picklab/experts', '/picklab/strategies']);
    assert.equal(await overflow(page), 0);
    await page.goto(`${BASE}/picklab/experts`, { waitUntil: 'networkidle' });
    const rows = page.locator('main ol li');
    await rows.first().waitFor();
    // every row writes out both of its samples
    assert.ok((await rows.allInnerTexts()).every((t) => /\d+ graded/.test(t) && /(priced|no prices listed)/.test(t)), 'a record is shown without its sample');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Who is actually right?' }).waitFor();
    assert.ok(await page.locator('main a[href="/picklab/experts"]').count() >= 1);
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

for (const path of ['/', '/games', '/findings', '/league/nba', '/compare', '/models', HAS ? '/picklab' : '/sources', '/privacy']) {
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
    for (const path of ['/', href, '/findings', HAS ? '/picklab' : '/sources']) {
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

// what the public face of PickLab, and the pages around it, never say
const WORDS = /\b(bets?|betting|bettors?|gambl\w*|wager\w*|sportsbooks?|odds|parlays?|picks|units|21\+)\b/i;
const seenText = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');

if (MODE === 'invite') test('PickLab by invitation: one line and a waitlist for a visitor, and nothing of it anywhere else on the site', async () => {
  const slate = await (await fetch(`${BASE}/api/public/analytics/slate?days=10`)).json();
  const game = `/game/${slate.games[0].event_id.replace(':', '-')}`;
  for (const path of ['/picklab', '/picklab/experts', '/picklab/strategies']) {
    const res = await fetch(`${BASE}${path}`), html = await res.text();
    assert.equal(res.status, 200, path);
    assert.match(html, /data-waitlist/, `${path} is not the waitlist page`);
    assert.match(seenText(html), /PickLab grades analysts\./);
    assert.doesNotMatch(html, WORDS, `${path} says more than its one line`);
    assert.match(html, /<title>PickLab[^<]*<\/title>/);
    assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  }
  for (const path of ['/api/public/picks', '/api/public/records', '/api/public/strategies', '/api/public/strategies/model_edge']) {
    assert.equal((await fetch(`${BASE}${path}`)).status, 404, `${path} answered a visitor who is not invited`);
  }
  assert.ok((await (await fetch(BASE)).text()).includes('href="/picklab"'), 'nothing links to the waitlist');
  for (const path of ['/', '/games', game, '/findings', '/sources', '/privacy', '/models', '/league/nba']) {
    const text = seenText(await (await fetch(`${BASE}${path}`)).text());
    assert.doesNotMatch(text, WORDS, `${path} uses the wording`);
    assert.doesNotMatch(text, /analysts? (has|have) picked|Who is actually right|Analyst records/i, `${path} shows something of PickLab`);
  }
  assert.ok(!(await (await fetch(`${BASE}/sitemap.xml`)).text()).includes('/picklab'));
  const src = await (await fetch(`${BASE}/api/public/sources`)).json();
  assert.ok(src.data.length > 0 && src.sources.length === 0 && src.strategies.length === 0 && src.excluded.length === 0);
  // in a browser: the page works at phone width, with no script error, and the search palette has no PickLab entry
  const { context, page, errors } = await open('/picklab', { viewport: { width: 390, height: 844 } });
  try {
    await page.locator('[data-waitlist]').waitFor();
    assert.equal(await overflow(page), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

if (MODE !== 'invite') test(PICKLAB ? 'PickLab is on: its pages answer and the site links to them' : 'PickLab is off: no page, no link, no pick anywhere', async () => {
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

test('every page says how old its data is: the build time in the HTML, the age once the page is live', async () => {
  const api = await (await fetch(`${BASE}/api/public/meta`)).json().catch(() => null);
  if (!api?.built_at) return;  // an API that doesn't say (the private app's own): the line is simply absent
  const { context, page, errors } = await open('/games');
  try {
    const line = page.locator('[data-fresh]');
    await line.waitFor();
    assert.equal(await line.locator('time').getAttribute('datetime'), api.built_at);
    await page.waitForFunction(() => /ago/.test(document.querySelector('[data-fresh]')?.textContent ?? ''));
    const hours = (Date.now() - new Date(api.built_at).getTime()) / 3_600_000;
    assert.equal(await line.getAttribute('data-fresh'), hours > 36 ? 'stale' : 'ok');
    assert.match(await line.innerText(), hours > 36 ? /last updated/i : /data as of/i);
    assert.deepEqual(errors, []);
    // and without scripts the time is still there
    const plain = await browser.newContext({ javaScriptEnabled: false });
    const p2 = await plain.newPage();
    await p2.goto(`${BASE}/games`);
    assert.equal(await p2.locator('[data-fresh] time').getAttribute('datetime'), api.built_at);
    await plain.close();
  } finally { await context.close(); }
});

test("a game card keeps the model's favourite and the matchup count apart, and its bar is the count its words give", async () => {
  const slate = await (await fetch(`${BASE}/api/public/analytics/slate?days=10`)).json();
  const { context, page, errors } = await open('/games');
  try {
    await page.locator('a[href^="/game/"]').first().waitFor();
    let checked = 0;
    for (const g of slate.games.slice(0, 12)) {
      const card = page.locator(`a[href="/game/${g.event_id.replace(':', '-')}"]`).first();
      if (!(await card.count())) continue;
      const text = (await card.innerText()).toLowerCase();
      const bar = Number(await card.locator('[data-bar]').getAttribute('data-bar'));
      const lean = g.lean === g.home.team ? g.home.name : g.lean === g.away.team ? g.away.name : null;
      assert.ok(text.includes(lean ? `matchups favour ${lean.toLowerCase()}` : 'matchups: an even board'), `${g.label}: the card's words are not the board's verdict`);
      if (g.matchups) assert.equal(bar.toFixed(2), ((g.matchups.home - g.matchups.away) / g.matchups.of).toFixed(2), `${g.label}: the bar is not the count`);
      if (lean) assert.equal(bar > 0, g.lean === g.home.team, `${g.label}: the bar points away from the named side`);
      assert.equal(await card.locator('[data-differ]').count(), g.agree === false ? 1 : 0, `${g.label}: the disagreement mark`);
      if (g.model) assert.match(text, /score model|simulation/);
      checked++;
    }
    assert.ok(checked > 0, 'no card was checked');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('the record compares each method with plain rules on the same games, and draws calibration only with enough of it', async () => {
  const rec = await (await fetch(`${BASE}/api/public/analytics/record`)).json();
  const { context, page, errors } = await open('/models#record');
  try {
    await page.locator('#record [data-record]').first().waitFor();
    for (const s of rec.sports) {
      const card = page.locator(`#record [data-record="${s.sport}"]`);
      const text = await card.innerText();
      for (const t of s.tallies.filter((t) => t.source ?? t.method.startsWith('The '))) {
        assert.ok(text.includes(`${t.right} of ${t.of}`), `${s.sport}: ${t.method} count`);
        if (t.home_right != null) assert.ok(text.includes(`${t.home_right} of ${t.of}`), `${s.sport}: ${t.method} is not beside the home rule on its own games`);
      }
      for (const c of s.calibration ?? []) {
        assert.equal(await card.locator(`[data-calibration="${c.source}"]`).count(), c.n >= 100 ? 1 : 0, `${s.sport}: calibration drawn`);
        assert.equal(await card.locator(`[data-calibration-wait="${c.source}"]`).count(), c.n >= 100 ? 0 : 1, `${s.sport}: calibration count`);
      }
      assert.equal(await card.locator('[data-backfilled]').count(), s.backfilled ? 1 : 0, `${s.sport}: calls added after their games are said`);
    }
    assert.equal(await overflow(page), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  // a phone: nothing spills
  const phone = await open('/models#record', { viewport: { width: 390, height: 800 } });
  try {
    await phone.page.locator('#record [data-record]').first().waitFor();
    assert.equal(await overflow(phone.page), 0, 'the record spills sideways on a phone');
  } finally { await phone.context.close(); }
});
