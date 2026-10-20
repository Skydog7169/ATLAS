import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ramp } from '../src/lib/palette';

const NATO_BLUE = '#4f7cff';

async function open(page: Page, hash = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/' + hash, { waitUntil: 'networkidle' });
  // On the globe, countries on the far side have an empty path, so wait for one that is drawn.
  await page.waitForSelector('path.country[d^="M"]');
  return errors;
}

async function noSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
}

test('overview renders the world and passes an accessibility scan', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('path.country')).toHaveCount(177);
  expect(await page.locator('rect.microstate').count()).toBeGreaterThan(20);
  await noSeriousA11yIssues(page);
  expect(errors).toEqual([]);
});

test('bloc chips colour members and open the panel', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /^NATO —/ }).click();
  await expect(page).toHaveURL(/bloc=nato/);
  await expect(page.locator('.panel h2')).toContainText('North Atlantic');
  await expect(page.locator('path.country[data-iso="FRA"]')).toHaveAttribute('fill', NATO_BLUE);
  await expect(page.locator('path.country[data-iso="CHN"]')).not.toHaveAttribute('fill', NATO_BLUE);
  await expect(page.locator('.tile')).toHaveCount(3);
  await noSeriousA11yIssues(page);
});

test('compare mode shows shared members with stripes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'chip row scrolls on phones; covered on desktop');
  await open(page, '#mode=blocs&bloc=nato');
  await page.getByRole('button', { name: 'VS Compare' }).click();
  await page.getByRole('button', { name: /^EU —/ }).click();
  await expect(page).toHaveURL(/vs=eu/);
  await expect(page.locator('path.country[data-iso="FRA"]')).toHaveAttribute('fill', /url\(#stripes-/);
  await expect(page.locator('.panel')).toContainText('In both · 23');
});

test('conflicts mode: markers, panel, timeline replay and changes feed', async ({ page }) => {
  await open(page, '#mode=conflicts');
  await expect(page.locator('g.marker')).toHaveCount(31);
  await page.locator('g.marker[aria-label^="Sudan: civil war: "]').click({ force: true });
  await expect(page.locator('.panel h2')).toContainText('Sudan');
  await expect(page).toHaveURL(/conflict=sudan/);
  await page.locator('.panel .icon-btn[aria-label="Close panel"]').click();

  const slider = page.locator('.timeline input[type="range"]');
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(page).toHaveURL(/t=\d{4}-\d{2}/);
  expect(await page.locator('g.marker').count()).toBeLessThan(31);
  await page.getByRole('button', { name: 'Now', exact: true }).click();
  await expect(page.locator('g.marker')).toHaveCount(31);
  await noSeriousA11yIssues(page);

  await page.getByRole('button', { name: 'Recent changes' }).click();
  await expect(page.locator('.panel h2')).toContainText('Recent changes');
  // Defaults to the last week; 'All' is independent of today's date.
  await expect(page.getByRole('button', { name: '7 days', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  expect(await page.locator('.feed li').count()).toBeGreaterThan(10);
  // Grouped by what changed, with worded tags and same-level re-assessments folded away.
  await expect(page.locator('.feed-group[data-delta="new"] h3')).toContainText(/New · \d+/);
  await expect(page.locator('.feed-group[data-delta="up"] .feed-delta').first()).toContainText(/▲ Escalated · \w+ → \w+/);
  await expect(page.locator('.feed-same > summary')).toContainText(/\d+ re-assessments?, no change/);
  const title = page.locator('.feed .feed-title').first();
  expect(await title.evaluate((el) => getComputedStyle(el).textAlign)).toBe('left');
  await expect(page.locator('.panel a.text-btn', { hasText: 'RSS' })).toHaveAttribute('href', '/feed.xml');
});

test('search jumps to a conflict and to a microstate', async ({ page }) => {
  await open(page);
  await page.getByRole('searchbox').fill('houthi');
  await page.keyboard.press('Enter');
  await expect(page.locator('.panel h2')).toContainText('Yemen');
  await page.getByRole('searchbox').fill('malta');
  await page.keyboard.press('Enter');
  await expect(page.locator('.panel h2')).toContainText('Malta');
});

test('displacement layer tints countries and explains itself', async ({ page }) => {
  await open(page);
  await page.locator('.map-controls .icon-btn[aria-label="Data layers"]').click();
  await page.locator('.layer-list button[data-layer="displacement"]').click();
  await expect(page).toHaveURL(/layer=displacement/);
  await expect(page.locator('path.country[data-iso="SDN"]')).toHaveAttribute('fill', ramp('displacement')[5]!);
  await expect(page.locator('.legend')).toContainText('Forcibly displaced');
});

test('keyboard: map pans and zooms, markers are reachable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'no hardware keyboard on phones');
  await open(page, '#mode=conflicts');
  const svg = page.locator('.map-root svg');
  await svg.focus();
  const before = await page.locator('.map-root svg > g').first().getAttribute('transform');
  await page.keyboard.press('+');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  const after = await page.locator('.map-root svg > g').first().getAttribute('transform');
  expect(after).not.toBe(before);
  await page.keyboard.press('0');
  await page.waitForTimeout(400);
  await page.locator('g.marker').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.panel')).toBeVisible();
});

test('zooming in loads detailed geometry and labels', async ({ page }) => {
  await open(page, '#mode=blocs&country=DEU');
  await expect(page.locator('.country-label')).not.toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('path.country')).toHaveCount(241, { timeout: 15_000 });
});

test('about page opens and is shareable', async ({ page }) => {
  await open(page, '#about=1');
  await expect(page.locator('.panel h2')).toContainText('How ATLAS works');
  await noSeriousA11yIssues(page);
});

test('no horizontal scroll on phones', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone');
  await open(page, '#mode=conflicts&conflict=myanmar');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('country dossier has every section and a shareable link', async ({ page }) => {
  await open(page, '#mode=conflicts&country=SDN');
  const panel = page.locator('.panel');
  await expect(panel.locator('h2')).toContainText('Sudan');
  await expect(panel.locator('.eyebrow')).toContainText('Country dossier');
  for (const id of ['memberships', 'conflicts', 'displacement', 'figures', 'changes']) {
    await expect(panel.locator(`#dossier-${id}`)).toBeVisible();
  }
  await expect(panel.locator('.tile')).toHaveCount(6);
  await expect(panel.locator('#dossier-changes')).toContainText(/Recent changes · [1-9]/);
  // A country with no tracked conflict still gets the full dossier.
  await open(page, '#country=ISL');
  await expect(panel.locator('h2')).toContainText('Iceland');
  await expect(panel.locator('#dossier-conflicts + p')).toContainText('No tracked conflict');
  await expect(panel.locator('#dossier-figures')).toBeVisible();
  await noSeriousA11yIssues(page);
});

test('ticker shows the ten newest items, pauses on hover and opens them', async ({ page }) => {
  await open(page);
  const ticker = page.locator('.ticker');
  await expect(ticker).toBeVisible();
  const track = ticker.locator('.ticker-track:not([aria-hidden])');
  await expect(track.locator('li')).toHaveCount(10);
  await expect(ticker.locator('.ticker-track[aria-hidden="true"] li')).toHaveCount(10);
  await ticker.locator('.ticker-viewport').hover({ position: { x: 120, y: 10 } });
  const paused = await track.evaluate((el) => getComputedStyle(el).animationPlayState);
  expect(paused).toBe('paused');
  const first = track.locator('button').first();
  const title = (await first.locator('.title').textContent()) ?? '';
  await expect(first.locator('.tag')).toHaveText(/^(Conflict|Unrest) · (High|Medium|Low|Latent)$|^Membership$/);
  await first.click();
  await expect(page.locator('.panel h2')).toContainText(title.split(':')[0]!.slice(0, 12));
});

test('ticker can be paused, and the choice persists', async ({ page }) => {
  await open(page);
  const ticker = page.locator('.ticker');
  const pause = ticker.getByRole('button', { name: 'Pause feed' });
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect(ticker).toHaveClass(/paused/);
  expect(await ticker.locator('.ticker-track').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(ticker.locator('.ticker-track[aria-hidden="true"]')).toBeHidden();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('.ticker')).toHaveClass(/paused/);
  await expect(page.locator('.ticker-filter')).toHaveAttribute('aria-label', 'Show only starred items');
});

test('watchlist: stars survive reload and filter the ticker and feed', async ({ page }) => {
  await open(page, '#mode=conflicts&conflict=sudan');
  const star = page.locator('.panel .icon-btn.star');
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.header .icon-btn[aria-label="Watchlist"]')).toHaveAttribute('data-count', '1');

  await page.reload({ waitUntil: 'networkidle' });
  // On the globe, countries on the far side have an empty path, so wait for one that is drawn.
  await page.waitForSelector('path.country[d^="M"]');
  await expect(page.locator('.panel .icon-btn.star')).toHaveAttribute('aria-pressed', 'true');

  // On phones the ticker yields to an open panel, so close it before using the filter.
  await page.locator('.panel .icon-btn[aria-label="Close panel"]').click();
  await page.locator('.ticker-filter').click();
  await expect(page.locator('.ticker-filter')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ticker-label')).toContainText('STARRED');
  const items = page.locator('.ticker-track:not([aria-hidden]) button');
  expect(await items.count()).toBeGreaterThan(0);
  for (const id of await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))) expect(id).toBe('sudan');

  await page.getByRole('button', { name: 'Recent changes' }).click();
  await expect(page.locator('.panel .watch-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  const feed = page.locator('.panel .feed li');
  expect(await feed.count()).toBeGreaterThan(0);
  await expect(feed.first()).toContainText('Sudan');

  await page.locator('.header .icon-btn[aria-label="Watchlist"]').click();
  await expect(page).toHaveURL(/watchlist=1/);
  await expect(page.locator('.panel h2')).toContainText('Watchlist');
  await expect(page.locator('.panel .watch-row .watch-meta').first()).toContainText(/Updated \w+ \d+ · Conflict · High/);
  await page.locator('.panel .watch-row .star').click();
  await expect(page.locator('.panel')).toContainText('Nothing starred yet');
  // The empty state offers one-tap suggestions.
  await expect(page.locator('.panel .watch-ghost')).toContainText('Starred items appear here');
  await page.locator('.panel .watch-row .icon-btn.star').first().click();
  await expect(page.locator('.header .icon-btn[aria-label="Watchlist"]')).toHaveAttribute('data-count', '1');
  await noSeriousA11yIssues(page);
});

test('watchlist: stale ids are labelled and removable, and other tabs merge', async ({ page, context }) => {
  await open(page);
  await page.evaluate(() => localStorage.setItem('atlas.watchlist.v1', JSON.stringify([{ kind: 'conflict', id: 'old-war-2023' }])));
  await open(page, '#watchlist=1');
  // A hash-only navigation keeps the page, so reload to read the seeded storage.
  await page.reload({ waitUntil: 'networkidle' });
  const panel = page.locator('.panel');
  await expect(panel.locator('.watch-gone')).toContainText('Removed or renamed in a data update');
  await expect(panel.locator('.watch-gone button')).toHaveText('Remove');
  await expect(page.locator('.header .icon-btn[aria-label="Watchlist"]')).not.toHaveAttribute('data-count', /.*/);

  // A second tab stars something; this tab picks it up and a later toggle here keeps it.
  const other = await context.newPage();
  await other.goto('/#mode=conflicts&conflict=sudan', { waitUntil: 'networkidle' });
  await other.locator('.panel .icon-btn.star').click();
  await expect(panel).toContainText('Sudan');
  await panel.locator('.watch-gone button').click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('atlas.watchlist.v1') ?? '[]'));
  expect(stored).toEqual([{ kind: 'conflict', id: 'sudan' }]);
  await other.close();
});

test('since-your-last-visit strip tracks seen items and agrees with the panel it opens', async ({ page }) => {
  await open(page);
  await expect(page.locator('.since')).toHaveCount(0);
  // A first visit seeds the seen-set silently.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('atlas.lastVisit.v2') ?? 'null'));
  expect(stored.seen.length).toBeGreaterThan(40);
  // A visitor from the v1 era is migrated: everything dated on or after their stamp is unseen once.
  await page.evaluate(() => {
    localStorage.removeItem('atlas.lastVisit.v2');
    localStorage.setItem('atlas.lastVisit.v1', '2020-01-01');
    localStorage.setItem('atlas.watchlist.only.v1', '1');
  });
  await page.reload({ waitUntil: 'networkidle' });
  // On the globe, countries on the far side have an empty path, so wait for one that is drawn.
  await page.waitForSelector('path.country[d^="M"]');
  const strip = page.locator('.since');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText(/Since Jan 1, 2020 · \d+ changes/);
  const total = Number(await strip.locator('.since-label b').first().textContent());
  await expect(page.locator('.readout-btn .readout-dot')).toHaveCount(1);

  // '+N more' opens the panel on the same window, unfiltered, so it lists exactly the strip's count.
  await strip.locator('.since-more').click();
  await expect(page).toHaveURL(/changes=since/);
  const panel = page.locator('.panel');
  await expect(panel.locator('.since-chip')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('.since-chip')).toContainText(`· ${total}`);
  await expect(panel.locator('.watch-toggle')).toHaveAttribute('aria-pressed', 'false');
  expect(await panel.locator('.feed li').count()).toBe(total);

  // Mark read in the panel clears the strip too.
  await panel.getByRole('button', { name: 'Mark read' }).click();
  await expect(page.locator('.since')).toHaveCount(0);
  await page.reload({ waitUntil: 'networkidle' });
  // On the globe, countries on the far side have an empty path, so wait for one that is drawn.
  await page.waitForSelector('path.country[d^="M"]');
  await expect(page.locator('.since')).toHaveCount(0);

  // An item that goes live after Mark read is unseen whatever its date.
  await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('atlas.lastVisit.v2')!);
    v.seen = v.seen.filter((k: string) => !k.startsWith('conflict:sudan:'));
    localStorage.setItem('atlas.lastVisit.v2', JSON.stringify(v));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('path.country[d^="M"]');
  await expect(strip).toBeVisible();
  await strip.locator('.since-list button').first().click();
  await expect(page.locator('.panel')).toBeVisible();
  await strip.getByRole('button', { name: 'Mark read' }).click();
  await expect(page.locator('.since')).toHaveCount(0);
});

test('feeds are served alongside the app', async ({ request }) => {
  const rss = await request.get('/feed.xml');
  expect(rss.ok()).toBe(true);
  expect(await rss.text()).toContain('<rss version="2.0"');
  const json = await request.get('/feed.json');
  expect(json.ok()).toBe(true);
  expect((await json.json()).version).toBe('https://jsonfeed.org/version/1.1');
});

test('data layers: sanctions, elections and nuclear tint the map with legends', async ({ page }) => {
  await open(page);
  await page.locator('.map-controls .icon-btn[aria-label="Data layers"]').click();
  await page.locator('.layer-list button[data-layer="sanctions"]').click();
  await expect(page).toHaveURL(/layer=sanctions/);
  await expect(page.locator('path.country[data-iso="RUS"]')).toHaveAttribute('fill', ramp('sanctions')[4]!);
  await expect(page.locator('path.country[data-iso="FRA"]')).toHaveAttribute('fill', 'var(--land)');
  await expect(page.locator('.legend')).toContainText('Sanctions regimes');
  await expect(page.locator('.legend')).toContainText('fetched');

  await open(page, '#layer=elections');
  await expect(page.locator('.legend')).toContainText('Next national election');
  await expect(page.locator('path.country[data-iso="USA"]')).toHaveAttribute('fill', /--ramp-elections/);
  expect([ramp('elections')[3], ramp('elections')[4]]).toContain(await page.locator('path.country[data-iso="USA"]').getAttribute('fill'));

  await open(page, '#layer=nuclear');
  await expect(page.locator('.legend')).toContainText('Nuclear-armed · 9');
  await expect(page.locator('path.country[data-iso="CHN"]')).toHaveAttribute('fill', '#ff8ee6');
  // Umbrella states are hatched, so they read apart from the armed states without relying on hue.
  await expect(page.locator('path.country[data-iso="POL"]')).toHaveAttribute('fill', 'url(#hatch-3b7dd8)');
  await expect(page.locator('path.country[data-iso="BRA"]')).toHaveAttribute('fill', 'var(--land)');

  // Off returns to the mode colours and clears the URL.
  await page.locator('.map-controls .icon-btn[aria-label="Data layers"]').click();
  await page.getByRole('menuitemradio', { name: /^Off/ }).click();
  await expect(page).not.toHaveURL(/layer=/);
  await noSeriousA11yIssues(page);
});

test('dossier lists sanctions regimes, the next election and nuclear status', async ({ page }) => {
  await open(page, '#country=IRN');
  const panel = page.locator('.panel');
  await expect(panel.locator('#dossier-sanctions')).toContainText(/Sanctions · [3-9]/);
  await expect(panel.locator('#dossier-sanctions + ul a').first()).toHaveAttribute('href', /^https:\/\//);
  await expect(panel.locator('#dossier-elections + ul')).toContainText(/election/i);
  await expect(panel.locator('#dossier-nuclear + ul')).toContainText('Threshold state');
  await open(page, '#country=BRA');
  await expect(panel.locator('#dossier-sanctions + p')).toContainText('No UN, US or EU regime');
  await expect(panel.locator('#dossier-nuclear')).toHaveCount(0);
});

test('power and trade layers: chokepoint diamonds open a panel, military and trade tints have legends', async ({ page }) => {
  await open(page, '#layer=chokepoints');
  await expect(page.locator('.legend')).toContainText('Maritime chokepoints');
  await expect(page.locator('g.marker[data-shape="diamond"]')).toHaveCount(8);
  await page.locator('g.marker[aria-label^="Strait of Hormuz"]').click({ force: true });
  await expect(page).toHaveURL(/chokepoint=hormuz/);
  const panel = page.locator('.panel');
  await expect(panel.locator('h2')).toContainText('Strait of Hormuz');
  await expect(panel.locator('#chokepoint-status + ol li')).not.toHaveCount(0);
  await panel.locator('#chokepoint-conflicts + ul button').first().click();
  await expect(page).toHaveURL(/conflict=/);

  await open(page, '#layer=military');
  await expect(page.locator('.legend')).toContainText('Foreign military presence');
  await expect(page.locator('path.country[data-iso="DJI"]')).toHaveAttribute('fill', ramp('military')[4]!);
  await expect(page.locator('path.country[data-iso="BRA"]')).toHaveAttribute('fill', 'var(--land)');

  await open(page, '#layer=trade&country=MEX');
  await expect(page.locator('.legend')).toContainText('Export dependence');
  await expect(page.locator('path.country[data-iso="MEX"]')).toHaveAttribute('fill', /#4f8cff/);
  await expect(panel.locator('#dossier-trade + ul')).toContainText('United States');
  await open(page, '#country=DJI');
  await expect(panel.locator('#dossier-military')).toContainText(/Foreign forces present · [1-9]/);
});

test('conflict panel shows who backs whom and the peace process; dossier lists sponsorship abroad', async ({ page }) => {
  await open(page, '#mode=conflicts&conflict=drc-east');
  const panel = page.locator('.panel');
  await expect(panel.locator('#conflict-actors')).toBeVisible();
  // The diagram is HTML: text stays at its CSS size instead of scaling with the panel.
  await expect(panel.locator('.actors .actor-side').first()).toBeVisible();
  expect(await panel.locator('.actors .actor-name').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
  await expect(panel.locator('.actors .actor')).not.toHaveCount(0);
  await expect(panel.locator('#conflict-peace')).toContainText(/Peace process · [1-9]/);
  await expect(panel.locator('.peace li').first()).toContainText(/Roadmap|Talks|Agreement|Ceasefire|Setback|Mediation/);
  // A backer (listed as a badge under the diagram) opens that country's dossier.
  await expect(panel.locator('.actors .backer.clickable')).not.toHaveCount(0);
  await panel.locator('#conflict-actors ~ .badges .badge').first().click();
  await expect(panel.locator('.eyebrow')).toContainText('Country dossier');
  await open(page, '#country=RWA');
  await expect(panel.locator('#dossier-sponsorship')).toContainText(/Backs parties abroad · [1-9]/);
  await panel.locator('#dossier-sponsorship + ul button').first().click();
  await expect(page).toHaveURL(/conflict=/);
  await noSeriousA11yIssues(page);
});

test('globe view: renders an orthographic globe, rotates with the keyboard and keeps the centre in the link', async ({ page }) => {
  await open(page, '#view=globe');
  const globe = page.locator('.map-root.globe[data-view="globe"]');
  await expect(globe).toBeVisible();
  await expect(globe.locator('path.sphere')).toBeVisible();
  expect(await globe.locator('path.country').count()).toBeGreaterThan(100);
  await expect(globe).toHaveAttribute('data-rotation', '15,20');
  await globe.locator('svg').focus();
  await page.keyboard.press('ArrowRight');
  await expect(globe).toHaveAttribute('data-rotation', '27,20');
  await expect(page).toHaveURL(/view=globe/);
  await expect(page).toHaveURL(/rot=27(,|%2C)20/);
  // A dragged globe reports its new centre when the pointer lifts.
  const box = (await globe.locator('svg').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await globe.getAttribute('data-rotation'))?.split(',')[0]).not.toBe('27');
  // Flat map button switches back and drops the globe parameters.
  await page.getByRole('button', { name: 'Flat map' }).click();
  await expect(page.locator('.map-root:not(.globe)')).toBeVisible();
  await expect(page).not.toHaveURL(/view=globe/);
  await noSeriousA11yIssues(page);
});

test('briefing mode hides the chrome and cycles captions; embed hides the chrome and links back', async ({ page }) => {
  await open(page, '#brief=1');
  await expect(page.locator('.app[data-brief="true"]')).toBeVisible();
  await expect(page.locator('.header')).toBeHidden();
  await expect(page.locator('.ticker')).toBeHidden();
  const card = page.getByRole('region', { name: 'Briefing' });
  await expect(card).toBeVisible();
  await expect(card.locator('.eyebrow')).toContainText('Live conflict');
  await expect(card.locator('.brief-count')).toContainText(/^1 \/ \d+$/);
  await expect(page).toHaveURL(/mode=conflicts/);
  await card.getByRole('button', { name: 'Next' }).click();
  await expect(card.locator('.brief-count')).toContainText(/^2 \/ \d+$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.app[data-brief="false"]')).toBeVisible();
  await expect(page.locator('.header')).toBeVisible();
  await expect(page).not.toHaveURL(/brief=1/);
  // Opening an item leaves the briefing in that item's panel.
  await page.getByRole('button', { name: 'Start briefing' }).click();
  await page.getByRole('region', { name: 'Briefing' }).getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('.panel h2')).toBeVisible();
  await expect(page).toHaveURL(/conflict=/);

  await open(page, '#embed=1&layer=sanctions');
  await expect(page.locator('.app[data-embed="true"]')).toBeVisible();
  await expect(page.locator('.header')).toBeHidden();
  await expect(page.locator('.legend')).toBeVisible();
  const badge = page.getByRole('link', { name: 'Open this view in ATLAS' });
  await expect(badge).toBeVisible();
  expect(await badge.getAttribute('href')).toMatch(/layer=sanctions/);
  expect(await badge.getAttribute('href')).not.toMatch(/embed/);
  await expect(page.getByRole('button', { name: 'Start briefing' })).toHaveCount(0);
  await noSeriousA11yIssues(page);
});

test('one-tap PNG export downloads a stamped image', async ({ page }) => {
  await open(page, '#layer=displacement');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^atlas-displacement-\d{4}-\d{2}-\d{2}\.png$/);
  const path = await file.path();
  const { statSync, readFileSync } = await import('node:fs');
  expect(statSync(path).size).toBeGreaterThan(10_000);
  // PNG signature.
  expect(readFileSync(path).subarray(0, 4).toString('hex')).toBe('89504e47');
});

test('analysis: bloc trend charts and the relationship view', async ({ page }) => {
  await open(page, '#mode=blocs&bloc=nato');
  const panel = page.locator('.panel');
  await expect(panel.locator('#bloc-trends')).toContainText('Since 1990');
  await expect(panel.locator('.trend')).toHaveCount(2);
  await expect(panel.locator('.trend').first()).toContainText(/32/);
  await expect(panel.locator('.trend table tr')).not.toHaveCount(0);

  await open(page, '#country=UKR');
  await panel.getByRole('button', { name: 'Relationship with…' }).click();
  await expect(page).toHaveURL(/pair=UKR/);
  await panel.locator('#pair-q').fill('russ');
  await panel.locator('.link-list button', { hasText: 'Russia' }).first().click();
  await expect(page).toHaveURL(/pair=UKR(,|%2C)RUS/);
  await expect(panel.locator('h2')).toContainText('Ukraine');
  await expect(panel.locator('h2')).toContainText('Russia');
  await expect(panel.locator('#pair-conflicts')).toContainText(/Conflicts · [1-9]/);
  await expect(panel.locator('#pair-trade + .tiles .tile')).toHaveCount(2);
  await panel.locator('#pair-conflicts + ul button').first().click();
  await expect(page).toHaveURL(/conflict=russia-ukraine/);

  await open(page, '#pair=FRA,DEU');
  await expect(panel.locator('#pair-blocs')).toContainText(/Shared blocs · [3-9]/);
  await noSeriousA11yIssues(page);
});

test('civil unrest: layer tints and marks episodes, panel, dossier row, search and ticker', async ({ page }) => {
  await open(page);
  await page.locator('.map-controls .icon-btn[aria-label="Data layers"]').click();
  await page.locator('.layer-list button[data-layer="unrest"]').click();
  await expect(page).toHaveURL(/layer=unrest/);
  await expect(page.locator('.legend')).toContainText(/Civil unrest · \d+/);
  await expect(page.locator('.legend .swatch.triangle')).toHaveCount(4);
  const triangles = page.locator('g.marker[data-shape="triangle"]');
  expect(await triangles.count()).toBeGreaterThanOrEqual(25);
  await expect(page.locator('path.country[data-iso="KEN"]')).toHaveAttribute('fill', /color-mix/);
  await expect(page.locator('path.country[data-iso="BRA"]')).toHaveAttribute('fill', 'var(--land)');

  await page.locator('g.marker[aria-label^="Kenya Gen Z protests"]').click({ force: true });
  await expect(page).toHaveURL(/unrest=kenya-gen-z-protests/);
  const panel = page.locator('.panel');
  await expect(panel.locator('h2')).toContainText('Kenya Gen Z protests');
  await expect(panel.locator('.eyebrow')).toContainText('Protest movement');
  await expect(panel.locator('#unrest-trigger + p')).toContainText(/Finance Bill/);
  await expect(panel.locator('#unrest-assessments + ol li')).not.toHaveCount(0);
  await panel.getByRole('button', { name: /Add Kenya Gen Z protests to watchlist/ }).click();
  await expect(panel.getByRole('button', { name: /Remove Kenya Gen Z protests from watchlist/ })).toBeVisible();

  // The country badge opens the dossier, which lists the episode and links back.
  await panel.locator('.badges button', { hasText: 'Kenya' }).click();
  await expect(panel.locator('.eyebrow')).toContainText('Country dossier');
  await expect(panel.locator('#dossier-unrest')).toContainText('Civil unrest');
  await panel.locator('#dossier-unrest + ul button').first().click();
  await expect(page).toHaveURL(/unrest=kenya-gen-z-protests/);

  // Search finds episodes and labels them by kind; the watchlist panel groups them.
  await page.getByRole('searchbox').fill('serbia anti');
  await expect(page.locator('.search-results, [role="listbox"]').first()).toContainText('Protest movement');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/unrest=serbia-anti-corruption-protests/);
  await open(page, '#watchlist=1');
  await expect(page.locator('.panel')).toContainText('Unrest · 1');
  await noSeriousA11yIssues(page);
});

/**
 * axe's colour-contrast rule gives up ("incomplete") on text over the HUD
 * pseudo-elements (scanlines, corner brackets), so the default scan cannot see
 * a contrast failure. With them stripped it can, in both themes.
 */
async function noContrastFailures(page: Page) {
  await page.addStyleTag({ content: '*::before, *::after { content: none !important; } .stage::after { display: none !important; }' });
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  const nodes = results.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary?.split('\n').at(-1)?.trim()}`));
  expect(nodes).toEqual([]);
}

for (const scheme of ['dark', 'light'] as const) {
  test(`text contrast holds with the decorative layers removed (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, '#mode=conflicts&conflict=sudan');
    await noContrastFailures(page);
    await open(page, '#mode=blocs&country=UKR');
    await noContrastFailures(page);
    await open(page, '#layer=sanctions');
    await noContrastFailures(page);
  });
}

