import { describe, expect, it } from 'vitest';
import { collectItems, renderJsonFeed, renderRss } from '../../scripts/build-feeds.mjs';
import conflicts from '../data/conflicts.json';
import blocs from '../data/blocs.json';
import unrest from '../data/unrest.json';
import { countryName } from './countries';

describe('build-time feeds', () => {
  const items = collectItems(conflicts, blocs, countryName, unrest);

  it('flattens both datasets newest first with unique ids', () => {
    expect(items.length).toBeGreaterThan(40);
    expect(items.map((i) => i.date)).toEqual([...items.map((i) => i.date)].sort().reverse());
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items.some((i) => i.tags[0] === 'conflict')).toBe(true);
    expect(items.some((i) => i.tags[0] === 'bloc')).toBe(true);
    expect(items.some((i) => i.tags[0] === 'unrest' && i.url.includes('#layer=unrest&unrest='))).toBe(true);
    for (const it of items) expect(it.url).toMatch(/^https:\/\/atlas-geopolitic\.vercel\.app\/#(mode|layer)=/);
  });

  it('marks each assessment new, escalated, eased or unchanged against the previous one', () => {
    for (const it of items) expect(['new', 'up', 'down', 'same', 'membership']).toContain(it.delta);
    const up = items.find((i) => i.delta === 'up')!;
    expect(up.title).toMatch(/: ▲ Escalated · \w+ → \w+$/);
    expect(items.find((i) => i.delta === 'new')!.title).toMatch(/: New · /);
    expect(items.find((i) => i.delta === 'same')!.title).toMatch(/, no change$/);
    expect(items.find((i) => i.tags[0] === 'unrest')!.title).toContain('(unrest):');
    // Same-day ties go to the most severe item, not the alphabet.
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1, latent: 0 };
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1]!;
      const b = items[i]!;
      if (a.date === b.date) expect(a.intensity ? rank[a.intensity]! : -1).toBeGreaterThanOrEqual(b.intensity ? rank[b.intensity]! : -1);
    }
  });

  it('renders valid-looking RSS with escaped text and a stable guid', () => {
    const xml = renderRss(items, { now: new Date('2026-10-08T00:00:00Z'), limit: 5 });
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
    expect((xml.match(/<item>/g) ?? []).length).toBe(5);
    expect(xml).toContain('<lastBuildDate>Thu, 08 Oct 2026 00:00:00 GMT</lastBuildDate>');
    expect(xml).toContain('<guid isPermaLink="false">');
    expect(xml).not.toMatch(/<title>[^<]*&(?!amp;|lt;|gt;|quot;)/);
    expect(xml).toContain('<pubDate>');
  });

  it('renders JSON Feed 1.1', () => {
    const feed = JSON.parse(renderJsonFeed(items, { limit: 3 }));
    expect(feed.version).toBe('https://jsonfeed.org/version/1.1');
    expect(feed.items).toHaveLength(3);
    expect(feed.items[0]).toMatchObject({ id: expect.any(String), url: expect.any(String), title: expect.any(String), date_published: expect.stringMatching(/T12:00:00Z$/) });
    expect(feed.items[0].content_html).toContain('<p>');
  });
});
