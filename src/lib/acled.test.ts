import { describe, expect, it } from 'vitest';
import { ACLED, acledBin, acledBinLabel, acledColor, acledDossier, acledNote, acledSummary, acledUnrestColor, acledUnrestEvents, acledUnrestSummary } from './acled';
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

  it('counts events by type and derives the protests-and-riots view', () => {
    const m = aggregate([
      { iso3: 'KEN', event_type: 'Protests', fatalities: 0 },
      { iso3: 'KEN', event_type: 'Riots', fatalities: 2 },
      { iso3: 'KEN', event_type: 'Battles', fatalities: 5 },
      { iso3: 'KEN', event_type: 'Something new', fatalities: 0 },
    ]);
    expect(m.get('KEN')).toEqual({ iso: 'KEN', events: 4, fatalities: 7, byType: { battles: 1, explosions: 0, civilians: 0, protests: 1, riots: 1, strategic: 0 } });
    expect(acledUnrestEvents('ZZZ')).toBe(0);
    expect(acledUnrestColor('ZZZ')).toBe('var(--land)');
    expect(acledUnrestSummary('ZZZ')).toBeNull();
    expect(acledDossier('ZZZ')).toBeNull();
  });

  it('aggregates API rows per known country', () => {
    const m = aggregate([
      { iso3: 'SDN', fatalities: '3' },
      { iso3: 'SDN', fatalities: 2 },
      { iso3: 'XXX', fatalities: 9 },
      { iso3: 'FRA', fatalities: null },
    ]);
    const none = { battles: 0, explosions: 0, civilians: 0, protests: 0, riots: 0, strategic: 0 };
    expect([...m.values()]).toEqual([
      { iso: 'SDN', events: 2, fatalities: 5, byType: none },
      { iso: 'FRA', events: 1, fatalities: 0, byType: none },
    ]);
  });
});
