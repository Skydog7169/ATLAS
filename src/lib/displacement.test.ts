import { describe, expect, it } from 'vitest';
import { COUNTRY_BY_ISO } from './countries';
import { DISPLACEMENT, binLabel, displacementBin, formatPeople } from './displacement';

describe('displacement data', () => {
  it('has a recent year, a fetch date and plausible rows', () => {
    expect(DISPLACEMENT.year).toBeGreaterThanOrEqual(2024);
    expect(DISPLACEMENT.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DISPLACEMENT.rows.length).toBeGreaterThan(100);
    for (const r of DISPLACEMENT.rows) {
      expect(r.total).toBe(r.refugees + r.asylumSeekers + r.idps + r.oip);
      expect(r.total).toBeGreaterThan(0);
    }
  });
  it('mostly uses ISO codes the map knows', () => {
    const unknown = DISPLACEMENT.rows.filter((r) => !COUNTRY_BY_ISO.has(r.iso)).map((r) => r.iso);
    expect(unknown.length).toBeLessThan(5);
  });
  it('ranks the largest displacement crises at the top', () => {
    expect(DISPLACEMENT.rows.slice(0, 5).map((r) => r.iso)).toEqual(expect.arrayContaining(['SDN', 'SYR', 'UKR']));
  });
});

describe('binning and labels', () => {
  it('assigns bins by lower bound', () => {
    expect(displacementBin(0)).toBe(0);
    expect(displacementBin(99_999)).toBe(0);
    expect(displacementBin(100_000)).toBe(1);
    expect(displacementBin(2_999_999)).toBe(3);
    expect(displacementBin(12_000_000)).toBe(5);
  });
  it('formats people counts compactly', () => {
    expect(formatPeople(950)).toBe('950');
    expect(formatPeople(12_400)).toBe('12k');
    expect(formatPeople(1_250_000)).toBe('1.3M');
    expect(formatPeople(12_900_343)).toBe('13M');
    expect(binLabel(0)).toBe('Under 100k');
    expect(binLabel(5)).toBe('6.0M+');
  });
});
