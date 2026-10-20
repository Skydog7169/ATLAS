import { describe, expect, it } from 'vitest';
import { BLOCS } from './blocs';
import { CONFLICTS } from './conflicts';
import { COUNTRY_BY_ISO } from '../lib/countries';
import { COUNTRY_FEATURES, MICROSTATES, hasPolygon } from '../lib/geo';
import { BlocsFileSchema, ConflictsFileSchema } from './schema';
import conflictsJson from './conflicts.json';
import blocsJson from './blocs.json';
import { conflictFillMaps } from '../lib/theatre';
import { SANCTIONS_BY_ISO } from '../lib/sanctions';
import { DISPLACEMENT, DISPLACEMENT_BY_ISO, displacementBin, displacementFill, displacementTotal } from '../lib/displacement';
import { WORLDBANK_BY_ISO, blocFigures } from '../lib/worldbank';
import { blocMembers } from '../lib/membership';

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

describe('json files validate against the shared schema', () => {
  it('conflicts.json', () => {
    const r = ConflictsFileSchema.safeParse(conflictsJson);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
  });
  it('blocs.json', () => {
    const r = BlocsFileSchema.safeParse(blocsJson);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
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

describe('conflict theatres', () => {
  it.each(CONFLICTS.filter((c) => c.theatre).map((c) => [c.id, c] as const))('%s theatre is a subset of its countries', (_id, c) => {
    for (const iso of c.theatre!) expect(c.countries, `${c.id}: theatre ${iso} not in countries`).toContain(iso);
    expect(new Set(c.theatre).size).toBe(c.theatre!.length);
  });

  it('does not count outside belligerents as war zones', () => {
    const { home, abroad } = conflictFillMaps(CONFLICTS.map((c) => ({ conflict: c, intensity: c.intensity })));
    for (const iso of ['USA', 'SAU', 'ARE', 'QAT', 'RWA', 'UGA']) {
      expect(home.has(iso), `${iso} should not be filled`).toBe(false);
      expect(abroad.has(iso), `${iso} should be outlined as a party abroad`).toBe(true);
    }
    for (const iso of ['UKR', 'SDN', 'IRN', 'YEM', 'COD']) expect(home.get(iso)).toBeDefined();
  });
});

describe('sanctions truth', () => {
  it('Ukraine and Moldova are targeted by no regime', () => {
    for (const iso of ['UKR', 'MDA']) expect(SANCTIONS_BY_ISO.get(iso)?.regimes ?? [], iso).toHaveLength(0);
  });
});

describe('displacement truth', () => {
  it('drops UNHCR codes that are not countries', () => {
    for (const iso of ['UNK', 'XXA', 'TIB']) expect(DISPLACEMENT_BY_ISO.has(iso), iso).toBe(false);
    for (const r of DISPLACEMENT.rows) expect(COUNTRY_BY_ISO.has(r.iso), r.iso).toBe(true);
  });

  it('never reports more people displaced from a country than live in it', () => {
    for (const r of DISPLACEMENT.rows) {
      const pop = WORLDBANK_BY_ISO.get(r.iso)?.population;
      if (pop) expect(r.total, `${r.iso}: ${r.total} displaced of ${pop}`).toBeLessThanOrEqual(pop);
    }
  });

  it('Palestine is never shown as barely displaced', () => {
    const row = DISPLACEMENT_BY_ISO.get('PSE')!;
    expect(row.supplement?.unrwaRefugees).toBeGreaterThan(1_000_000);
    expect(displacementBin(displacementTotal(row))).toBeGreaterThan(0);
    expect(displacementFill('PSE').hatch).toBeDefined();
  });
});

describe('conflict panels agree with themselves', () => {
  // The Parties list and the who-backs-whom graph are both shown; an armed actor in one must appear in the other.
  const ALIASES: Record<string, string[]> = { syria: ['Druze forces in Sweida (al-Hijri)'] };
  it.each(CONFLICTS.filter((c) => c.actors).map((c) => [c.id, c] as const))('%s lists every non-mediator actor among its parties', (id, c) => {
    const parties = c.parties.join(' | ').toLowerCase();
    for (const a of c.actors!) {
      if (a.side === 'Mediators' || ALIASES[id]?.includes(a.name)) continue;
      const stem = a.name.split(' (')[0]!.toLowerCase().slice(0, 12);
      expect(parties, `${id}: actor "${a.name}" missing from parties`).toContain(stem);
    }
  });
});

describe('membership counting', () => {
  it('uses one rule: full members counted, suspended and frozen listed apart', () => {
    const au = blocMembers(BLOCS.find((b) => b.id === 'au')!);
    expect(au.full.length + au.suspended.length).toBe(55);
    expect(blocFigures(BLOCS.find((b) => b.id === 'au')!).members).toBe(au.full.length);
  });

  it('records EU candidates without counting them', () => {
    const eu = BLOCS.find((b) => b.id === 'eu')!;
    expect(eu.members.filter((m) => m.status === 'candidate').map((m) => m.iso).sort()).toEqual(['ALB', 'BIH', 'GEO', 'MDA', 'MKD', 'MNE', 'SRB', 'TUR', 'UKR']);
    expect(blocMembers(eu).full).toHaveLength(27);
  });
});
