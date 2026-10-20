import { describe, expect, it } from 'vitest';
import { CHANGES } from './feed';
import { weekItems, weekSummary, type WeekItem } from './thisWeek';

const item = (id: string, date: string, intensity: WeekItem['intensity'], delta: WeekItem['delta']): WeekItem => ({ kind: 'conflict', id, title: id, date, intensity, prev: null, delta, detail: '' });

describe('This week summary', () => {
  it('counts new, escalated and eased items in the last seven days of data', () => {
    const pool = [item('a', '2026-10-19', 'high', 'up'), item('b', '2026-10-15', 'medium', 'new'), item('c', '2026-10-14', 'low', 'down'), item('old', '2026-10-01', 'high', 'up')];
    const s = weekSummary('2026-10-20', 3, pool);
    expect(s.from).toBe('2026-10-14');
    expect(s.counts).toEqual({ new: 1, up: 1, down: 1 });
    expect(s.top.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps only the newest entry per conflict and ranks changes in level above same-level updates', () => {
    const pool = [item('a', '2026-10-15', 'medium', 'up'), item('a', '2026-10-19', 'medium', 'same'), item('b', '2026-10-19', 'high', 'same'), item('c', '2026-10-18', 'low', 'new')];
    const s = weekSummary('2026-10-20', 3, pool);
    expect(s.top).toHaveLength(3);
    expect(s.top[0]!.id).toBe('c');
    expect(s.top.filter((t) => t.id === 'a')).toHaveLength(1);
  });

  it('finds something to show in the live data', () => {
    const s = weekSummary();
    expect(s.top.length).toBeGreaterThan(0);
    for (const t of s.top) expect(t.date >= s.from && t.date <= s.to).toBe(true);
  });

  it('reads the shared change feed, so its deltas match the ticker and Latest changes', () => {
    const items = weekItems();
    expect(items.length).toBe(CHANGES.filter((c) => c.kind !== 'bloc').length);
    for (const it of items) expect(CHANGES.find((c) => c.key === `${it.kind}:${it.id}:${it.date}`)?.delta).toBe(it.delta);
  });
});
