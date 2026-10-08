import { describe, expect, it } from 'vitest';
import type { Conflict } from '../data/types';
import type { ChangeItem } from './history';
import { WATCHLIST_KEY, hasItem, matchesWatchlist, readWatchOnly, readWatchlist, toggleItem, watchKeys, writeWatchOnly, writeWatchlist, type WatchItem } from './watchlist';

class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('watchlist storage', () => {
  it('round-trips items and drops duplicates and junk', () => {
    const s = new MemoryStorage();
    expect(writeWatchlist([{ kind: 'country', id: 'UKR' }, { kind: 'bloc', id: 'nato' }], s)).toBe(true);
    s.setItem(WATCHLIST_KEY, JSON.stringify([{ kind: 'country', id: 'UKR' }, { kind: 'country', id: 'UKR' }, { kind: 'x', id: 'y' }, 'junk', { kind: 'conflict', id: 'sudan' }]));
    expect(readWatchlist(s)).toEqual([
      { kind: 'country', id: 'UKR' },
      { kind: 'conflict', id: 'sudan' },
    ]);
  });

  it('never throws when storage is missing, blocked or corrupt', () => {
    expect(readWatchlist(null)).toEqual([]);
    expect(writeWatchlist([{ kind: 'country', id: 'UKR' }], null)).toBe(false);
    expect(readWatchlist(throwing)).toEqual([]);
    expect(writeWatchlist([], throwing)).toBe(false);
    const s = new MemoryStorage();
    s.setItem(WATCHLIST_KEY, '{not json');
    expect(readWatchlist(s)).toEqual([]);
    s.setItem(WATCHLIST_KEY, '{"a":1}');
    expect(readWatchlist(s)).toEqual([]);
    expect(readWatchOnly(throwing)).toBe(false);
    expect(writeWatchOnly(true, throwing)).toBe(false);
  });

  it('persists the filter flag', () => {
    const s = new MemoryStorage();
    expect(readWatchOnly(s)).toBe(false);
    writeWatchOnly(true, s);
    expect(readWatchOnly(s)).toBe(true);
    writeWatchOnly(false, s);
    expect(readWatchOnly(s)).toBe(false);
  });

  it('toggles membership', () => {
    const a: WatchItem = { kind: 'country', id: 'FRA' };
    let list = toggleItem([], a);
    expect(hasItem(list, a)).toBe(true);
    list = toggleItem(list, { kind: 'country', id: 'FRA' });
    expect(hasItem(list, a)).toBe(false);
    expect(watchKeys([a, { kind: 'bloc', id: 'eu' }])).toEqual(new Set(['country:FRA', 'bloc:eu']));
  });
});

describe('matchesWatchlist', () => {
  const sudan = { id: 'sudan', countries: ['SDN', 'TCD'] } as unknown as Conflict;
  const byId = new Map([['sudan', sudan]]);
  const assessment: ChangeItem = { date: '2026-10-01', kind: 'conflict', id: 'sudan', title: 'Sudan', detail: 'x', intensity: 'high' };
  const membership: ChangeItem = { date: '2026-10-01', kind: 'bloc', id: 'brics', title: 'BRICS: Indonesia', detail: 'Joined', iso: 'IDN' };

  it('matches a starred conflict or a starred country on its territory', () => {
    expect(matchesWatchlist(assessment, new Set(['conflict:sudan']), byId)).toBe(true);
    expect(matchesWatchlist(assessment, new Set(['country:TCD']), byId)).toBe(true);
    expect(matchesWatchlist(assessment, new Set(['country:FRA']), byId)).toBe(false);
    expect(matchesWatchlist(assessment, new Set(), byId)).toBe(false);
  });

  it('matches a membership change by bloc or by the country whose status changed', () => {
    expect(matchesWatchlist(membership, new Set(['bloc:brics']), byId)).toBe(true);
    expect(matchesWatchlist(membership, new Set(['country:IDN']), byId)).toBe(true);
    expect(matchesWatchlist(membership, new Set(['country:BRA']), byId)).toBe(false);
  });
});
