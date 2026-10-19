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
