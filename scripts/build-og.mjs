// Renders public/og.png, the 1200×630 social card shared links unfurl with.
// It is a screenshot of the real conflicts map with the ATLAS title block
// over it, so it stays in the product's own HUD style. Re-run after visual
// changes:
//   pnpm run build && pnpm exec vite preview --port 4173 &
//   node scripts/build-og.mjs [http://localhost:4173]
// Set PW_CHROMIUM_PATH to use a system Chromium.
/* global document */
import { chromium } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:4173';
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/og.png');
const executablePath = process.env.PW_CHROMIUM_PATH;

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'dark' });
await page.goto(`${base}/#mode=conflicts&embed=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('g.marker');
await page.addStyleTag({
  content: `
    .embed-badge, .map-controls, .ticker, .legend, .timeline, .since-last-visit, .tooltip { display: none !important; }
    .og-card { position: fixed; left: 56px; bottom: 56px; z-index: 50; padding: 26px 30px 24px; max-width: 620px;
      background: color-mix(in srgb, var(--bg-elev) 90%, transparent); border: 1px solid var(--border-strong); box-shadow: var(--shadow); }
    .og-card .row { display: flex; align-items: center; gap: 16px; }
    .og-card svg { width: 54px; height: 54px; color: var(--accent); filter: drop-shadow(0 0 10px color-mix(in srgb, var(--accent) 60%, transparent)); }
    .og-card .word { font-family: var(--brand-font); font-weight: 800; font-size: 58px; letter-spacing: 0.14em; line-height: 1; color: var(--fg); }
    .og-card .tag { font-family: var(--mono); font-size: 14px; letter-spacing: 0.24em; color: var(--fg-muted); margin-top: 6px; }
    .og-card p { margin: 18px 0 0; font-family: var(--font); font-weight: 600; font-size: 28px; line-height: 1.2; color: var(--fg); }
    .og-card .meta { margin-top: 12px; font-family: var(--mono); font-size: 14px; letter-spacing: 0.16em; color: var(--accent); }
  `,
});
await page.evaluate(() => {
  const card = document.createElement('div');
  card.className = 'og-card frame';
  card.innerHTML = `
    <div class="row">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18.83 3.72A12.6 12.6 0 0 1 28.28 13.17M28.28 18.83A12.6 12.6 0 0 1 18.83 28.28M13.17 28.28A12.6 12.6 0 0 1 3.72 18.83M3.72 13.17A12.6 12.6 0 0 1 13.17 3.72" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M25.05 6.95L26.32 5.68M25.05 25.05L26.32 26.32M6.95 25.05L5.68 26.32M6.95 6.95L5.68 5.68" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/><path d="M22.51 9.49L18.10 16L16 16L16 13.90ZM22.51 22.51L16 18.10L16 16L18.10 16ZM9.49 22.51L13.90 16L16 16L16 18.10ZM9.49 9.49L16 13.90L16 16L13.90 16Z" fill="currentColor" opacity="0.5"/><path d="M16 2.20L18.12 13.88L16 16Z" fill="var(--warn)"/><path d="M16 2.20L16 16L13.88 13.88Z" fill="var(--warn)" opacity="0.38"/><path d="M29.80 16L18.12 18.12L16 16Z" fill="currentColor"/><path d="M29.80 16L16 16L18.12 13.88Z" fill="currentColor" opacity="0.38"/><path d="M16 29.80L13.88 18.12L16 16Z" fill="currentColor"/><path d="M16 29.80L16 16L18.12 18.12Z" fill="currentColor" opacity="0.38"/><path d="M2.20 16L13.88 13.88L16 16Z" fill="currentColor"/><path d="M2.20 16L16 16L13.88 18.12Z" fill="currentColor" opacity="0.38"/><circle cx="16" cy="16" r="1.5" fill="var(--bg)" stroke="currentColor" stroke-width="0.9"/></svg>
      <div><div class="word">ATLAS</div><div class="tag">ALLIANCES · WARS · UNREST</div></div>
    </div>
    <p>Alliances, wars and unrest on one map</p>
    <div class="meta">BLOCS · CONFLICTS · UNREST · CHOKEPOINTS · SOURCED</div>`;
  document.body.appendChild(card);
});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: out, type: 'png' });
await browser.close();
console.log(`wrote ${out}`);
