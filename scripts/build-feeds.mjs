// Writes public/feed.xml (RSS 2.0) and public/feed.json (JSON Feed 1.1) from
// the dated conflict assessments and bloc membership changes, so readers and
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

/** Flattens both datasets into feed items, newest first. Mirrors src/lib/history.ts allChanges without importing the app. */
export function collectItems(conflicts, blocs, countryName) {
  const items = [];
  for (const c of conflicts) {
    for (const h of c.history) {
      items.push({
        id: `conflict:${c.id}:${h.date}`,
        date: h.date,
        title: `${c.name}: ${INTENSITY_LABEL[h.intensity] ?? h.intensity}`,
        summary: h.status,
        url: `${SITE}/#mode=conflicts&conflict=${encodeURIComponent(c.id)}`,
        tags: ['conflict', h.intensity],
        sources: h.sources ?? [],
      });
    }
  }
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
      });
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
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
  const items = collectItems(read('src/data/conflicts.json'), read('src/data/blocs.json'), (iso) => countries.get(iso) ?? iso);
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'feed.xml'), renderRss(items, { limit }));
  writeFileSync(resolve(out, 'feed.json'), renderJsonFeed(items, { limit }));
  console.log(`feeds: ${Math.min(items.length, limit)} of ${items.length} items -> ${out}/feed.{xml,json}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
