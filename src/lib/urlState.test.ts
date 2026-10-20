import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, parse, parseHash, serialize, type AppState } from './urlState';

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

describe('history-friendly hash', () => {
  const all = { ...valid, chokepoint: (id: string) => id === 'hormuz', unrest: (id: string) => id === 'serbia-protests', country: (iso: string) => iso === 'UKR' || iso === 'RUS' };
  const selections: AppState['selection'][] = [
    null,
    { kind: 'country', iso: 'UKR' },
    { kind: 'bloc', id: 'nato' },
    { kind: 'conflict', id: 'sudan' },
    { kind: 'changes' },
    { kind: 'compare' },
    { kind: 'about' },
    { kind: 'watchlist' },
    { kind: 'chokepoint', id: 'hormuz' },
    { kind: 'unrest', id: 'serbia-protests' },
    { kind: 'pair', a: 'UKR', b: 'RUS' },
    { kind: 'pair', a: 'UKR', b: null },
    { kind: 'ask' },
  ];

  for (const selection of selections) {
    for (const [bloc, vs] of [[null, null], ['nato', null], ['nato', 'eu']] as const) {
      // A bloc panel always names its own bloc; compare needs both.
      if (selection?.kind === 'bloc' && bloc !== 'nato') continue;
      if (selection?.kind === 'compare' && !vs) continue;
      const mode = selection?.kind === 'conflict' ? 'conflicts' : 'blocs';
      it(`round-trips ${selection?.kind ?? 'no panel'} with bloc=${bloc} vs=${vs}`, () => {
        const state: AppState = { ...DEFAULT_STATE, mode, bloc, vs, selection };
        // The bloc highlight isn't written while the conflicts map is up.
        expect(parse(serialize(state), all)).toEqual(mode === 'conflicts' ? { ...state, bloc: null, vs: null } : state);
      });
    }
  }

  it('keeps a closed bloc panel closed (panel=0) while old #bloc= links still open it', () => {
    const closed = serialize({ ...DEFAULT_STATE, bloc: 'nato', vs: 'eu', selection: null });
    expect(closed).toContain('panel=0');
    expect(parse(closed, valid).selection).toBeNull();
    expect(parse(closed, valid).vs).toBe('eu');
    expect(parse('#mode=blocs&bloc=nato', valid).selection).toEqual({ kind: 'bloc', id: 'nato' });
    expect(parse('#mode=blocs&bloc=nato&vs=eu', valid).selection).toEqual({ kind: 'compare' });
    expect(serialize({ ...DEFAULT_STATE, selection: null })).not.toContain('panel=');
  });

  it('never opens a bloc panel over the conflicts map, and shows wars on it', () => {
    expect(parse('#mode=conflicts&bloc=nato', valid).selection).toBeNull();
    expect(parse('#mode=conflicts&bloc=nato&vs=eu', valid).selection).toBeNull();
    expect(parse('#mode=blocs&conflict=sudan', valid).mode).toBe('conflicts');
    const hash = serialize({ ...DEFAULT_STATE, mode: 'conflicts', bloc: 'nato', vs: 'eu', selection: null });
    expect(hash).toBe('#mode=conflicts');
  });

  it('reports ids the edition does not know', () => {
    const { state, dropped } = parseHash('#layer=unrest&unrest=old-episode&country=ZZZ&bloc=gone', all);
    expect(state.selection).toBeNull();
    expect(dropped).toEqual(
      expect.arrayContaining([
        { kind: 'unrest', id: 'old-episode' },
        { kind: 'country', id: 'ZZZ' },
        { kind: 'bloc', id: 'gone' },
      ]),
    );
    expect(parseHash('#mode=conflicts&conflict=no-such-war', all).dropped).toEqual([{ kind: 'conflict', id: 'no-such-war' }]);
    expect(parseHash('#pair=UKR,ZZZ', all).dropped).toEqual([{ kind: 'pair', id: 'UKR,ZZZ' }]);
    expect(parseHash('#mode=blocs&country=UKR', all).dropped).toEqual([]);
  });
});
