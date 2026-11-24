// Checks of what a shared link and a search engine are given, against a running site:
//   BROWSER_TEST_BASE=http://localhost:3000 node --test tests/share.test.mjs
// the picture for a game, the page's own description of itself (structured data), and the sitemap.
// SITE_PICKLAB=0 checks a site run without PickLab. PLAYWRIGHT_MODULE and BROWSER_TEST_CHANNEL are optional.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.BROWSER_TEST_BASE || 'http://localhost:3000';
const PICKLAB = process.env.SITE_PICKLAB !== '0' && process.env.SITE_PICKLAB !== 'invite';  // PickLab's pages are public (not off, not by invitation)
let browser, game, board;
before(async () => {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_TEST_CHANNEL || undefined });
  const slate = await (await fetch(`${BASE}/api/public/analytics/slate?days=5`)).json();
  assert.ok(slate.games.length > 0, 'no game on the slate to check');
  game = slate.games[0].event_id.replace(':', '-');
  board = await (await fetch(`${BASE}/api/public/analytics/game/${game}`)).json();
});
after(async () => { await browser?.close(); });

const html = async (path) => (await fetch(`${BASE}${path}`, { headers: { 'user-agent': 'Googlebot/2.1' } })).text();  // a crawler gets the metadata in the first bytes
const meta = (page, prop) => page.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`))?.[1]?.replace(/&amp;/g, '&');
const canonical = (page) => page.match(/<link rel="canonical" href="([^"]*)"/)?.[1]?.replace(/&amp;/g, '&');
const title = (page) => page.match(/<title>([^<]*)<\/title>/)?.[1];
const ld = (page) => [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
/** The image at `url`: its type, size in bytes and pixel size (read from the PNG header). */
async function png(url) {
  const res = await fetch(url);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200, `${url} answered ${res.status}`);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG');
  return { bytes, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), cache: res.headers.get('cache-control') ?? '' };
}
const here = (url) => { const u = new URL(url); return `${BASE}${u.pathname}${u.search}`; };  // the same path on the site under test

test('a game page points at its own share picture: 1200 x 630, a sane size, and not kept for good', async () => {
  const page = await html(`/game/${game}`);
  const image = meta(page, 'og:image');
  assert.ok(image && new URL(image).pathname.startsWith(`/game/${game}/opengraph-image`), `og:image is ${image}`);
  assert.equal(meta(page, 'twitter:image'), image);
  assert.equal(meta(page, 'twitter:card'), 'summary_large_image');
  assert.equal(meta(page, 'og:title'), board.label.replace(/&/g, '&amp;'));
  const { bytes, width, height, cache } = await png(here(image));
  assert.deepEqual([width, height], [1200, 630]);
  assert.ok(bytes.length > 15_000 && bytes.length < 600_000, `the picture is ${bytes.length} bytes`);
  assert.doesNotMatch(cache, /immutable/);
});

test('a link to one finding describes that finding, in words and in its picture', async () => {
  const lead = board.insights.find((i) => i.kind !== 'balance');
  const other = board.insights.find((i) => i.kind !== 'balance' && i.id !== lead.id) ?? lead;
  const page = await html(`/game/${game}?f=${encodeURIComponent(other.id)}`);
  const image = meta(page, 'og:image');
  assert.equal(new URL(image).pathname, `/game/${game}/og`);
  assert.equal(new URL(image).searchParams.get('f'), other.id);
  assert.equal(meta(page, 'twitter:image'), image);
  assert.ok(meta(page, 'og:title').includes(board.label.replace(/&/g, '&amp;')));
  assert.equal(new URL(canonical(page)).pathname + new URL(canonical(page)).search, `/game/${game}`, 'a finding link is still the game page');
  const shared = await png(here(image)), plain = await png(`${BASE}/game/${game}/og`);
  assert.deepEqual([shared.width, shared.height], [1200, 630]);
  if (other.id !== lead.id) assert.notDeepEqual(shared.bytes, plain.bytes, 'the finding picture is the same as the game picture');
  // a finding the game doesn't have falls back to the game's own picture, never an error
  assert.deepEqual((await png(`${BASE}/game/${game}/og?f=no-such-finding`)).bytes, plain.bytes);
});

test('the site\'s own share picture is the same size, and is the card a game falls back to', async () => {
  const site = await png(`${BASE}/opengraph-image`);
  assert.deepEqual([site.width, site.height], [1200, 630]);
  assert.ok(site.bytes.length > 5_000);
  const page = await html('/');
  assert.equal(meta(page, 'og:site_name'), meta(page, 'og:title'), 'the site names itself two ways');
  // one drawing: a game the site doesn't have shows the very same card
  assert.deepEqual((await png(`${BASE}/game/nba-nonsense123/og`)).bytes, site.bytes);
});

test('a link to one finding opens the game at that finding and marks it: a wide window, a phone, and less motion', async () => {
  const findings = board.insights.filter((i) => i.kind !== 'balance');
  const target = findings[Math.min(2, findings.length - 1)];  // one of the first five, which the page tells as a scroll
  const where = () => {
    const el = [...document.querySelectorAll('[data-shared]')].find((x) => x.getClientRects().length > 0);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, y: window.scrollY, tall: window.innerHeight, id: el.dataset.finding, text: el.innerText,
      current: el.closest('li')?.getAttribute('aria-current') ?? null, drawn: [...document.querySelectorAll('[data-shared]')].filter((x) => x.getClientRects().length > 0).length };
  };
  const later = findings[5];  // a finding past the first five is a card in a grid, not a step of the scroll
  const cases = [[{ width: 1280, height: 860 }, 'no-preference', target], [{ width: 390, height: 844 }, 'no-preference', target], [{ width: 1280, height: 860 }, 'reduce', target],
    ...(later ? [[{ width: 1280, height: 860 }, 'no-preference', later], [{ width: 390, height: 844 }, 'no-preference', later]] : [])];
  for (const [viewport, reducedMotion, target] of cases) {
    const context = await browser.newContext({ viewport, reducedMotion });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/game/${game}?f=${encodeURIComponent(target.id)}`, { waitUntil: 'networkidle' });
      // settled: the mark is on screen and the page has stopped moving
      await page.waitForFunction(() => {
        const el = [...document.querySelectorAll('[data-shared]')].find((x) => x.getClientRects().length > 0);
        if (!el) return false;
        const r = el.getBoundingClientRect(), y = window.scrollY, was = window.__y;
        window.__y = y;
        return was === y && y > 100 && r.top >= 0 && r.top < window.innerHeight * 0.8;
      }, null, { polling: 250, timeout: 10_000 });
      const at = await page.evaluate(where);
      const label = `${viewport.width} wide, motion ${reducedMotion}, finding ${findings.indexOf(target) + 1}`;
      assert.equal(at.drawn, 1, `${label}: the finding is marked ${at.drawn} times on screen`);
      assert.equal(at.id, target.id);
      assert.match(at.text, /the finding you were sent/i, 'the mark is colour alone');
      if (viewport.width >= 1024 && findings.indexOf(target) < 5) assert.equal(at.current, 'step', `${label}: the finding is on screen but its chart is not the one pinned beside it`);
      else assert.ok(at.top >= 60, `${label}: the finding starts under the bar at the top (${Math.round(at.top)}px)`);
    } finally { await context.close(); }
  }
  // an id the game doesn't have marks nothing and moves nothing
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/game/${game}?f=no-such-finding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    assert.equal(await page.locator('[data-shared]').count(), 0);
    assert.equal(await page.evaluate(() => window.scrollY), 0);
  } finally { await context.close(); }
});

