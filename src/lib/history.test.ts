import { describe, expect, it } from 'vitest';
import type { Conflict, ConflictInput } from '../data/types';
import { allChanges, changesSince, deltaOf, entryAt, monthRange, withCurrent } from './history';

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

describe('change deltas', () => {
  const entry = (date: string, intensity: 'high' | 'medium' | 'low' | 'latent') => ({ date, intensity, status: date, sources: [{ name: 'a', url: 'https://a' }] });
  const tunisia = withCurrent({ ...base, id: 'tun', name: 'Tunisia', history: [entry('2026-10-19', 'medium'), entry('2026-09-01', 'low')] });
  const tanzania = withCurrent({ ...base, id: 'tza', name: 'Tanzania', history: [entry('2026-10-19', 'latent'), entry('2026-10-12', 'high'), entry('2026-10-05', 'high')] });
  const items = allChanges([tunisia, tanzania], [], (iso) => iso, (k) => k);
  const by = (id: string, date: string) => items.find((i) => i.id === id && i.date === date)!;

  it('compares each assessment with the one before it', () => {
    expect(by('tun', '2026-09-01')).toMatchObject({ delta: 'new', prev: null });
    expect(by('tun', '2026-10-19')).toMatchObject({ delta: 'up', prev: 'low', intensity: 'medium' });
    expect(by('tza', '2026-10-12')).toMatchObject({ delta: 'same', prev: 'high' });
    expect(by('tza', '2026-10-19')).toMatchObject({ delta: 'down', prev: 'high', intensity: 'latent' });
    expect(deltaOf(null, 'low')).toBe('new');
    expect(deltaOf('latent', 'high')).toBe('up');
  });

  it('keys items like the public feed ids', () => {
    expect(by('tun', '2026-10-19').key).toBe('conflict:tun:2026-10-19');
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });

  it('breaks same-day ties by severity, not the alphabet', () => {
    const sameDay = items.filter((i) => i.date === '2026-10-19').map((i) => i.title);
    expect(sameDay).toEqual(['Tunisia', 'Tanzania']);
  });
});
