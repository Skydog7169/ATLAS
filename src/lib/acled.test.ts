import { describe, expect, it } from 'vitest';
import { ACLED, acledBin, acledBinLabel, acledColor, acledNote, acledSummary } from './acled';
import { aggregate } from '../../scripts/build-acled.mjs';

describe('acled layer slot', () => {
  it('ships an unavailable placeholder or real rows, never both', () => {
    expect(typeof ACLED.available).toBe('boolean');
    if (!ACLED.available) {
      expect(ACLED.rows).toEqual([]);
      expect(acledNote()).toMatch(/unavailable/);
    } else {
      expect(ACLED.rows.length).toBeGreaterThan(0);
      expect(ACLED.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('bins, labels and colours', () => {
    expect([0, 1, 9, 10, 49, 50, 199, 200, 999, 1000, 5000].map(acledBin)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(acledBinLabel(0)).toBe('No recorded events');
    expect(acledBinLabel(1)).toBe('1–9 events');
    expect(acledBinLabel(5)).toBe('1000+ events');
    expect(acledColor('ZZZ')).toBe('var(--land)');
    expect(acledSummary('ZZZ')).toBeNull();
  });

  it('aggregates API rows per known country', () => {
    const m = aggregate([
      { iso3: 'SDN', fatalities: '3' },
      { iso3: 'SDN', fatalities: 2 },
      { iso3: 'XXX', fatalities: 9 },
      { iso3: 'FRA', fatalities: null },
    ]);
    expect([...m.values()]).toEqual([
      { iso: 'SDN', events: 2, fatalities: 5 },
      { iso: 'FRA', events: 1, fatalities: 0 },
    ]);
  });
});
