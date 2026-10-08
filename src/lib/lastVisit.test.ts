import { describe, expect, it } from 'vitest';
import type { ChangeItem } from './history';
import { LAST_VISIT_KEY, changesSinceVisit, readLastVisit, writeLastVisit } from './lastVisit';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};
const item = (date: string): ChangeItem => ({ date, kind: 'conflict', id: 'x', title: 'X', detail: 'd', intensity: 'low' });

describe('last visit', () => {
  it('round-trips a date and rejects junk', () => {
    const s = mem();
    expect(readLastVisit(s)).toBeNull();
    expect(writeLastVisit('2026-10-01', s)).toBe(true);
    expect(readLastVisit(s)).toBe('2026-10-01');
    s.setItem(LAST_VISIT_KEY, 'yesterday');
    expect(readLastVisit(s)).toBeNull();
  });

  it('never throws without storage', () => {
    expect(readLastVisit(null)).toBeNull();
    expect(writeLastVisit('2026-10-01', null)).toBe(false);
    expect(readLastVisit(throwing)).toBeNull();
    expect(writeLastVisit('2026-10-01', throwing)).toBe(false);
  });

  it('lists only items dated after the visit, and nothing on a first visit', () => {
    const items = [item('2026-10-07'), item('2026-10-01'), item('2026-09-01')];
    expect(changesSinceVisit(items, '2026-10-01').map((i) => i.date)).toEqual(['2026-10-07']);
    expect(changesSinceVisit(items, '2026-08-01')).toHaveLength(3);
    expect(changesSinceVisit(items, null)).toEqual([]);
  });
});
