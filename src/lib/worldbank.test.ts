import { describe, expect, it } from 'vitest';
import { BLOC_BY_ID } from '../data/blocs';
import { COUNTRY_BY_ISO } from './countries';
import { WORLD, WORLDBANK, blocFigures, formatCount, formatUsd, share } from './worldbank';

describe('world bank data', () => {
  it('only contains known countries and plausible world totals', () => {
    for (const r of WORLDBANK.rows) expect(COUNTRY_BY_ISO.has(r.iso), r.iso).toBe(true);
    expect(WORLD.population).toBeGreaterThan(7.5e9);
    expect(WORLD.population).toBeLessThan(9e9);
    expect(WORLD.gdpUsd).toBeGreaterThan(80e12);
    expect(WORLD.militaryUsd).toBeGreaterThan(2e12);
  });
  it('sums bloc members with coverage counts', () => {
    const nato = blocFigures(BLOC_BY_ID.get('nato')!);
    expect(nato.members).toBe(32);
    expect(nato.coverage.population).toBe(32);
    expect(nato.militaryUsd).toBeGreaterThan(1.2e12);
    expect(nato.population).toBeLessThan(1.1e9);
  });
});

describe('formatting', () => {
  it('formats currency and counts compactly', () => {
    expect(formatUsd(3.37e12)).toBe('$3.4T');
    expect(formatUsd(6.47e10)).toBe('$64.7B');
    expect(formatUsd(9.97e11)).toBe('$997B');
    expect(formatCount(68_720_337)).toBe('69M');
    expect(formatCount(1_420_000_000)).toBe('1.42bn');
    expect(share(25, 100)).toBe('25%');
    expect(share(2.5, 100)).toBe('2.5%');
  });
});
