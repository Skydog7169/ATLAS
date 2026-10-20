import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

/** On the narrowest phones Changes lives in the header's More menu. */
async function openChanges(page: Page) {
  const direct = page.locator('.header .icon-btn[aria-label="Recent changes"]');
  if (await direct.isVisible()) return direct.click();
  await page.locator('.header .icon-btn[aria-label="More"]').click();
  await page.locator('.more-list').getByRole('button', { name: 'Recent changes' }).click();
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
  await page.getByRole('button', { name: 'NATO', exact: true }).click();
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
  await page.getByRole('button', { name: 'EU', exact: true }).click();
  await expect(page).toHaveURL(/vs=eu/);
  await expect(page.locator('path.country[data-iso="FRA"]')).toHaveAttribute('fill', /url\(#stripes-/);
  await expect(page.locator('.panel')).toContainText('In both · 23');
});

test('conflicts mode: markers, panel, timeline replay and changes feed', async ({ page }) => {
  await open(page, '#mode=conflicts');
  await expect(page.locator('g.marker')).toHaveCount(31);
  await page.locator('g.marker[aria-label="Sudan civil war"]').click({ force: true });
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

  await openChanges(page);
  await expect(page.locator('.panel h2')).toContainText('Recent changes');
  expect(await page.locator('.feed li').count()).toBeGreaterThan(10);
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
  await expect(page.locator('path.country[data-iso="SDN"]')).toHaveAttribute('fill', '#dd8bff');
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
  await first.click();
  await expect(page.locator('.panel h2')).toContainText(title.split(':')[0]!.slice(0, 12));
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
  const items = page.locator('.ticker-track:not([aria-hidden]) button');
  expect(await items.count()).toBeGreaterThan(0);
  for (const id of await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))) expect(id).toBe('sudan');

  await openChanges(page);
  await expect(page.locator('.panel .watch-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  const feed = page.locator('.panel .feed li');
  expect(await feed.count()).toBeGreaterThan(0);
  await expect(feed.first()).toContainText('Sudan');

  await page.locator('.header .icon-btn[aria-label="Watchlist"]').click();
  await expect(page).toHaveURL(/watchlist=1/);
  await expect(page.locator('.panel h2')).toContainText('Watchlist');
  await page.locator('.panel .watch-row .star').click();
  await expect(page.locator('.panel')).toContainText('Nothing starred yet');
  await noSeriousA11yIssues(page);
});

test('since-your-last-visit strip appears for returning visitors and clears when read', async ({ page }) => {
  await open(page);
  await expect(page.locator('.since')).toHaveCount(0);
  const stored = await page.evaluate(() => localStorage.getItem('atlas.lastVisit.v1'));
  expect(stored).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.evaluate(() => localStorage.setItem('atlas.lastVisit.v1', '2020-01-01'));
  await page.reload({ waitUntil: 'networkidle' });
  // On the globe, countries on the far side have an empty path, so wait for one that is drawn.
  await page.waitForSelector('path.country[d^="M"]');
  const strip = page.locator('.since');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText(/Since Jan 1, 2020 · \d+ changes/);
  await strip.locator('.since-list button').first().click();
  await expect(page.locator('.panel')).toBeVisible();
  await strip.getByRole('button', { name: 'Mark read' }).click();
  await expect(page.locator('.since')).toHaveCount(0);
  await page.reload({ waitUntil: 'networkidle' });
  // On the globe, countries on the far side have an empty path, so wait for one that is drawn.
  await page.waitForSelector('path.country[d^="M"]');
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
  await expect(page.locator('path.country[data-iso="RUS"]')).toHaveAttribute('fill', '#ffd166');
  await expect(page.locator('path.country[data-iso="FRA"]')).toHaveAttribute('fill', 'var(--land)');
  await expect(page.locator('.legend')).toContainText('Sanctions regimes');
  await expect(page.locator('.legend')).toContainText('fetched');

  await open(page, '#layer=elections');
  await expect(page.locator('.legend')).toContainText('Next national election');
  await expect(page.locator('path.country[data-iso="USA"]')).toHaveAttribute('fill', /#8cff7a|#3fb04a/);

  await open(page, '#layer=nuclear');
  await expect(page.locator('.legend')).toContainText('Nuclear-armed · 9');
  await expect(page.locator('path.country[data-iso="CHN"]')).toHaveAttribute('fill', '#ff4fd8');
  await expect(page.locator('path.country[data-iso="POL"]')).toHaveAttribute('fill', '#3b7dd8');
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
  await expect(page.locator('path.country[data-iso="DJI"]')).toHaveAttribute('fill', '#9fc0ff');
  await expect(page.locator('path.country[data-iso="BRA"]')).toHaveAttribute('fill', 'var(--land)');

  await open(page, '#layer=trade&country=MEX');
  await expect(page.locator('.legend')).toContainText('Export dependence');
  await expect(page.locator('path.country[data-iso="MEX"]')).toHaveAttribute('fill', /#4f8cff/);
  await expect(panel.locator('#dossier-trade + ul')).toContainText('United States');
  await open(page, '#country=DJI');
  await expect(panel.locator('#dossier-military')).toContainText(/Military presence · [1-9]/);
});

test('conflict panel shows who backs whom and the peace process; dossier lists sponsorship abroad', async ({ page }) => {
  await open(page, '#mode=conflicts&conflict=drc-east');
  const panel = page.locator('.panel');
  await expect(panel.locator('#conflict-actors')).toBeVisible();
  await expect(panel.locator('.actors svg')).toBeVisible();
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
  await expect(card.locator('.eyebrow')).toContainText('High intensity');
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

test('camera frames the subject in the uncovered area: phone sheet, desktop panel, pairs', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'phone') {
    await open(page, '#mode=conflicts&conflict=sudan');
    const sheet = (await page.locator('.panel').boundingBox())!;
    const marker = page.locator('g.marker[data-selected="true"]');
    await expect.poll(async () => (await marker.boundingBox())!.y + (await marker.boundingBox())!.height).toBeLessThan(sheet.y);
    // Recentre stays reachable above the sheet.
    const recentre = page.getByRole('button', { name: 'Recentre on selection' });
    await expect(recentre).toBeVisible();
    expect((await recentre.boundingBox())!.y + 44).toBeLessThanOrEqual(sheet.y);
    // The legend collapses to a pill that can be expanded.
    await expect(page.locator('.legend-dock')).toHaveAttribute('data-collapsed', 'true');
    await page.getByRole('button', { name: 'Expand legend' }).click();
    await expect(page.locator('.legend-dock')).toHaveAttribute('data-collapsed', 'false');
    return;
  }
  await open(page, '#mode=blocs&bloc=asean&selbloc=asean');
  const panel = (await page.locator('.panel').boundingBox())!;
  await expect
    .poll(async () => {
      const box = await page.locator('path.country[data-iso="THA"]').boundingBox();
      return box ? box.x + box.width : Infinity;
    })
    .toBeLessThan(panel.x);
  await page.goto('/#pair=USA,CHN');
  await expect(page.locator('path.country[data-iso="USA"]')).toHaveAttribute('fill', 'var(--accent)');
  await expect(page.locator('path.country[data-iso="CHN"]')).toHaveAttribute('fill', 'var(--warn)');
  await expect(page.locator('path.country[data-iso="CHN"]')).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('path.country[data-iso="FRA"]')).toHaveAttribute('opacity', '0.55');
});

test('globe toggle keeps the selection in view instead of resetting', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'only recentre and layers stay above the phone sheet');
  await open(page, '#country=JPN');
  await page.locator('.map-controls .icon-btn[aria-label="Globe view"]').click();
  const globe = page.locator('.map-root.globe');
  await expect.poll(async () => Number((await globe.getAttribute('data-rotation'))?.split(',')[0])).toBeGreaterThan(120);
  await expect(page.locator('path.country[data-iso="JPN"]')).toHaveAttribute('d', /^M/);
});

test('relationship picker accepts a map click for the second country', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the sheet covers most targets; covered on desktop');
  await open(page, '#pair=IND');
  await expect(page.locator('.pair-hint')).toBeVisible();
  // Brazil is off-screen while the camera frames India; the click handler is what matters here.
  await page.locator('path.country[data-iso="BRA"]').dispatchEvent('click');
  await expect(page).toHaveURL(/pair=IND(,|%2C)BRA/);
});
