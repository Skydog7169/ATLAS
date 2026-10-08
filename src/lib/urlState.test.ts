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
