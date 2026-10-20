import { describe, expect, it } from 'vitest';
import type { Conflict, ConflictInput } from '../data/types';
import { allChanges, assessedIn, assessedMonths, changesSince, clampMonth, entryAt, monthRange, replayAt, withCurrent } from './history';

const base: ConflictInput = {
  id: 'x',
  name: 'X',
  type: 'interstate',
  since: 2020,
  location: [0, 0],
  countries: ['FRA'],
  parties: ['A'],
  summary: 'S',
  history: [
    { date: '2025-12-15', intensity: 'low', status: 'old', sources: [{ name: 'a', url: 'https://a' }] },
    { date: '2026-10-07', intensity: 'high', status: 'new', sources: [{ name: 'b', url: 'https://b' }] },
  ],
};

describe('withCurrent', () => {
  it('sorts newest first and mirrors the newest entry', () => {
    const c = withCurrent(base);
    expect(c.history.map((h) => h.date)).toEqual(['2026-10-07', '2025-12-15']);
    expect(c.intensity).toBe('high');
    expect(c.status).toBe('new');
    expect(c.updated).toBe('2026-10-07');
  });

  it('rejects empty history and bad dates', () => {
    expect(() => withCurrent({ ...base, history: [] })).toThrow();
    expect(() => withCurrent({ ...base, history: [{ ...base.history[0]!, date: '2026-1' }] })).toThrow();
  });
});

describe('entryAt', () => {
  const c: Conflict = withCurrent(base);
  it('returns null before the first assessment', () => {
    expect(entryAt(c, '2025-11')).toBeNull();
  });
  it('returns the entry in force at the end of a month', () => {
    expect(entryAt(c, '2025-12')?.status).toBe('old');
    expect(entryAt(c, '2026-05')?.status).toBe('old');
    expect(entryAt(c, '2026-10')?.status).toBe('new');
  });
});

describe('replay honesty', () => {
  const c: Conflict = withCurrent(base);
  it('tells a fresh assessment from one carried forward', () => {
    expect(assessedIn(c, '2025-12')).toBe(true);
    expect(assessedIn(c, '2026-04')).toBe(false);
    expect(replayAt(c, '2025-12')).toMatchObject({ fresh: true, untracked: false });
    expect(replayAt(c, '2026-04')).toMatchObject({ fresh: false, untracked: false });
    expect(replayAt(c, '2026-04').entry?.status).toBe('old');
  });
  it('marks conflicts already under way before their first entry as untracked', () => {
    expect(replayAt(c, '2025-11')).toEqual({ entry: null, fresh: false, untracked: true });
    expect(replayAt(withCurrent({ ...base, since: 2026 }), '2025-11').untracked).toBe(false);
  });
  it('lists only months with new assessments', () => {
    expect([...assessedMonths([c])].sort()).toEqual(['2025-12', '2026-10']);
  });
});

describe('clampMonth', () => {
  const months = monthRange('2025-12', '2026-10');
  it('snaps months before the range to the first stop', () => {
    expect(clampMonth('2023-01', months)).toEqual({ month: '2025-12', clamped: 'before' });
  });
  it('treats the live month and later as live', () => {
    expect(clampMonth('2026-10', months)).toEqual({ month: null, clamped: null });
    expect(clampMonth('2099-01', months)).toEqual({ month: null, clamped: 'after' });
  });
  it('keeps months inside the range', () => {
    expect(clampMonth('2026-03', months)).toEqual({ month: '2026-03', clamped: null });
    expect(clampMonth('2025-12', months)).toEqual({ month: '2025-12', clamped: null });
  });
});

describe('monthRange', () => {
  it('spans year boundaries inclusively', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthRange('2026-03', '2026-03')).toEqual(['2026-03']);
  });
});

describe('changes feed', () => {
  it('merges and filters by recency', () => {
    const c = withCurrent(base);
    const items = allChanges([c], [], (iso) => iso, (k) => k);
    expect(items[0]?.date).toBe('2026-10-07');
    expect(changesSince(items, 30, new Date('2026-10-20T00:00:00Z'))).toHaveLength(1);
    expect(changesSince(items, 400, new Date('2026-10-20T00:00:00Z'))).toHaveLength(2);
  });
});
