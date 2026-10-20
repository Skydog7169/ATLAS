// Writes public/feed.xml (RSS 2.0) and public/feed.json (JSON Feed 1.1) from
// the dated conflict and unrest assessments and bloc membership changes, so readers and
// automations can follow ATLAS without the browser. Runs before every build;
// the files are build artefacts and are not committed.
//
//   node scripts/build-feeds.mjs [--out dir] [--limit N]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

export const SITE = 'https://atlas-geopolitic.vercel.app';
export const FEED_LIMIT = 50;

const CHANGE_LABEL = { joined: 'Joined', left: 'Left', suspended: 'Suspended', reinstated: 'Reinstated', frozen: 'Froze participation', invited: 'Invited', founded: 'Founding member' };
const INTENSITY_LABEL = { high: 'High intensity', medium: 'Medium intensity', low: 'Low intensity', latent: 'Latent / ceasefire' };

const RANK = { high: 3, medium: 2, low: 1, latent: 0 };
const LEVEL = { high: 'high', medium: 'medium', low: 'low', latent: 'latent' };

/** How an assessment compares with the previous one: 'new', 'up', 'down' or 'same'. Mirrors src/lib/history.ts deltaOf. */
export function deltaOf(prev, cur) {
  if (prev == null) return 'new';
  return RANK[cur] > RANK[prev] ? 'up' : RANK[cur] < RANK[prev] ? 'down' : 'same';
}

/** 'New · High intensity', '▲ Escalated · low → medium', '▼ Eased · high → latent' or 'High intensity, no change'. */
export function deltaLabel(delta, prev, cur) {
  const level = INTENSITY_LABEL[cur] ?? cur;
  if (delta === 'new') return `New · ${level}`;
  if (delta === 'up') return `▲ Escalated · ${LEVEL[prev] ?? prev} → ${LEVEL[cur] ?? cur}`;
  if (delta === 'down') return `▼ Eased · ${LEVEL[prev] ?? prev} → ${LEVEL[cur] ?? cur}`;
  return `${level}, no change`;
}

function assessments(kind, r, url) {
  const oldestFirst = [...r.history].sort((a, b) => a.date.localeCompare(b.date));
  let prev = null;
  return oldestFirst.map((h) => {
    const delta = deltaOf(prev, h.intensity);
    const item = {
      id: `${kind}:${r.id}:${h.date}`,
      date: h.date,
      title: `${r.name}${kind === 'unrest' ? ' (unrest)' : ''}: ${deltaLabel(delta, prev, h.intensity)}`,
      summary: h.status,
      url,
      tags: [kind, h.intensity, delta],
      sources: h.sources ?? [],
      intensity: h.intensity,
      prev,
      delta,
    };
    prev = h.intensity;
    return item;
  });
}

/**
 * Flattens the datasets into feed items, newest first, with same-day items
 * led by the most severe. Each assessment carries `prev` and `delta` against
 * the entry before it. Mirrors src/lib/history.ts allChanges without importing the app.
 */
export function collectItems(conflicts, blocs, countryName, unrest = []) {
  const items = [];
  for (const u of unrest) items.push(...assessments('unrest', u, `${SITE}/#layer=unrest&unrest=${encodeURIComponent(u.id)}`));
  for (const c of conflicts) items.push(...assessments('conflict', c, `${SITE}/#mode=conflicts&conflict=${encodeURIComponent(c.id)}`));
  for (const b of blocs) {
    for (const ch of b.changes) {
      items.push({
        id: `bloc:${b.id}:${ch.iso}:${ch.date}:${ch.change}`,
        date: ch.date,
        title: `${b.shortName}: ${countryName(ch.iso)} ${(CHANGE_LABEL[ch.change] ?? ch.change).toLowerCase()}`,
        summary: ch.note ?? `${countryName(ch.iso)}: ${CHANGE_LABEL[ch.change] ?? ch.change}.`,
        url: `${SITE}/#mode=blocs&bloc=${encodeURIComponent(b.id)}`,
        tags: ['bloc', ch.change],
        sources: ch.source ? [ch.source] : [],
        delta: 'membership',
      });
    }
  }
  const severity = (it) => (it.intensity ? RANK[it.intensity] : -1);
  return items.sort((a, b) => b.date.localeCompare(a.date) || severity(b) - severity(a) || a.title.localeCompare(b.title));
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rfc822(date) {
  return new Date(date + 'T12:00:00Z').toUTCString();
}

function describe(item) {
  const links = item.sources.map((s) => `<a href="${esc(s.url)}">${esc(s.name)}</a>`).join(' · ');
  return `<p>${esc(item.summary)}</p>${links ? `<p>Sources: ${links}</p>` : ''}`;
}

export function renderRss(items, { now = new Date(), limit = FEED_LIMIT } = {}) {
  const shown = items.slice(0, limit);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    '<title>ATLAS: geopolitical changes</title>',
    `<link>${SITE}/</link>`,
    `<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>`,
    '<description>Dated conflict assessments and bloc membership changes from the ATLAS geopolitics map.</description>',
    '<language>en</language>',
    `<lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
  ];
  for (const it of shown) {
    lines.push(
      '<item>',
      `<title>${esc(it.title)}</title>`,
      `<link>${esc(it.url)}</link>`,
      `<guid isPermaLink="false">${esc(it.id)}</guid>`,
      `<pubDate>${rfc822(it.date)}</pubDate>`,
      ...it.tags.map((t) => `<category>${esc(t)}</category>`),
      `<description><![CDATA[${describe(it)}]]></description>`,
      '</item>',
    );
  }
  lines.push('</channel>', '</rss>');
  return lines.join('\n') + '\n';
}

export function renderJsonFeed(items, { limit = FEED_LIMIT } = {}) {
  return (
    JSON.stringify(
      {
        version: 'https://jsonfeed.org/version/1.1',
        title: 'ATLAS: geopolitical changes',
        home_page_url: `${SITE}/`,
        feed_url: `${SITE}/feed.json`,
        description: 'Dated conflict assessments and bloc membership changes from the ATLAS geopolitics map.',
        language: 'en',
        items: items.slice(0, limit).map((it) => ({
          id: it.id,
          url: it.url,
          title: it.title,
          content_html: describe(it),
          content_text: it.summary,
          date_published: `${it.date}T12:00:00Z`,
          tags: it.tags,
          _atlas: { sources: it.sources },
        })),
      },
      null,
      1,
    ) + '\n'
  );
}

function main() {
  const argv = process.argv.slice(2);
  const out = resolve(root, argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'public');
  const limit = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : FEED_LIMIT;
  const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
  const countries = new Map(read('src/data/countries.generated.json').map((c) => [c.cca3, c.name]));
  const items = collectItems(read('src/data/conflicts.json'), read('src/data/blocs.json'), (iso) => countries.get(iso) ?? iso, read('src/data/unrest.json'));
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'feed.xml'), renderRss(items, { limit }));
  writeFileSync(resolve(out, 'feed.json'), renderJsonFeed(items, { limit }));
  console.log(`feeds: ${Math.min(items.length, limit)} of ${items.length} items -> ${out}/feed.{xml,json}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