test('light theme keeps every ramp in order: the top class is the darkest', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page, '#layer=sanctions');
  const lum = await page.locator('.legend .swatch').evaluateAll((els) =>
    els.map((el) => {
      const probe = document.createElement('canvas').getContext('2d')!;
      probe.fillStyle = getComputedStyle(el).backgroundColor;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    }),
  );
  for (let i = 1; i < lum.length; i++) expect(lum[i]!).toBeLessThan(lum[i - 1]!);
});

test('focus is visible on chamfered chips, text buttons and pressed toggles', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'no hardware keyboard on phones');
  await open(page, '#mode=blocs&bloc=nato');
  await page.mouse.move(5, 5);
  const targets = [page.locator('.chip-row .chip[aria-pressed="true"]').first(), page.locator('.panel .text-btn').first(), page.locator('.header .segmented button[aria-pressed="true"]')];
  for (const t of targets) {
    await page.keyboard.press('Shift');
    await t.evaluate((el) => (el as HTMLElement).blur());
    const before = await t.screenshot({ animations: 'disabled' });
    await t.focus();
    expect(await t.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    const after = await t.screenshot({ animations: 'disabled' });
    expect(after.equals(before), await t.evaluate((el) => el.outerHTML.slice(0, 80))).toBe(false);
  }
});

