import { describe, expect, it } from 'vitest';
import { CHANGES, bySignal, changesForCountry, changesForWatchItem, tickerItems, watchItemResolves, watchlistOnly } from './feed';
import type { ChangeItem } from './history';

describe('feed', () => {
  it('is sorted newest first and has both kinds', () => {
    const dates = CHANGES.map((c) => c.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(CHANGES.some((c) => c.kind === 'conflict')).toBe(true);
    expect(CHANGES.some((c) => c.kind === 'bloc')).toBe(true);
  });

  it('ticker ranks the last week by signal, then severity, and leaves re-assessments last', () => {
    const items = tickerItems(CHANGES, null);
    expect(items).toHaveLength(10);
    const rank = { new: 0, up: 0, down: 1, membership: 1, same: 2 } as const;
    const ranks = items.map((i) => rank[i.delta]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    const newest = CHANGES[0]!.date;
    const signals = CHANGES.filter((i) => i.date >= new Date(Date.parse(newest) - 7 * 86400000).toISOString().slice(0, 10) && i.delta !== 'same');
    // Every signal of the week makes the cut before any same-level re-assessment does.
    if (signals.length >= 10) expect(items.every((i) => i.delta !== 'same')).toBe(true);
    else for (const s of signals) expect(items).toContain(s);
  });

  it('ticker ranking is deterministic and falls back to older items when the week is thin', () => {
    const mk = (date: string, id: string, delta: ChangeItem['delta'], intensity: ChangeItem['intensity']): ChangeItem => ({ date, kind: 'conflict', id, title: id, detail: '', intensity, delta, key: `conflict:${id}:${date}` });
    const pool = [mk('2026-10-19', 'albania', 'same', 'low'), mk('2026-10-19', 'ukraine', 'same', 'high'), mk('2026-10-18', 'tunisia', 'up', 'medium'), mk('2026-10-19', 'france', 'new', 'high'), mk('2026-09-01', 'old', 'up', 'high')];
    const sorted = [...pool].sort((a, b) => b.date.localeCompare(a.date));
    expect(tickerItems(sorted, null, 5).map((i) => i.id)).toEqual(['france', 'tunisia', 'ukraine', 'albania', 'old']);
    expect([...pool].sort(bySignal)[0]!.id).toBe('france');
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

  it('resolves starred ids and finds their changes', () => {
    expect(watchItemResolves({ kind: 'conflict', id: 'sudan' })).toBe(true);
    expect(watchItemResolves({ kind: 'conflict', id: 'old-war-2023' })).toBe(false);
    expect(watchItemResolves({ kind: 'country', id: 'UKR' })).toBe(true);
    expect(watchItemResolves({ kind: 'country', id: 'ZZZ' })).toBe(false);
    expect(watchItemResolves({ kind: 'bloc', id: 'nato' })).toBe(true);
    expect(changesForWatchItem(CHANGES, { kind: 'conflict', id: 'sudan' }).every((i) => i.id === 'sudan')).toBe(true);
  });
});