test('every finding on a game page offers a link to itself, and carries the site\'s address for a screenshot', async () => {
  const findings = board.insights.filter((i) => i.kind !== 'balance');
  for (const viewport of [{ width: 1280, height: 860 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => { try { delete Navigator.prototype.share; } catch { /* no share sheet in this browser anyway */ } });
      await page.goto(`${BASE}/game/${game}`, { waitUntil: 'networkidle' });
      const drawn = await page.evaluate(() => [...document.querySelectorAll('[data-finding]')].filter((x) => x.getClientRects().length > 0)
        .map((x) => ({ id: x.dataset.finding, share: x.querySelectorAll('[data-share="finding"]').length })));
      assert.deepEqual(drawn.map((d) => d.id).sort(), findings.map((f) => f.id).sort(), `${viewport.width} wide: the findings on screen are not the board's`);
      assert.ok(drawn.every((d) => d.share === 1), `${viewport.width} wide: a finding has no share button, or two`);
      const one = findings[0];
      const button = page.locator(`[data-finding="${one.id.replace(/"/g, '\\"')}"]:visible [data-share="finding"]`);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await page.getByText('Link copied').first().waitFor();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${BASE}/game/${game}?f=${encodeURIComponent(one.id)}`);
      // the address a screenshot of a finding carries is the one the site calls itself by
      const marks = await page.evaluate(() => [...document.querySelectorAll('[data-site-mark]')].filter((x) => x.getClientRects().length > 0).map((x) => x.textContent));
      const host = new URL(canonical(await html(`/game/${game}`))).host.replace(/^www\./, '');
      assert.ok(marks.length >= Math.min(findings.length, 5), `${viewport.width} wide: only ${marks.length} findings carry the address`);
      assert.deepEqual([...new Set(marks)], [host]);
    } finally { await context.close(); }
  }
});

test('a game the site does not have still answers a picture (the plain card), never an error', async () => {
  for (const path of ['/game/nba-nonsense123/og', '/game/not-a-game/og', '/game/nba-nonsense123/og?f=x']) {
    const { width, height, bytes } = await png(`${BASE}${path}`);
    assert.deepEqual([width, height], [1200, 630]);
    assert.ok(bytes.length > 5_000);
  }
});

test('structured data: the site, a game as a sports event with its two teams, and breadcrumbs', async () => {
  const blocks = ld(await html(`/game/${game}`));
  const site = blocks.find((b) => b['@graph'])?.['@graph'] ?? [];
  assert.deepEqual(site.map((n) => n['@type']).sort(), ['Organization', 'WebSite']);
  const event = blocks.find((b) => b['@type'] === 'SportsEvent');
  assert.ok(event, 'no SportsEvent on a game page');
  assert.equal(event.name, board.label);
  assert.deepEqual([event.homeTeam, event.awayTeam], [{ '@type': 'SportsTeam', name: board.home.name }, { '@type': 'SportsTeam', name: board.away.name }]);
  assert.equal(event.startDate, board.start && !board.time_tbd ? board.start : undefined, 'a start is stated only when it is the real one');
  // what it is, never what will happen or what it costs
  assert.deepEqual(Object.keys(event).filter((k) => !['@context', '@type', 'name', 'url', 'sport', 'startDate', 'homeTeam', 'awayTeam'].includes(k)), []);
  const trail = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  assert.deepEqual(trail.itemListElement.map((i) => [i.position, new URL(i.item).pathname]), [[1, '/games'], [2, `/game/${game}`]]);
  const sport = board.sport, team = board.home.team;
  const teamTrail = ld(await html(`/teams/${sport}/${team}`)).find((b) => b['@type'] === 'BreadcrumbList');
  assert.deepEqual(teamTrail.itemListElement.map((i) => new URL(i.item).pathname), [`/league/${sport}`, `/teams/${sport}/${team}`]);
  const player = board.home.players?.[0]?.player_id?.replace(':', '-');
  if (player) {
    const playerPage = await fetch(`${BASE}/players/${player}`, { headers: { 'user-agent': 'Googlebot/2.1' } });
    if (playerPage.status === 200) {
      const playerTrail = ld(await playerPage.text()).find((b) => b['@type'] === 'BreadcrumbList');
      assert.deepEqual(playerTrail.itemListElement.map((i) => new URL(i.item).pathname), [`/league/${sport}`, `/teams/${sport}/${team}`, `/players/${player}`]);
    }
  }
  assert.equal(ld(await html('/game/nba-nonsense123')).filter((b) => b['@type'] === 'SportsEvent').length, 0, 'an unknown game was described as an event');
});

test('the sitemap is well-formed and lists games, teams and players beside the fixed pages', async () => {
  const res = await fetch(`${BASE}/sitemap.xml`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /xml/);
  const xml = await res.text();
  const page = await (await browser.newContext()).newPage();
  try {
    const parsed = await page.evaluate((text) => {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      return { error: doc.querySelector('parsererror')?.textContent ?? null, root: doc.documentElement.localName,
        urls: [...doc.querySelectorAll('url')].map((u) => ({ loc: u.querySelector('loc')?.textContent, mod: u.querySelector('lastmod')?.textContent ?? null })) };
    }, xml);
    assert.equal(parsed.error, null);
    assert.equal(parsed.root, 'urlset');
    const paths = parsed.urls.map((u) => new URL(u.loc).pathname);
    assert.equal(new Set(paths).size, paths.length, 'an address is listed twice');
    for (const fixed of ['/', '/games', '/findings', '/league/nba', '/privacy']) assert.ok(paths.includes(fixed), `${fixed} is missing`);
    assert.ok(paths.includes(`/game/${game}`), "tonight's game is not listed");
    assert.ok(paths.some((p) => p.startsWith('/teams/')) && paths.some((p) => p.startsWith('/players/')));
    assert.ok(!paths.some((p) => /^\/(lab|api|account)\b/.test(p) || p.includes('soc-') || p.startsWith('/league/soccer') || p.startsWith('/teams/soccer')), 'a private or unlisted page is in the sitemap');
    assert.equal(paths.some((p) => p.startsWith('/picklab')), PICKLAB);
    for (const u of parsed.urls) if (u.mod) assert.ok(!Number.isNaN(Date.parse(u.mod)) && Date.parse(u.mod) <= Date.now() + 60_000, `${u.loc} was last changed at ${u.mod}`);
    assert.ok(parsed.urls.find((u) => new URL(u.loc).pathname === `/game/${game}`).mod, 'a coming game has no last-changed time');
  } finally { await page.context().close(); }
});

test('a comparison, a league and each PickLab page carry their own title, description and address', async () => {
  const league = await (await fetch(`${BASE}/api/public/analytics/league/${board.sport}`)).json();
  const [a, b] = league.teams;
  const page = await html(`/compare?sport=${board.sport}&a=${a.team.toLowerCase()}&b=${b.team}`);
  assert.ok(title(page).startsWith(`${b.name} at ${a.name} · Compare`), `the comparison is titled ${title(page)}`);
  assert.equal(new URL(canonical(page)).pathname + new URL(canonical(page)).search, `/compare?sport=${board.sport}&a=${a.team}&b=${b.team}`);
  assert.ok(meta(page, 'description').includes(a.name) && meta(page, 'description').includes(b.name));
  const bare = await html('/compare?a=zzz&b=<script>');
  assert.equal(new URL(canonical(bare)).pathname + new URL(canonical(bare)).search, '/compare');
  assert.ok(title(bare).startsWith('Compare two teams'));
  assert.match(meta(await html('/league/nba'), 'description'), /NBA/);
  assert.match(meta(await html('/league/nfl'), 'description'), /NFL/);
  if (PICKLAB) {
    const pages = await Promise.all(['/picklab', '/picklab/experts', '/picklab/strategies'].map(async (path) => ({ path, page: await html(path) })));
    for (const { path, page } of pages) assert.equal(new URL(canonical(page)).pathname, path);
    assert.equal(new Set(pages.map(({ page }) => title(page))).size, 3);
    assert.equal(new Set(pages.map(({ page }) => meta(page, 'description'))).size, 3);
  }
});

test('none of it makes an unlaunched site indexable, and no ownership tag appears unasked', async () => {
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  const page = await html(`/game/${game}`);
  if (/Disallow: \/\s*$/m.test(robots)) {
    assert.match(page, /<meta name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(robots, /Sitemap:/);
  } else {
    assert.match(robots, /Sitemap: \S+\/sitemap\.xml/);  // a launched site: the sitemap is announced
    assert.doesNotMatch(page, /<meta name="robots" content="noindex/, 'a launched site keeps its game pages out of search');
    // PickLab by invitation is one line and a waitlist: it stays out of search results even on a launched site
    if (process.env.SITE_PICKLAB === 'invite') assert.match(await html('/picklab'), /<meta name="robots" content="noindex, nofollow"/);
  }
  if (!process.env.SITE_GSC) assert.doesNotMatch(page, /google-site-verification/);
});
