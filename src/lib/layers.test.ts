import { describe, expect, it } from 'vitest';
import { COUNTRY_BY_ISO } from './countries';
import { ElectionsFileSchema, NuclearFileSchema, SanctionsFileSchema } from '../data/schema';
import sanctionsJson from '../data/sanctions.generated.json';
import electionsJson from '../data/elections.json';
import nuclearJson from '../data/nuclear.json';
import { SANCTIONS, SANCTIONS_BY_ISO, sanctionsBin, sanctionsBinLabel, sanctionsColor, sanctionsSummary } from './sanctions';
import { ELECTIONS, electionBin, electionBinLabel, electionColor, formatElectionDate, monthsUntil, electionSummary } from './elections';
import { NUCLEAR, NUCLEAR_BY_ISO, nuclearColor, nuclearCount, nuclearSummary, testsFor } from './nuclear';

describe('sanctions dataset', () => {
  it('validates and resolves every ISO code', () => {
    const r = SanctionsFileSchema.safeParse(sanctionsJson);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
    for (const row of SANCTIONS.rows) expect(COUNTRY_BY_ISO.has(row.iso), row.iso).toBe(true);
    expect(SANCTIONS.unmapped, 'OFAC programmes needing a mapping').toEqual([]);
  });

  it('covers the headline regimes', () => {
    const auth = (iso: string) => new Set(SANCTIONS_BY_ISO.get(iso)?.regimes.map((r) => r.authority));
    expect(auth('PRK')).toEqual(new Set(['UN', 'US', 'EU']));
    expect(auth('RUS')).toEqual(new Set(['US', 'EU']));
    expect(auth('IRN')).toEqual(new Set(['UN', 'US', 'EU']));
    expect(auth('CUB')).toEqual(new Set(['US']));
    expect(SANCTIONS_BY_ISO.has('FRA')).toBe(false);
  });

  it('bins and summarises', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(sanctionsBin)).toEqual([0, 1, 2, 3, 3, 4, 4]);
    expect(sanctionsBinLabel(0)).toBe('No country regime');
    expect(sanctionsBinLabel(1)).toBe('1 regime');
    expect(sanctionsBinLabel(3)).toBe('3–4 regimes');
    expect(sanctionsBinLabel(4)).toBe('5+ regimes');
    expect(sanctionsColor('FRA')).toBe('var(--land)');
    expect(sanctionsColor('RUS')).toBe('#ffd166');
    expect(sanctionsSummary('PRK')).toBe('UN · US · EU');
    expect(sanctionsSummary('RUS')).toMatch(/^US×\d · EU×\d$/);
    expect(sanctionsSummary('FRA')).toBeNull();
  });
});

describe('elections dataset', () => {
  it('validates, resolves every ISO code and has no duplicates', () => {
    const r = ElectionsFileSchema.safeParse(electionsJson);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
    const isos = ELECTIONS.rows.map((x) => x.iso);
    expect(new Set(isos).size).toBe(isos.length);
    for (const iso of isos) expect(COUNTRY_BY_ISO.has(iso), iso).toBe(true);
    expect(ELECTIONS.rows.length).toBeGreaterThan(150);
    for (const row of ELECTIONS.rows) for (const s of row.sources) expect(s.url).toMatch(/^https:\/\//);
  });

  it('counts months and bins them', () => {
    const now = new Date('2026-10-08T00:00:00Z');
    expect(monthsUntil('2026-11-03', now)).toBe(0);
    expect(monthsUntil('2027-04-18', now)).toBe(6);
    expect(monthsUntil('2027-04', now)).toBe(5);
    expect(monthsUntil('2030', now)).toBeGreaterThan(36);
    expect(monthsUntil('2026-01-01', now)).toBeLessThan(0);
    expect([null, -1, 0, 2, 3, 5, 6, 11, 12, 23, 24, 60].map(electionBin)).toEqual([0, 0, 4, 4, 3, 3, 2, 2, 1, 1, 1, 1]);
    expect(electionBinLabel(4)).toBe('Within 3 months');
    expect(electionBinLabel(3)).toBe('3–6 months');
    expect(electionBinLabel(1)).toBe('24+ months away');
    expect(electionBinLabel(0)).toBe('No date set');
    expect(electionColor('USA', now)).toBe('#8cff7a');
    expect(electionColor('ZZZ', now)).toBe('var(--land)');
  });

  it('formats dates at the precision known', () => {
    expect(formatElectionDate({ iso: 'X', date: '2026-11-03', type: 'legislative', sources: [], verified: '2026-10-08' })).toBe('Nov 3, 2026');
    expect(formatElectionDate({ iso: 'X', date: '2027-04', type: 'legislative', sources: [], verified: '2026-10-08' })).toBe('Apr 2027');
    expect(formatElectionDate({ iso: 'X', date: '2029', type: 'legislative', deadline: true, sources: [], verified: '2026-10-08' })).toBe('by 2029');
    expect(formatElectionDate({ iso: 'X', date: null, type: 'general', sources: [], verified: '2026-10-08' })).toBe('No date set');
    expect(electionSummary('USA', new Date('2026-10-08T00:00:00Z'))).toBe('Legislative election Nov 3, 2026 (this month)');
  });
});

describe('nuclear dataset', () => {
  it('validates and lists the nine armed states', () => {
    const r = NuclearFileSchema.safeParse(nuclearJson);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
    for (const s of NUCLEAR.statuses) expect(COUNTRY_BY_ISO.has(s.iso), s.iso).toBe(true);
    const armed = NUCLEAR.statuses.filter((s) => s.status === 'armed').map((s) => s.iso).sort();
    expect(armed).toEqual(['CHN', 'FRA', 'GBR', 'IND', 'ISR', 'PAK', 'PRK', 'RUS', 'USA']);
    expect(nuclearCount('armed')).toBe(9);
  });

  it('extends the umbrella to NATO members without their own status', () => {
    expect(NUCLEAR_BY_ISO.get('POL')?.status).toBe('umbrella');
    expect(NUCLEAR_BY_ISO.get('DEU')?.status).toBe('hosting');
    expect(NUCLEAR_BY_ISO.get('JPN')?.status).toBe('umbrella');
    expect(NUCLEAR_BY_ISO.has('BRA')).toBe(false);
    expect(nuclearColor('BRA')).toBe('var(--land)');
    expect(nuclearCount('umbrella')).toBeGreaterThan(20);
  });

  it('orders tests newest first and summarises', () => {
    const t = testsFor('PRK');
    expect(t[0]?.date).toBe('2017-09-03');
    expect(t.map((x) => x.date)).toEqual([...t.map((x) => x.date)].sort().reverse());
    expect(nuclearSummary('PRK')).toBe('Nuclear-armed · last test Sep 3, 2017');
    expect(nuclearSummary('IRN')).toBe('Threshold state');
    expect(nuclearSummary('BRA')).toBeNull();
  });
});
