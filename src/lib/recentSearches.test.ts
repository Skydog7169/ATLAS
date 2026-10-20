import { beforeEach, describe, expect, it } from 'vitest';
import { RECENT_KEY, pushRecent, readRecent } from './recentSearches';

describe('recent searches', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the last five picks, newest first, without duplicates', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) pushRecent({ kind: 'country', id });
    pushRecent({ kind: 'country', id: 'c' });
    expect(readRecent().map((p) => p.id)).toEqual(['c', 'f', 'e', 'd', 'b']);
  });

  it('ignores junk in storage', () => {
    localStorage.setItem(RECENT_KEY, '{not json');
    expect(readRecent()).toEqual([]);
    localStorage.setItem(RECENT_KEY, JSON.stringify([{ kind: 'country' }, 7, { kind: 'bloc', id: 'nato' }]));
    expect(readRecent()).toEqual([{ kind: 'bloc', id: 'nato' }]);
  });
});
