import { describe, expect, it } from 'vitest';
import { BLOCS } from './blocs';
import { CONFLICTS } from './conflicts';
import { COUNTRY_BY_ISO } from '../lib/countries';
import { COUNTRY_FEATURES, MICROSTATES, hasPolygon } from '../lib/geo';

const ISO3 = /^[A-Z]{3}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

describe('country reference data', () => {
  it('resolves every map polygon with an id to a country', () => {
    const unresolved = COUNTRY_FEATURES.filter((f) => f.properties.iso === null).map((f) => f.properties.name);
    expect(unresolved.sort()).toEqual(['N. Cyprus', 'Somaliland']);
  });

  it('draws microstates as markers rather than dropping them', () => {
    const isos = MICROSTATES.map((m) => m.iso);
    expect(isos).toEqual(expect.arrayContaining(['MLT', 'SGP', 'BHR']));
    for (const m of MICROSTATES) expect(hasPolygon(m.iso)).toBe(false);
  });
});

describe('blocs', () => {
  it('has unique ids and colours', () => {
    expect(new Set(BLOCS.map((b) => b.id)).size).toBe(BLOCS.length);
    expect(new Set(BLOCS.map((b) => b.color)).size).toBe(BLOCS.length);
  });

  it.each(BLOCS.map((b) => [b.id, b] as const))('%s members resolve to known countries', (_id, bloc) => {
    expect(bloc.updated).toMatch(MONTH);
    expect(bloc.members.length).toBeGreaterThan(0);
    expect(new Set(bloc.members.map((m) => m.iso)).size).toBe(bloc.members.length);
    for (const m of bloc.members) {
      expect(m.iso).toMatch(ISO3);
      expect(COUNTRY_BY_ISO.has(m.iso), `${bloc.id}: unknown ISO ${m.iso}`).toBe(true);
      expect(hasPolygon(m.iso) || MICROSTATES.some((x) => x.iso === m.iso), `${bloc.id}: ${m.iso} is not drawable`).toBe(true);
    }
    for (const s of bloc.sources) expect(s.url).toMatch(/^https:\/\//);
    const dates = bloc.changes.map((c) => c.date);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const ch of bloc.changes) {
      expect(ch.date).toMatch(DATE);
      expect(COUNTRY_BY_ISO.has(ch.iso), `${bloc.id}: unknown ISO ${ch.iso} in changes`).toBe(true);
    }
  });

  it('has the expected headline member counts', () => {
    const full = (id: string) => BLOCS.find((b) => b.id === id)!.members.filter((m) => m.status === 'member').length;
    expect(full('nato')).toBe(32);
    expect(full('eu')).toBe(27);
    expect(full('brics')).toBe(10);
    expect(full('asean')).toBe(11);
    expect(full('au') + BLOCS.find((b) => b.id === 'au')!.members.filter((m) => m.status === 'suspended').length).toBe(55);
    expect(full('arab-league')).toBe(22);
    expect(full('opec')).toBe(11);
  });
});

describe('conflicts', () => {
  it('has unique ids', () => {
    expect(new Set(CONFLICTS.map((c) => c.id)).size).toBe(CONFLICTS.length);
  });

  it.each(CONFLICTS.map((c) => [c.id, c] as const))('%s is well-formed', (_id, c) => {
    expect(c.updated).toMatch(DATE);
    expect(c.history.length).toBeGreaterThan(0);
    const dates = c.history.map((h) => h.date);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const h of c.history) {
      expect(h.date).toMatch(DATE);
      expect(h.status.length).toBeGreaterThan(40);
      expect(h.sources.length).toBeGreaterThan(0);
      for (const s of h.sources) expect(s.url).toMatch(/^https:\/\//);
    }
    expect(c.status).toBe(c.history[0]!.status);
    const [lon, lat] = c.location;
    expect(lon).toBeGreaterThanOrEqual(-180);
    expect(lon).toBeLessThanOrEqual(180);
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
    expect(c.countries.length).toBeGreaterThan(0);
    for (const iso of c.countries) expect(COUNTRY_BY_ISO.has(iso), `${c.id}: unknown ISO ${iso}`).toBe(true);
    expect(c.parties.length).toBeGreaterThan(0);
    expect(c.summary.length).toBeGreaterThan(40);
    expect(c.status.length).toBeGreaterThan(40);
    expect(c.sources.length).toBeGreaterThan(0);
  });
});
