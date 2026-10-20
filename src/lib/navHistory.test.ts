import { describe, expect, it } from 'vitest';
import { GESTURE_GAP_MS, historyMode, selectionKey } from './navHistory';
import { DEFAULT_STATE, type AppState } from './urlState';
import { nextTrail } from '../hooks/usePanelTrail';

const s = (patch: Partial<AppState>): AppState => ({ ...DEFAULT_STATE, ...patch });
const idle = { key: null, at: 0 };

describe('history mode', () => {
  it('pushes navigation', () => {
    expect(historyMode(s({}), s({ selection: { kind: 'country', iso: 'UKR' } }), idle, 5000).kind).toBe('push');
    expect(historyMode(s({}), s({ mode: 'conflicts' }), idle, 5000).kind).toBe('push');
    expect(historyMode(s({ bloc: 'nato' }), s({ bloc: 'nato', vs: 'eu' }), idle, 5000).kind).toBe('push');
    expect(historyMode(s({}), s({ layer: 'sanctions' }), idle, 5000).kind).toBe('push');
    expect(historyMode(s({}), s({ view: 'globe' }), idle, 5000).kind).toBe('push');
    expect(historyMode(s({}), s({ brief: true }), idle, 5000).kind).toBe('push');
    expect(historyMode(s({ brief: true }), s({ brief: false }), idle, 5000).kind).toBe('push');
  });

  it('treats a re-rendered panel of the same thing as no navigation', () => {
    expect(historyMode(s({ selection: { kind: 'country', iso: 'UKR' } }), s({ selection: { kind: 'country', iso: 'UKR' }, rotation: [1, 2] }), idle, 5000).kind).toBe('replace');
  });

  it('rewrites the entry for globe rotation and inside a briefing', () => {
    expect(historyMode(s({}), s({ rotation: [40, 10] }), idle, 5000).kind).toBe('replace');
    expect(historyMode(s({ brief: true }), s({ brief: true, mode: 'conflicts', layer: 'unrest' }), idle, 5000).kind).toBe('replace');
  });

  it('commits one entry per month scrub', () => {
    const first = historyMode(s({}), s({ month: '2025-01' }), idle, 5000);
    expect(first).toEqual({ kind: 'push', key: 'month' });
    expect(historyMode(s({ month: '2025-01' }), s({ month: '2025-02' }), { key: 'month', at: 5000 }, 5200).kind).toBe('replace');
    expect(historyMode(s({ month: '2025-02' }), s({ month: '2025-03' }), { key: 'month', at: 5200 }, 5200 + GESTURE_GAP_MS + 1).kind).toBe('push');
  });

  it('keys selections by identity', () => {
    expect(selectionKey(null)).toBe('');
    expect(selectionKey({ kind: 'pair', a: 'UKR', b: null })).toBe('pair:UKR,');
    expect(selectionKey({ kind: 'bloc', id: 'nato' })).toBe('bloc:nato');
    expect(selectionKey({ kind: 'about' })).toBe('about');
  });
});

describe('panel trail', () => {
  const ukr = { kind: 'country', iso: 'UKR' } as const;
  const war = { kind: 'conflict', id: 'russia-ukraine' } as const;
  const rus = { kind: 'country', iso: 'RUS' } as const;

  it('stacks hops, pops on Back to the previous panel and clears on close', () => {
    let t = nextTrail({ current: null, seq: 0, stack: [] }, ukr, 0);
    expect(t.stack).toEqual([]);
    t = nextTrail(t, war, 0);
    t = nextTrail(t, rus, 0);
    expect(t.stack).toEqual([ukr, war]);
    // Back: the URL now shows the conflict, which is the top of the trail.
    t = nextTrail(t, war, 1);
    expect(t.stack).toEqual([ukr]);
    // Forward (or an edited hash) to something else starts over.
    t = nextTrail(t, rus, 2);
    expect(t.stack).toEqual([]);
    t = nextTrail(t, war, 2);
    expect(t.stack).toEqual([rus]);
    t = nextTrail(t, null, 2);
    expect(t.stack).toEqual([]);
  });
});
