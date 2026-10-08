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
  await page.waitForSelector('path.country');
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

  await page.getByRole('button', { name: 'Recent changes' }).click();
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
  await page.waitForSelector('path.country');
  await expect(page.locator('.panel .icon-btn.star')).toHaveAttribute('aria-pressed', 'true');

  // On phones the ticker yields to an open panel, so close it before using the filter.
  await page.locator('.panel .icon-btn[aria-label="Close panel"]').click();
  await page.locator('.ticker-filter').click();
  await expect(page.locator('.ticker-filter')).toHaveAttribute('aria-pressed', 'true');
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
  await page.locator('.panel .watch-row .star').click();
  await expect(page.locator('.panel')).toContainText('Nothing starred yet');
  await noSeriousA11yIssues(page);
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

test('conflict panel shows who backs whom and the peace process; dossier lists sponsorship abroad', async ({ page }) => {
  await open(page, '#mode=conflicts&conflict=drc-east');
  const panel = page.locator('.panel');
  await expect(panel.locator('#conflict-actors')).toBeVisible();
  await expect(panel.locator('.actors svg')).toBeVisible();
  await expect(panel.locator('.actors .actor')).not.toHaveCount(0);
  await expect(panel.locator('#conflict-peace')).toContainText(/Peace process · [1-9]/);
  await expect(panel.locator('.peace li').first()).toContainText(/Roadmap|Talks|Agreement|Ceasefire|Setback|Mediation/);
  // A clickable backer opens that country's dossier.
  await panel.locator('.actors .backer.clickable').first().click();
  await expect(panel.locator('.eyebrow')).toContainText('Country dossier');
  await open(page, '#country=RWA');
  await expect(panel.locator('#dossier-sponsorship')).toContainText(/Backs parties abroad · [1-9]/);
  await panel.locator('#dossier-sponsorship + ul button').first().click();
  await expect(page).toHaveURL(/conflict=/);
  await noSeriousA11yIssues(page);
});
