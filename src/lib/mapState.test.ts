import { describe, expect, it } from 'vitest';
import { blocsSuppressed, isDefaultMap, mapStateSegments, resetState, shareUrl } from './mapState';
import { DEFAULT_STATE, type AppState } from './urlState';

const label = (l: string) => l.charAt(0).toUpperCase() + l.slice(1);
const keys = (s: AppState) => mapStateSegments(s, label).map((x) => x.key);

describe('map state strip', () => {
  it('names only the mode on the default map', () => {
    const segs = mapStateSegments(DEFAULT_STATE, label);
    expect(segs).toEqual([{ key: 'mode', label: 'Blocs' }]);
  });

  it('lists every piece of a busy conflicts view in order, each clearable', () => {
    const s: AppState = { ...DEFAULT_STATE, mode: 'conflicts', layer: 'sanctions', month: '2026-03', selection: { kind: 'conflict', id: 'sudan' }, view: 'globe' };
    const segs = mapStateSegments(s, label);
    expect(segs.map((x) => x.key)).toEqual(['mode', 'layer', 'month', 'focus', 'view']);
    expect(segs[1]).toMatchObject({ label: 'Overlay: Sanctions', clear: { layer: null } });
    expect(segs[2]?.label).toBe('Replay Mar 2026');
    expect(segs[2]?.clear).toEqual({ month: null });
    expect(segs[3]?.label).toMatch(/^Focus: Sudan/);
    expect(segs[4]?.clear).toEqual({ view: 'flat' });
    expect(segs.slice(1).every((x) => x.clear && x.clearLabel)).toBe(true);
  });

  it('marks the bloc as hidden while a layer paints over it', () => {
    const s: AppState = { ...DEFAULT_STATE, bloc: 'nato', vs: 'eu', layer: 'sanctions', selection: { kind: 'compare' } };
    const segs = mapStateSegments(s, label);
    expect(keys(s)).toEqual(['mode', 'bloc', 'vs', 'layer']);
    expect(segs[1]?.label).toBe('Bloc: NATO (hidden)');
    // Clearing the bloc drops compare and its panel; clearing vs goes back to the bloc panel.
    expect(segs[1]?.clear).toEqual({ bloc: null, vs: null, selection: null });
    expect(segs[2]?.clear).toEqual({ vs: null, selection: { kind: 'bloc', id: 'nato' } });
  });

  it('ignores bloc and month outside their mode, and panels that are not map state', () => {
    expect(keys({ ...DEFAULT_STATE, mode: 'conflicts', bloc: 'nato' })).toEqual(['mode']);
    expect(keys({ ...DEFAULT_STATE, month: '2026-03' })).toEqual(['mode']);
    expect(keys({ ...DEFAULT_STATE, selection: { kind: 'about' } })).toEqual(['mode']);
    expect(mapStateSegments({ ...DEFAULT_STATE, selection: { kind: 'pair', a: 'USA', b: 'CHN' } }, label)[1]?.label).toBe('Focus: United States ↔ China');
  });
});

describe('reset', () => {
  it('returns to the default map but keeps the projection and embed flag', () => {
    const s: AppState = { ...DEFAULT_STATE, mode: 'conflicts', layer: 'sanctions', month: '2026-03', selection: { kind: 'conflict', id: 'sudan' }, view: 'globe', rotation: [10, 10], embed: true };
    expect(resetState(s)).toEqual({ ...DEFAULT_STATE, view: 'globe', rotation: [10, 10], embed: true });
    expect(isDefaultMap(s)).toBe(false);
    expect(isDefaultMap(resetState(s))).toBe(true);
  });
});

describe('bloc suppression', () => {
  it('applies to blocs mode with any layer on', () => {
    expect(blocsSuppressed({ mode: 'blocs', layer: 'chokepoints' })).toBe(true);
    expect(blocsSuppressed({ mode: 'blocs', layer: null })).toBe(false);
    expect(blocsSuppressed({ mode: 'conflicts', layer: 'sanctions' })).toBe(false);
  });
});

describe('sharing', () => {
  it('builds a full-app link without the embed or briefing flags', () => {
    const s: AppState = { ...DEFAULT_STATE, mode: 'conflicts', layer: 'sanctions', brief: true };
    expect(shareUrl(s, 'https://atlas.test')).toBe('https://atlas.test/#mode=conflicts&layer=sanctions');
  });
});
