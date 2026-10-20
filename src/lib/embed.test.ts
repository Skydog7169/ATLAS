import { describe, expect, it, vi } from 'vitest';
import { embedSnippet, embedUrl } from './embedSnippet';
import { gestureFilter } from './gestures';
import { DEFAULT_EMBED_OPTS, DEFAULT_STATE } from './urlState';

describe('cooperative gestures', () => {
  const ev = (type: string, extra: Record<string, unknown> = {}) => Object.assign(new Event(type), extra);
  it('leaves plain wheel and one-finger touch to the page and says so for the wheel', () => {
    const blocked = vi.fn();
    const f = gestureFilter('cooperative', blocked);
    expect(f(ev('wheel'))).toBe(false);
    expect(blocked).toHaveBeenCalledWith('wheel');
    expect(f(ev('wheel', { ctrlKey: true }))).toBe(true);
    expect(f(ev('wheel', { metaKey: true }))).toBe(true);
    expect(f(ev('touchstart', { touches: { length: 1 } }))).toBe(false);
    expect(f(ev('touchstart', { touches: { length: 2 } }))).toBe(true);
    expect(f(ev('mousedown', { button: 0 }))).toBe(true);
  });
  it('keeps d3 defaults in the full app and blocks everything when static', () => {
    expect(gestureFilter('all')(ev('wheel'))).toBe(true);
    expect(gestureFilter('all')(ev('mousedown', { button: 2 }))).toBe(false);
    expect(gestureFilter('none')(ev('wheel', { ctrlKey: true }))).toBe(false);
  });
});

describe('embed snippet', () => {
  const state = { ...DEFAULT_STATE, mode: 'conflicts' as const, month: '2026-03', selection: { kind: 'conflict' as const, id: 'sudan' } };
  it('pins the month only when frozen and carries host options', () => {
    const frozen = embedUrl(state, { ...DEFAULT_EMBED_OPTS, legend: 'off' }, true, 'https://atlas.test/');
    expect(frozen).toBe('https://atlas.test/#mode=conflicts&t=2026-03&embed=1&legend=off&conflict=sudan');
    expect(embedUrl(state, DEFAULT_EMBED_OPTS, false, 'https://atlas.test/x#old')).toBe('https://atlas.test/x#mode=conflicts&embed=1&conflict=sudan');
  });
  it('writes an escaped, titled iframe', () => {
    expect(embedSnippet('https://atlas.test/#a=1&b=2', 360, 'Sudan "civil" war')).toBe(
      '<iframe src="https://atlas.test/#a=1&amp;b=2" width="100%" height="360" title="ATLAS: Sudan &quot;civil&quot; war" loading="lazy" style="border:0"></iframe>',
    );
  });
});
