import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, parse, serialize } from './urlState';

const valid = { bloc: (id: string) => id === 'nato' || id === 'eu', conflict: (id: string) => id === 'sudan', country: (iso: string) => iso === 'UKR' };

describe('url state', () => {
  it('round-trips the country dossier link', () => {
    const hash = serialize({ ...DEFAULT_STATE, selection: { kind: 'country', iso: 'UKR' } });
    expect(hash).toBe('#mode=blocs&country=UKR');
    expect(parse(hash, valid).selection).toEqual({ kind: 'country', iso: 'UKR' });
    expect(parse('#country=ukr', valid).selection).toEqual({ kind: 'country', iso: 'UKR' });
  });

  it('round-trips the watchlist panel and drops unknown entities', () => {
    const hash = serialize({ ...DEFAULT_STATE, selection: { kind: 'watchlist' } });
    expect(parse(hash, valid).selection).toEqual({ kind: 'watchlist' });
    expect(parse('#country=ZZZ', valid).selection).toBeNull();
    expect(parse('#conflict=nope', valid).selection).toBeNull();
  });
});

describe('presentation state', () => {
  it('round-trips globe view and rotation, briefing and embed flags', () => {
    const hash = serialize({ ...DEFAULT_STATE, view: 'globe', rotation: [-74, 41], brief: true, embed: true });
    expect(hash).toContain('view=globe');
    expect(hash).toContain('rot=-74%2C41');
    const s = parse(hash, valid);
    expect(s.view).toBe('globe');
    expect(s.rotation).toEqual([-74, 41]);
    expect(s.brief).toBe(true);
    expect(s.embed).toBe(true);
    expect(serialize({ ...DEFAULT_STATE, view: 'globe' })).not.toContain('rot=');
    expect(parse('#view=globe&rot=200,95', valid).rotation).toEqual([-160, 89]);
    expect(parse('#view=globe&rot=junk', valid).rotation).toEqual(DEFAULT_STATE.rotation);
    expect(parse('#', valid).view).toBe('flat');
  });
});

describe('layers this build cannot draw', () => {
  const offline = new Set(['acled', 'acled-unrest', 'ucdp']);
  const withLayers = { ...valid, layer: (id: string) => !offline.has(id) };

  it('keeps available layers', () => {
    expect(parse('#mode=blocs&layer=sanctions', withLayers).layer).toBe('sanctions');
  });

  it('sends ACLED protest links to the tracked unrest layer', () => {
    const s = parse('#mode=blocs&layer=acled-unrest', withLayers);
    expect(s.layer).toBe('unrest');
    expect(s.mode).toBe('blocs');
  });

  it('sends violence-event links to tracked conflicts instead of an all-zero map', () => {
    for (const l of ['acled', 'ucdp']) {
      const s = parse(`#mode=blocs&layer=${l}`, withLayers);
      expect(s.layer).toBeNull();
      expect(s.mode).toBe('conflicts');
    }
  });

  it('accepts every known layer when no validator is given', () => {
    expect(parse('#layer=ucdp', valid).layer).toBe('ucdp');
  });
});
