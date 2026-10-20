import { describe, expect, it } from 'vitest';
import type { ChangeItem } from './history';
import { LAST_VISIT_KEY, VISIT_KEY, loadVisit, markAllRead, unseenItems, writeVisit } from './lastVisit';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map<string, string>(Object.entries(init));
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};
const item = (date: string, id = 'x'): ChangeItem => ({ date, kind: 'conflict', id, title: id, detail: 'd', intensity: 'low', prev: 'low', delta: 'same', key: `conflict:${id}:${date}` });
const NOW = new Date('2026-10-19T09:00:00Z');

describe('last visit seen-set', () => {
  it('seeds a first visit silently with everything current, and persists it', () => {
    const s = mem();
    const items = [item('2026-10-07'), item('2026-10-01')];
    const v = loadVisit(items, NOW, s);
    expect(unseenItems(items, v)).toEqual([]);
    expect(v.at).toBe(NOW.toISOString());
    expect(JSON.parse(s.m.get(VISIT_KEY)!).seen).toHaveLength(2);
  });

  it('counts an older-dated entry that goes live after Mark read as unseen', () => {
    const s = mem();
    markAllRead([item('2026-10-12')], new Date('2026-10-19T09:00:00Z'), s);
    // The weekly PR merges at 23:13 UTC with entries dated Oct 17 and Oct 19.
    const after = [item('2026-10-19', 'same-day'), item('2026-10-17', 'back-dated'), item('2026-10-12')];
    const v = loadVisit(after, new Date('2026-10-20T08:00:00Z'), s);
    expect(unseenItems(after, v).map((i) => i.id)).toEqual(['same-day', 'back-dated']);
    expect(v.at.slice(0, 10)).toBe('2026-10-19');
  });

  it('Mark read clears everything and prunes keys that left the feed', () => {
    const s = mem();
    const items = [item('2026-10-19'), item('2026-10-01')];
    const v = markAllRead(items, NOW, s);
    expect(unseenItems(items, v)).toEqual([]);
    const reloaded = loadVisit([item('2026-10-19')], NOW, s);
    expect([...reloaded.seen]).toEqual(['conflict:x:2026-10-19']);
  });

  it('migrates a v1 date: items on or after it are unseen once, then v2 takes over', () => {
    const s = mem({ [LAST_VISIT_KEY]: '2026-10-19' });
    const items = [item('2026-10-20'), item('2026-10-19'), item('2026-10-12')];
    const v = loadVisit(items, NOW, s);
    expect(unseenItems(items, v).map((i) => i.date)).toEqual(['2026-10-20', '2026-10-19']);
    expect(v.at).toBe('2026-10-19');
    expect(s.m.has(LAST_VISIT_KEY)).toBe(false);
    expect(s.m.has(VISIT_KEY)).toBe(true);
  });

  it('ignores junk and never throws without storage', () => {
    const items = [item('2026-10-19')];
    expect(unseenItems(items, loadVisit(items, NOW, mem({ [VISIT_KEY]: '{"at":1}' })))).toEqual([]);
    expect(unseenItems(items, loadVisit(items, NOW, mem({ [VISIT_KEY]: 'nope', [LAST_VISIT_KEY]: 'yesterday' })))).toEqual([]);
    expect(unseenItems(items, loadVisit(items, NOW, null))).toEqual([]);
    expect(unseenItems(items, loadVisit(items, NOW, throwing))).toEqual([]);
    expect(writeVisit({ at: 'x', seen: new Set() }, null)).toBe(false);
    expect(writeVisit({ at: 'x', seen: new Set() }, throwing)).toBe(false);
    expect(() => markAllRead(items, NOW, throwing)).not.toThrow();
  });
});
