// Browser checks of visit counting (lib/analytics.ts) against a running site:
//   BROWSER_TEST_BASE=http://localhost:3000 node --test tests/analytics.test.mjs
// With SITE_ANALYTICS=1 the site under test was built with NEXT_PUBLIC_GA_ID (any id, e.g. G-TEST000000): the checks
// are those of a site that counts visits. Without it they are those of a site that must not. Every request to a
// Google host is stopped here before it leaves the machine, so a test run counts no visit anywhere.
// PLAYWRIGHT_MODULE and BROWSER_TEST_CHANNEL (e.g. "chrome" to use the installed browser) are optional.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.BROWSER_TEST_BASE || 'http://localhost:3000';
const ON = process.env.SITE_ANALYTICS === '1';
const GOOGLE = /(^|\.)(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|google\.com|doubleclick\.net)$/;
const KEY = 'ebk-analytics-off';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_TEST_CHANNEL || undefined }); });
after(async () => { await browser?.close(); });

/** A fresh visitor. `stored` is their saved choice ("1" off, "0" seen and on), `gpc` a browser that sends Global Privacy Control. */
async function visit(path, { stored, gpc = false, viewport = { width: 1280, height: 860 } } = {}) {
  const context = await browser.newContext({ viewport });
  const google = [], errors = [];
  await context.route((url) => GOOGLE.test(url.hostname), (route) => { google.push(route.request().url()); return route.abort(); });
  if (gpc) await context.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true, configurable: true }); });
  if (stored !== undefined) await context.addInitScript(([k, v]) => { try { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); } catch { /* no storage */ } }, [KEY, stored]);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  return { context, page, google, errors, response };
}
/** What the page queued for Google Analytics, as plain arrays (["event", "page_view", {…}], …). */
const queued = (page) => page.evaluate(() => (window.dataLayer ?? []).map((a) => Array.from(a)));
const events = async (page, name) => (await queued(page)).filter((a) => a[0] === 'event' && a[1] === name).map((a) => a[2]);
const notice = (page) => page.locator('[data-analytics-notice]');
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const id = async (page) => page.evaluate(() => Object.keys(window).find((k) => k.startsWith('ga-disable-'))?.slice('ga-disable-'.length));

