import { describe, expect, it } from 'vitest';
import { DEFAULT_EMBED_OPTS, DEFAULT_STATE, parse, serialize } from './urlState';
import { clampMonth, monthRange } from './history';

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

describe('replay month', () => {
  const months = monthRange('2025-12', '2026-10');
  const withMonth = { ...valid, month: (m: string) => clampMonth(m, months).month };
  it('clamps a month before the replay range to its first stop', () => {
    expect(parse('#mode=conflicts&t=2023-01', withMonth).month).toBe('2025-12');
  });
  it('treats a month after the range as live and drops it from the rewritten hash', () => {
    const s = parse('#mode=conflicts&t=2099-01', withMonth);
    expect(s.month).toBeNull();
    expect(serialize(s)).not.toContain('t=');
  });
  it('keeps an in-range month and rejects malformed ones', () => {
    expect(parse('#mode=conflicts&t=2026-03', withMonth).month).toBe('2026-03');
    expect(parse('#mode=conflicts&t=2026-13', withMonth).month).toBeNull();
  });
});

describe('embed host options', () => {
  it('round-trips legend, interaction and theme only when embedded', () => {
    const hash = serialize({ ...DEFAULT_STATE, embed: true, embedOpts: { legend: 'off', interactive: false }, theme: 'light' });
    expect(hash).toContain('legend=off');
    expect(hash).toContain('interactive=0');
    expect(hash).toContain('theme=light');
    expect(parse(hash, valid).embedOpts).toEqual({ legend: 'off', interactive: false });
    expect(parse(hash, valid).theme).toBe('light');
    expect(serialize({ ...DEFAULT_STATE, embedOpts: { legend: 'off', interactive: false }, theme: 'light' })).not.toMatch(/legend|interactive|theme/);
  });
  it('falls back to defaults for unknown values and outside embeds', () => {
    expect(parse('#embed=1&legend=huge&interactive=maybe', valid).embedOpts).toEqual(DEFAULT_EMBED_OPTS);
    expect(parse('#legend=off', valid).embedOpts).toEqual(DEFAULT_EMBED_OPTS);
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
