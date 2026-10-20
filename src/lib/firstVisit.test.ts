import { describe, expect, it } from 'vitest';
import { INTRO_KEY, dismissIntro, introState } from './firstVisit';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('This week card visibility', () => {
  it('opens for a first-time visitor and stays open across reloads until dismissed', () => {
    const store = mem();
    expect(introState(store)).toBe('open');
    expect(store.m.get(INTRO_KEY)).toBe('open');
    expect(introState(store)).toBe('open');
    dismissIntro(store);
    expect(introState(store)).toBe('dismissed');
  });

  it('stays closed for visitors who were here before the card existed', () => {
    expect(introState(mem({ 'atlas.lastVisit.v1': '2026-10-01' }))).toBe('dismissed');
    expect(introState(mem({ 'atlas.lastVisit.v2': '{"at":"2026-10-01","seen":[]}' }))).toBe('dismissed');
  });

  it('shows nothing when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
    };
    expect(introState(blocked)).toBe('dismissed');
    expect(introState(null)).toBe('dismissed');
  });
});
