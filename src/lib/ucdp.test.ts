import { describe, expect, it } from 'vitest';
import { UcdpFileSchema } from '../data/schema';
import ucdpJson from '../data/ucdp.generated.json';
import { UCDP, ucdpBin, ucdpBinLabel, ucdpColor, ucdpDossier, ucdpNote, ucdpSummary } from './ucdp';
import { aggregate, isoForName } from '../../scripts/build-ucdp.mjs';

describe('ucdp layer slot', () => {
  it('ships a valid file: an unavailable placeholder or real rows', () => {
    const r = UcdpFileSchema.safeParse(ucdpJson);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
    if (!UCDP.available) {
      expect(UCDP.rows).toEqual([]);
      expect(ucdpNote()).toMatch(/unavailable/);
      expect(ucdpDossier('SDN')).toBeNull();
    } else {
      expect(UCDP.rows.length).toBeGreaterThan(0);
      expect(UCDP.from).toMatch(/^\d{4}-01-01$/);
    }
  });

  it('bins, labels and colours', () => {
    expect([0, 1, 24, 25, 99, 100, 999, 1000, 9999, 10000].map(ucdpBin)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
    expect(ucdpBinLabel(0)).toBe('No recorded deaths');
    expect(ucdpBinLabel(2)).toBe('25–99 deaths');
    expect(ucdpBinLabel(5)).toBe('10,000+ deaths');
    expect(ucdpColor('ZZZ')).toBe('var(--land)');
    expect(ucdpSummary('ZZZ')).toBeNull();
  });

  it('maps GED country names to ISO codes, with parentheticals stripped', () => {
    expect(isoForName('Russia (Soviet Union)')).toBe('RUS');
    expect(isoForName('DR Congo (Zaire)')).toBe('COD');
    expect(isoForName('Myanmar (Burma)')).toBe('MMR');
    expect(isoForName('Sudan')).toBe('SDN');
    expect(isoForName('United States of America')).toBe('USA');
    expect(isoForName('Atlantis')).toBeNull();
  });

  it('aggregates best-estimate deaths by violence type', () => {
    const unmapped = new Set<string>();
    const m = aggregate(
      [
        { country: 'Sudan', type_of_violence: 1, best: 120 },
        { country: 'Sudan', type_of_violence: '3', best: '30' },
        { country: 'Sudan', type_of_violence: 2, best: null },
        { country: 'Atlantis', type_of_violence: 1, best: 5 },
      ],
      new Map(),
      unmapped,
    );
    expect(m.get('SDN')).toEqual({ iso: 'SDN', stateBased: 120, nonState: 0, oneSided: 30, events: 3 });
    expect([...unmapped]).toEqual(['Atlantis']);
  });
});