test('embeds default to the dark theme whatever the reader prefers, unless the link names one', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page, '#mode=conflicts&embed=1');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // A different embed is a fresh page load, not a hash change within this one.
  await page.goto('about:blank');
  await open(page, '#mode=conflicts&embed=1&theme=light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page).toHaveURL(/theme=light/);
});

test('markers state their intensity and the most intense come first in tab order', async ({ page }) => {
  await open(page, '#mode=conflicts');
  const labels = await page.locator('g.marker').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  expect(labels[0]).toMatch(/: high intensity$/);
  expect(labels.at(-1)).toMatch(/: (latent|low)/);
  await expect(page.locator('.map-root svg')).toHaveAttribute('aria-roledescription', 'map');
  await expect(page.locator('h1')).toHaveText('ATLAS geopolitical map');
  await expect(page.locator('.legend h2.legend-title')).toHaveText('Conflict intensity');
});

test('truth: theatre fills, outlines abroad, protective sanctions, Palestine and Kosovo displacement, Greenland in NATO', async ({ page }) => {
  await open(page, '#mode=conflicts');
  await expect(page.locator('path.country[data-iso="UKR"]')).toHaveAttribute('fill', /color-mix/);
  await expect(page.locator('path.country[data-iso="USA"]')).toHaveAttribute('fill', 'var(--land)');
  await expect(page.locator('path.country[data-iso="USA"]')).toHaveAttribute('data-outline', 'true');
  await expect(page.locator('path.country[data-iso="SAU"]')).toHaveAttribute('data-outline', 'true');
  await expect(page.locator('.legend')).toContainText('Party to a conflict abroad');

  await open(page, '#layer=sanctions');
  await expect(page.locator('path.country[data-iso="UKR"]')).toHaveAttribute('fill', 'var(--land)');
  await expect(page.locator('path.country[data-iso="MDA"]')).toHaveAttribute('fill', 'var(--land)');
  await expect(page.locator('path.country[data-iso="CUB"]')).toHaveAttribute('fill', /^url\(#hatch/);
  await open(page, '#country=UKR');
  const panel = page.locator('.panel');
  await expect(panel.locator('#dossier-sanctions')).toContainText('Sanctions · 0');
  await expect(panel).toContainText('Regimes concerning this country (aimed at others) · 3');
  await expect(panel.locator('#dossier-memberships ~ ul').first()).toContainText('Candidate');

  await open(page, '#layer=displacement');
  await expect(page.locator('path.country[data-iso="PSE"]')).toHaveAttribute('fill', /^url\(#hatch/);
  await expect(page.locator('path.country[data-iso="UNK"]')).toHaveAttribute('fill', 'var(--land)');
  await open(page, '#country=UNK');
  await expect(panel).toContainText('UNHCR reports Kosovo together with Serbia');

  await open(page, '#bloc=nato');
  await expect(page.locator('path.country[data-iso="GRL"]')).toHaveAttribute('fill', NATO_BLUE);
  await expect(page.locator('path.country[data-iso="PRI"]')).toHaveAttribute('opacity', '0.55');

  await open(page, '#pair=GBR,RUS');
  await expect(panel.locator('#pair-sanctions + p')).toContainText('Not tracked for this pair');
  await noSeriousA11yIssues(page);
});
