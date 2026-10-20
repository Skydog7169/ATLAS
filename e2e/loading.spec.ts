import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function open(page: Page, hash = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/' + hash, { waitUntil: 'networkidle' });
  await page.waitForSelector('path.country[d^="M"]');
  return errors;
}

test('search finds the names people type, two-country pairs, places and layers', async ({ page }) => {
  await open(page);
  const box = page.getByRole('searchbox');
  for (const [q, iso] of [
    ['turkey', 'TUR'],
    ['uae', 'ARE'],
    ['uk', 'GBR'],
    ["cote d'ivoire", 'CIV'],
  ] as const) {
    await box.fill(q);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`country=${iso}`));
  }
  await box.fill('usa china');
  await expect(page.getByRole('option').first()).toContainText('United States ↔ China');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/pair=USA%2CCHN|pair=USA,CHN/);
  await box.fill('suez');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/chokepoint=suez/);
  await expect(page).toHaveURL(/layer=chokepoints/);
  await box.fill('sanctions');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/layer=sanctions/);
});

test('search ranks the war first in Conflicts mode and offers recents on empty focus', async ({ page }) => {
  await open(page, '#mode=conflicts');
  const box = page.getByRole('searchbox');
  await box.fill('sudan');
  await expect(page.locator('.search-group').first()).toHaveText(/Conflicts & unrest/i);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/conflict=sudan/);
  await box.focus();
  await expect(page.getByRole('listbox', { name: 'Suggestions' })).toContainText('Sudan');
  await expect(page.locator('.search-list .hint')).toContainText('Hormuz');
  const results = await new AxeBuilder({ page }).include('.search').disableRules(['color-contrast']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});

test('every view has its own tab title, and the page carries a social card', async ({ page, request }) => {
  await open(page, '#mode=conflicts&conflict=sudan');
  await expect(page).toHaveTitle(/^Sudan.* · \w+ intensity — ATLAS$/);
  await open(page, '#mode=blocs&country=UKR');
  await expect(page).toHaveTitle('Ukraine — ATLAS');
  await open(page, '#mode=blocs&pair=USA,CHN');
  await expect(page).toHaveTitle('United States ↔ China — ATLAS');
  await open(page);
  await expect(page).toHaveTitle('ATLAS — alliances, wars and unrest');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\.png$/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  const og = await request.get('/og.png');
  expect(og.ok()).toBe(true);
  expect(og.headers()['content-type']).toContain('image/png');
});

test('static shell and saved theme paint before any JS runs', async ({ page }) => {
  // Block the app bundle so only index.html (and its CSS) can paint.
  await page.route(/\/assets\/index-.*\.js$/, (r) => r.abort());
  await page.addInitScript(() => localStorage.setItem('atlas:theme', 'light'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.app-shell .word')).toHaveText('ATLAS');
  await expect(page.locator('.app-shell .map-skeleton')).toContainText('INITIALISING MAP');
  // The shell reserves the real header's height so mounting does not move the map.
  const shellHeader = await page.locator('.app-shell .header').boundingBox();
  await page.unrouteAll();
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForSelector('path.country');
  const realHeader = await page.locator('.app:not(.app-shell) .header').boundingBox();
  expect(Math.abs((shellHeader?.height ?? 0) - (realHeader?.height ?? 0))).toBeLessThanOrEqual(2);
});

test('fonts are self-hosted and preloaded; the map chunks are modulepreloaded', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) external.push(r.url());
  });
  await open(page);
  expect(external).toEqual([]);
  expect(await page.locator('link[rel="preload"][as="font"]').count()).toBeGreaterThanOrEqual(3);
  // In the served HTML, before the app's own idle prefetch adds more.
  const html = await (await page.request.get('/')).text();
  expect(html).toMatch(/rel="modulepreload"[^>]*WorldMap-/);
  expect(html).not.toMatch(/rel="modulepreload"[^>]*(GlobeMap-|countries-50m)/);
  expect(await page.evaluate(() => document.fonts.check('16px "Share Tech Mono"'))).toBe(true);
});

test('a stale globe chunk after a deploy offers a reload, and the flat map recovers', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'same code path; desktop is enough');
  // Simulate a deploy that removed this build's globe chunk.
  await page.route(/\/assets\/GlobeMap-.*\.js$/, (r) => r.fulfill({ status: 404, body: 'gone' }));
  await open(page, '#mode=conflicts');
  // The first failure reloads once (the view survives in the hash); the second shows the update notice.
  await page.getByRole('button', { name: 'Globe view' }).click();
  await page.waitForURL(/view=globe/);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('ATLAS was updated', { timeout: 15_000 });
  await expect(alert.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(page.locator('.legend')).toHaveCount(0);
  await expect(page.locator('.timeline')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export PNG' })).toBeDisabled();
  await page.getByRole('button', { name: 'Flat map' }).click();
  await expect(page.locator('path.country')).toHaveCount(177);
  await expect(page.locator('.legend')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export PNG' })).toBeEnabled();
});

test('links to a layer this build cannot draw land on tracked data, not an all-zero map', async ({ page }) => {
  await open(page, '#mode=blocs&layer=acled');
  await expect(page).toHaveURL(/mode=conflicts/);
  await expect(page).not.toHaveURL(/layer=acled/);
  await open(page, '#mode=blocs&layer=acled-unrest');
  await expect(page).toHaveURL(/layer=unrest/);
});
