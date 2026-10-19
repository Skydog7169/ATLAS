import { describe, expect, it } from 'vitest';
import { UnrestFileSchema } from '../data/schema';
import unrestJson from '../data/unrest.json';
import { UNREST, UNREST_BY_ID, unrestForCountry } from '../data/unrest';
import { COUNTRY_BY_ISO } from './countries';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { UNREST_COLOR, UNREST_KIND_LABEL, maxUnrestIntensity, unrestColor, unrestDossier, unrestSummary } from './unrest';
import { CHANGES, changesForCountry, watchlistOnly } from './feed';
import { search } from './search';
import { parse, serialize, DEFAULT_STATE } from './urlState';
import { countryDossier } from './dossier';

describe('unrest dataset', () => {
  it('validates, has unique ids and resolves every ISO code', () => {
    const r = UnrestFileSchema.safeParse(unrestJson);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
    const ids = UNREST.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(UNREST.length).toBeGreaterThanOrEqual(25);
    for (const u of UNREST) {
      for (const iso of u.countries) expect(COUNTRY_BY_ISO.has(iso), `${u.id}: ${iso}`).toBe(true);
      expect(CONFLICT_BY_ID.has(u.id), `${u.id} collides with a conflict id`).toBe(false);
      expect(u.history[0]!.date >= u.history.at(-1)!.date, `${u.id} history newest first`).toBe(true);
      expect(u.updated).toBe(u.history[0]!.date);
      for (const h of u.history) for (const s of h.sources) expect(s.url, u.id).toMatch(/^https:\/\//);
      expect(u.history[0]!.date <= '2026-10-19', `${u.id} dated in the future`).toBe(true);
    }
  });

  it('covers every region and all kinds have labels', () => {
    const isos = new Set(UNREST.flatMap((u) => u.countries));
    for (const iso of ['KEN', 'SRB', 'IRN', 'NPL', 'PER', 'USA']) expect(isos.has(iso), iso).toBe(true);
    for (const u of UNREST) expect(UNREST_KIND_LABEL[u.kind]).toBeTruthy();
  });

  it('tints and summarises by the most intense episode', () => {
    expect(maxUnrestIntensity('BRA')).toBeNull();
    expect(unrestColor('BRA')).toBe('var(--land)');
    expect(unrestSummary('BRA')).toBeNull();
    const kenya = maxUnrestIntensity('KEN')!;
    expect(kenya).toBeTruthy();
    expect(unrestColor('KEN')).toContain(UNREST_COLOR[kenya]);
    expect(unrestSummary('KEN')).toMatch(/Kenya Gen Z protests \(.+\)/);
    expect(unrestForCountry('FRA').map((u) => u.id)).toContain('new-caledonia-unrest');
  });

  it('feeds the dossier, the changes feed, the watchlist filter and search', () => {
    const extra = unrestDossier('KEN')!;
    expect(extra.id).toBe('unrest');
    expect(extra.rows[0]!.unrestId).toBe('kenya-gen-z-protests');
    expect(unrestDossier('BRA')).toBeNull();
    expect(countryDossier('KEN')!.sections).toContain('unrest');

    const items = CHANGES.filter((c) => c.kind === 'unrest');
    expect(items.length).toBeGreaterThan(UNREST.length);
    expect(changesForCountry(CHANGES, 'KEN').some((c) => c.kind === 'unrest' && c.id === 'kenya-gen-z-protests')).toBe(true);
    expect(watchlistOnly(CHANGES, new Set(['unrest:kenya-gen-z-protests'])).every((c) => c.kind === 'unrest' && c.id === 'kenya-gen-z-protests')).toBe(true);
    expect(watchlistOnly(CHANGES, new Set(['country:KEN'])).some((c) => c.kind === 'unrest')).toBe(true);

    const hits = search('gen z');
    expect(hits.some((h) => h.kind === 'unrest' && h.id === 'kenya-gen-z-protests')).toBe(true);
    expect(hits.find((h) => h.kind === 'unrest')?.sub).toBe('Protest movement');
  });

  it('round-trips the unrest selection and layer through the URL', () => {
    const state = { ...DEFAULT_STATE, layer: 'unrest' as const, selection: { kind: 'unrest' as const, id: 'kenya-gen-z-protests' } };
    const hash = serialize(state);
    expect(hash).toContain('layer=unrest');
    expect(hash).toContain('unrest=kenya-gen-z-protests');
    const valid = { bloc: () => true, conflict: () => true, country: () => true, chokepoint: () => true, unrest: (id: string) => UNREST_BY_ID.has(id) };
    expect(parse(hash, valid)).toEqual(state);
    expect(parse('#unrest=nope', valid).selection).toBeNull();
  });
});
