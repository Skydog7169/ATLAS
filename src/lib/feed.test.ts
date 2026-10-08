import { describe, expect, it } from 'vitest';
import { CHANGES, changesForCountry, tickerItems, watchlistOnly } from './feed';

describe('feed', () => {
  it('is sorted newest first and has both kinds', () => {
    const dates = CHANGES.map((c) => c.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(CHANGES.some((c) => c.kind === 'conflict')).toBe(true);
    expect(CHANGES.some((c) => c.kind === 'bloc')).toBe(true);
  });

  it('ticker takes the ten newest', () => {
    const items = tickerItems(CHANGES, null);
    expect(items).toHaveLength(10);
    expect(items.map((i) => i.date)).toEqual(CHANGES.slice(0, 10).map((i) => i.date));
  });

  it('ticker and feed restrict to the watchlist', () => {
    const keys = new Set(['conflict:sudan']);
    const items = tickerItems(CHANGES, keys);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.kind === 'conflict' && i.id === 'sudan')).toBe(true);
    expect(watchlistOnly(CHANGES, new Set())).toEqual([]);
  });

  it('country feed covers conflicts on its territory and its own membership changes', () => {
    const items = changesForCountry(CHANGES, 'SDN');
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.kind === 'conflict' && i.id === 'sudan')).toBe(true);
    expect(changesForCountry(CHANGES, 'IDN').some((i) => i.kind === 'bloc' && i.iso === 'IDN')).toBe(true);
    expect(changesForCountry(CHANGES, 'ZZZ')).toEqual([]);
  });
});