if (!ON) {
  test('analytics off: no Google request, no queue, no notice, no control, on any page', async () => {
    for (const path of ['/', '/games', '/privacy']) {
      const { context, page, google, errors } = await visit(path);
      try {
        assert.deepEqual(google, [], `${path} asked a Google host for something`);
        assert.equal(await page.evaluate(() => typeof window.dataLayer), 'undefined');
        assert.equal(await notice(page).count(), 0);
        assert.equal(await page.locator('[data-analytics-choice]').count(), 0);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  });

  test('analytics off: the site says there is none, and its policy admits no Google host', async () => {
    const { context, page, response } = await visit('/privacy');
    try {
      const text = await page.locator('main').innerText();
      assert.match(text, /Trackers and analytics\s+None\. No third-party script is loaded/i);
      assert.doesNotMatch(text, /Google Analytics/);
      assert.match(await page.locator('footer').innerText(), /No tracking, no ads/);
      assert.doesNotMatch(response.headers()['content-security-policy'], /google/i);
    } finally { await context.close(); }
  });
} else {
  test('analytics on: the first visit loads gtag with advertising off, counts the page, and shows the notice', async () => {
    const { context, page, google, errors } = await visit('/');
    try {
      assert.ok(google.some((u) => /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-[A-Z0-9]+$/.test(u)), `gtag.js was not asked for: ${google}`);
      const q = await queued(page);
      const consent = q.find((a) => a[0] === 'consent' && a[1] === 'default')?.[2];
      assert.deepEqual(consent, { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
      assert.ok(q.findIndex((a) => a[0] === 'consent') < q.findIndex((a) => a[0] === 'config'), 'consent must be set before the property is configured');
      const config = q.find((a) => a[0] === 'config')?.[2];
      assert.equal(config.send_page_view, false);
      assert.equal(config.allow_google_signals, false);
      assert.equal(config.allow_ad_personalization_signals, false);
      assert.deepEqual((await events(page, 'page_view')).map((e) => e.page_path), ['/']);
      await notice(page).waitFor();
      assert.match(await notice(page).innerText(), /Google Analytics/);
      assert.equal(await notice(page).getByRole('link').getAttribute('href'), '/privacy#analytics');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test('analytics on: "Turn analytics off" stops it at once, stores the choice, and the next load asks Google for nothing', async () => {
    const { context, page, google } = await visit('/games');
    try {
      await notice(page).getByRole('button', { name: 'Turn analytics off' }).click();
      await notice(page).waitFor({ state: 'detached' });
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), KEY), '1');
      const ga = await id(page);
      assert.equal(await page.evaluate((k) => window[`ga-disable-${k}`], ga), true);
      assert.match(await page.locator('footer [data-analytics-choice]').innerText(), /Analytics: off/i);
      const before = (await queued(page)).length;
      await page.getByRole('link', { name: 'Findings' }).first().click();
      await page.waitForURL('**/findings');
      await page.waitForLoadState('networkidle');
      assert.equal((await events(page, 'page_view')).length, 1, 'a page was counted after the visitor turned counting off');
      assert.ok((await queued(page)).length <= before + 1);  // at most the consent update
      google.length = 0;
      await page.reload({ waitUntil: 'networkidle' });
      assert.deepEqual(google, [], 'an opted-out visitor still reached a Google host');
      assert.equal(await page.evaluate(() => typeof window.dataLayer), 'undefined');
      assert.equal(await page.evaluate((k) => window[`ga-disable-${k}`], ga), true, "Google's own kill switch is not set for an opted-out visitor");
      assert.equal(await notice(page).count(), 0);
      // and back on, from a page that never loaded it: the script is asked for and this page is counted once
      await page.locator('footer [data-analytics-choice]').getByRole('button', { name: 'turn on' }).click();
      await page.waitForFunction(() => (window.dataLayer ?? []).some((a) => a[0] === 'event' && a[1] === 'page_view'));
      assert.ok(google.some((u) => u.includes('/gtag/js')));
      assert.equal((await events(page, 'page_view')).length, 1);
      assert.equal(await page.evaluate((k) => window[`ga-disable-${k}`], ga), false);
    } finally { await context.close(); }
  });

  test('analytics on: "OK" keeps it on, and the notice does not come back', async () => {
    const { context, page, google } = await visit('/games');
    try {
      await notice(page).getByRole('button', { name: 'OK' }).focus();
      await page.keyboard.press('Enter');  // reachable and usable from the keyboard
      await notice(page).waitFor({ state: 'detached' });
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), KEY), '0');
      assert.equal((await events(page, 'page_view')).length, 1, 'dismissing the notice counted the page twice');
      google.length = 0;
      await page.reload({ waitUntil: 'networkidle' });
      assert.ok(google.some((u) => u.includes('/gtag/js')));
      assert.equal(await notice(page).count(), 0);
    } finally { await context.close(); }
  });

  test('analytics on: a browser that sends Global Privacy Control is never counted and never asked', async () => {
    const { context, page, google } = await visit('/', { gpc: true });
    try {
      assert.deepEqual(google, []);
      assert.equal(await page.evaluate(() => typeof window.dataLayer), 'undefined');
      assert.equal(await notice(page).count(), 0);
      const control = page.locator('footer [data-analytics-choice]');
      assert.match(await control.innerText(), /Analytics: off/i);
      assert.equal(await control.getByRole('button').count(), 0, "the site offered to override the browser's own setting");
    } finally { await context.close(); }
  });

  test('analytics on: each page change is one page view, and a game page counts as a game view by sport only', async () => {
    const { context, page } = await visit('/games', { stored: '0' });
    try {
      const card = page.locator('a[href^="/game/"]').first();
      const href = await card.getAttribute('href');
      await card.click();
      await page.waitForURL(`**${href}`);
      await page.waitForFunction(() => (window.dataLayer ?? []).filter((a) => a[0] === 'event' && a[1] === 'page_view').length === 2);
      assert.deepEqual((await events(page, 'page_view')).map((e) => e.page_path), ['/games', href]);
      const games = await events(page, 'game_view');
      assert.equal(games.length, 1);
      assert.deepEqual(Object.keys(games[0]), ['sport']);
      assert.match(games[0].sport, /^(nba|nfl|soccer|ncaaf)$/);
    } finally { await context.close(); }
  });

  test('analytics on: only the site\'s own view state is reported from an address, never anything else in it', async () => {
    const { context, page } = await visit('/privacy?token=s3cret-reset-key&sport=nba&q=someone%40example.com', { stored: '0' });
    try {
      const q = await queued(page);
      assert.deepEqual((await events(page, 'page_view')).map((e) => e.page_path), ['/privacy?sport=nba']);
      assert.doesNotMatch(JSON.stringify(q), /s3cret|example\.com|token/);
      // nor from the page the visitor came from, when that was a page of this site
      await page.goto(`${BASE}/games`, { waitUntil: 'networkidle', referer: `${BASE}/account/reset?token=s3cret-reset-key` });
      assert.match(await page.evaluate(() => document.referrer), /s3cret/);
      const next = await queued(page);
      assert.equal(next.find((a) => a[0] === 'config')[2].page_referrer, `${BASE}/account/reset`);
      assert.doesNotMatch(JSON.stringify(next), /s3cret|token/);
    } finally { await context.close(); }
  });

  test('analytics on: the privacy page says what is loaded and carries the switch, which works both ways', async () => {
    const { context, page, google, response } = await visit('/privacy', { stored: '0' });
    try {
      const text = await page.locator('main').innerText();
      assert.match(text, /Google Analytics 4/);
      assert.match(text, /_ga/);
      assert.match(text, /advertising features are off/i);
      assert.doesNotMatch(text, /No third-party script is loaded, and|no cookies and no trackers|we don.t track you/);
      assert.doesNotMatch(await page.locator('footer').innerText(), /No tracking/);
      const csp = response.headers()['content-security-policy'];
      assert.match(csp, /script-src [^;]*https:\/\/www\.googletagmanager\.com/);
      assert.match(csp, /connect-src [^;]*https:\/\/\*\.google-analytics\.com/);
      const control = page.locator('main [data-analytics-choice]');
      assert.match(await control.innerText(), /Analytics: on/i);
      await control.getByRole('button', { name: 'turn off' }).click();
      await page.waitForFunction(() => /Analytics: off/.test(document.querySelector('main [data-analytics-choice]').textContent));
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), KEY), '1');
      assert.match(await page.locator('footer [data-analytics-choice]').innerText(), /Analytics: off/i);  // both controls follow
      const before = (await events(page, 'page_view')).length;
      await control.getByRole('button', { name: 'turn on' }).click();
      await page.waitForFunction(() => /Analytics: on/.test(document.querySelector('main [data-analytics-choice]').textContent));
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), KEY), '0');
      assert.equal((await events(page, 'page_view')).length, before + 1);
      assert.ok(google.length > 0);
    } finally { await context.close(); }
  });

  test('analytics on, phone width: the notice fits, hides nothing for good, and causes no sideways scroll', async () => {
    for (const path of ['/', '/privacy']) {
      const { context, page } = await visit(path, { viewport: { width: 390, height: 844 } });
      try {
        await notice(page).waitFor();
        assert.ok(await overflow(page) <= 1, `${path} scrolls sideways with the notice showing`);
        const box = await notice(page).boundingBox();
        assert.ok(box.width <= 390 && box.height < 844 * 0.3, `the notice takes ${Math.round(box.height)}px of a phone screen`);
        assert.ok(Math.abs(box.y + box.height - 844) <= 1, 'the notice is not at the bottom edge');
        // the page ends below the bar: its last line can be scrolled clear of it
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const last = await page.locator('footer').last().boundingBox();
        assert.ok(last.y + last.height <= box.y + 1, 'the footer ends underneath the notice');
      } finally { await context.close(); }
    }
  });

  const TAG = 'utm_source=reddit&utm_medium=social&utm_campaign=gtm1&utm_content=comment';
  test('analytics on: a tagged link is counted with the first page view only, from the fixed lists, and the tag leaves the address', async () => {
    const { context, page } = await visit(`/games?sport=nba&${TAG}&utm_term=a+person&fbclid=abc123`, { stored: '0' });
    try {
      const q = await queued(page);
      assert.equal(q.find((a) => a[0] === 'config')[2].page_location, `${BASE}/games?sport=nba&${TAG}`);
      const views = await events(page, 'page_view');
      assert.equal(views.length, 1, 'taking the tag off the address counted a second page view');
      assert.equal(views[0].page_location, `${BASE}/games?sport=nba&${TAG}`);
      assert.equal(views[0].page_path, '/games?sport=nba', 'the tag is never part of the path');
      assert.doesNotMatch(JSON.stringify(q), /utm_term|a\+person|a person|fbclid|abc123/);
      // what every later event on the page reports is the plain address
      assert.equal(q.filter((a) => a[0] === 'set').at(-1)[1].page_location, `${BASE}/games?sport=nba`);
      assert.equal(new URL(page.url()).search, '?sport=nba&fbclid=abc123', 'the address bar kept a utm key, or lost something else');
      // and the next page carries no tag at all
      const card = page.locator('a[href^="/game/"]').first();
      await card.click();
      await page.waitForFunction(() => (window.dataLayer ?? []).filter((a) => a[0] === 'event' && a[1] === 'page_view').length === 2);
      assert.doesNotMatch(JSON.stringify((await events(page, 'page_view'))[1]), /utm_/);
    } finally { await context.close(); }
  });

  test('analytics on: a tag that is not on the lists is not reported; a campaign that is not drops by itself', async () => {
    const stranger = await visit('/?utm_source=someone&utm_medium=social&utm_campaign=gtm1', { stored: '0' });
    try {
      assert.doesNotMatch(JSON.stringify(await queued(stranger.page)), /utm_|someone/);
      assert.equal(new URL(stranger.page.url()).search, '');
    } finally { await stranger.context.close(); }
    const { context, page } = await visit('/findings?kind=clash&utm_source=Bluesky&utm_medium=social&utm_campaign=jane%40example.com&utm_content=post', { stored: '0' });
    try {
      const q = await queued(page);
      assert.equal((await events(page, 'page_view'))[0].page_location, `${BASE}/findings?kind=clash&utm_source=bluesky&utm_medium=social&utm_content=post`);
      assert.doesNotMatch(JSON.stringify(q), /jane|example\.com|utm_campaign/);
      assert.equal(new URL(page.url()).search, '?kind=clash', 'the page lost its own filter with the tag');
    } finally { await context.close(); }
  });

  test('analytics on: a visitor who is opted out is given no campaign, and the tag still leaves the address', async () => {
    const { context, page, google } = await visit(`/games?${TAG}`, { stored: '1' });
    try {
      assert.deepEqual(google, []);
      assert.equal(await page.evaluate(() => typeof window.dataLayer), 'undefined');
      assert.equal(new URL(page.url()).search, '');
      // turning it on afterwards counts from here, with no campaign: the tag was dropped on arrival
      await page.locator('footer [data-analytics-choice]').getByRole('button', { name: 'turn on' }).click();
      await page.waitForFunction(() => (window.dataLayer ?? []).some((a) => a[0] === 'event' && a[1] === 'page_view'));
      assert.doesNotMatch(JSON.stringify(await queued(page)), /utm_/);
    } finally { await context.close(); }
  });

  test('analytics on: reading a page is not activation; the first real interaction is, once per page load', async () => {
    const slate = await (await fetch(`${BASE}/api/public/analytics/slate?days=5`)).json();
    const league = await (await fetch(`${BASE}/api/public/analytics/league/nba`)).json();
    const [a, b] = league.teams;
    const reads = ['/', '/games', '/findings', '/league/nba', `/compare?sport=nba&a=${a.team}&b=${b.team}`,
      ...(slate.games[0] ? [`/game/${slate.games[0].event_id.replace(':', '-')}`] : [])];
    for (const path of reads) {
      const read = await visit(path, { stored: '0' });
      try {
        await read.page.mouse.wheel(0, 2400);  // scrolling is reading
        await read.page.waitForTimeout(400);
        assert.deepEqual(await events(read.page, 'activate'), [], `${path} counted an activation nobody made`);
      } finally { await read.context.close(); }
    }
    const { context, page } = await visit('/findings', { stored: '0' });
    try {
      const whole = page.locator('details.group\\/lg > summary');
      await whole.first().click();
      await page.waitForFunction(() => (window.dataLayer ?? []).some((a) => a[0] === 'event' && a[1] === 'activate'));
      assert.equal((await events(page, 'finding_open')).length, 1);
      assert.deepEqual(await events(page, 'activate'), [{ via: 'finding_open' }]);
      const q = await queued(page);
      assert.ok(q.findIndex((x) => x[1] === 'finding_open') < q.findIndex((x) => x[1] === 'activate'), 'activate is sent after the event that caused it');
      // a second interaction, and a change of page inside the same load, count nothing more
      await whole.nth(1).click();
      await page.waitForFunction(() => (window.dataLayer ?? []).filter((a) => a[0] === 'event' && a[1] === 'finding_open').length === 2);
      await page.locator('header a[href="/games"]').first().click();
      await page.waitForURL('**/games');
      assert.equal((await events(page, 'activate')).length, 1);
    } finally { await context.close(); }
  });

  test("analytics on: opening a finding's numbers on a game page is counted and activates; any other data note is not", async () => {
    const slate = await (await fetch(`${BASE}/api/public/analytics/slate?days=5`)).json();
    const game = slate.games.find((g) => g.sport === 'nba') ?? slate.games[0];
    assert.ok(game, 'the slate has a game');
    for (const size of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const { context, page } = await visit(`/game/${game.event_id.replace(':', '-')}`, { stored: '0', viewport: size });
      try {
        const numbers = page.locator('[data-finding] details > summary:visible', { hasText: 'The numbers' }).first();
        await numbers.scrollIntoViewIfNeeded();
        await numbers.click();
        await page.waitForFunction(() => (window.dataLayer ?? []).some((a) => a[0] === 'event' && a[1] === 'activate'));
        const opened = await events(page, 'finding_open');
        assert.equal(opened.length, 1, `${size.width} wide`);
        assert.equal(opened[0].which, 'numbers');
        assert.match(opened[0].kind ?? '', /^[a-z_]{2,20}$/);
        assert.deepEqual(await events(page, 'activate'), [{ via: 'finding_open' }]);
        await numbers.click();   // closing it again is not a second opening
        await page.waitForTimeout(300);
        assert.equal((await events(page, 'finding_open')).length, 1);
      } finally { await context.close(); }
    }
    const { context, page } = await visit('/findings', { stored: '0' });
    try {
      await page.locator('details > summary', { hasText: 'How findings are ranked' }).first().click();
      await page.waitForTimeout(400);
      assert.deepEqual(await events(page, 'finding_open'), []);
      assert.deepEqual(await events(page, 'activate'), []);
    } finally { await context.close(); }
  });

  test('analytics on: Ctrl or Cmd+K counts as opening search, once; closing it the same way counts nothing', async () => {
    const { context, page } = await visit('/games', { stored: '0' });
    try {
      await page.keyboard.press('Control+k');
      await page.getByRole('dialog').waitFor();
      assert.deepEqual(await events(page, 'search_open'), [{ via: 'key' }]);
      await page.keyboard.press('Control+k');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.equal((await events(page, 'search_open')).length, 1);
      assert.deepEqual(await events(page, 'activate'), [], 'opening search is not activation; choosing a result is');
    } finally { await context.close(); }
  });
}

test(ON ? 'analytics on: nothing but Google\'s analytics hosts joins the security policy' : 'analytics off: the security policy is the site\'s own origin and the media hosts', async () => {
  const csp = (await fetch(`${BASE}/games`)).headers.get('content-security-policy');
  const hosts = [...csp.matchAll(/https:\/\/[^\s;]+/g)].map((m) => m[0]).filter((h) => /google/.test(h));
  const expected = ON ? ['https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://*.googletagmanager.com',
    'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com'] : [];
  assert.deepEqual(hosts.sort(), expected.sort());
  assert.match(csp, /default-src 'self'/);
});

test('a campaign tag leaves the address bar whether or not visits are counted, and the page keeps its own state', async () => {
  const { context, page, errors } = await visit('/findings?kind=clash&utm_source=reddit&utm_medium=social&utm_term=x#top');
  try {
    const url = new URL(page.url());
    assert.equal(url.search, '?kind=clash');
    assert.equal(url.hash, '#top');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
