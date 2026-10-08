import { describe, expect, it } from 'vitest';
import { BLOCS, BLOC_BY_ID } from '../data/blocs';
import { WB_HISTORY, gdpIn } from './worldbankHistory';
import { blocTrend, membersIn, trendComplete } from './trends';

describe('world bank history', () => {
  it('covers 1990 onward for most countries', () => {
    expect(WB_HISTORY.from).toBe(1990);
    expect(WB_HISTORY.to).toBeGreaterThanOrEqual(2023);
    expect(Object.keys(WB_HISTORY.gdpUsd).length).toBeGreaterThan(150);
    expect(gdpIn('POL', 1990)).toBeGreaterThan(50e9);
    expect(gdpIn('POL', 1989)).toBeNull();
    expect(gdpIn('ZZZ', 2000)).toBeNull();
  });
});

describe('bloc trends', () => {
  it('every counted member of every bloc has an accession year', () => {
    for (const b of BLOCS) expect(trendComplete(b), b.id).toBe(true);
  });

  it('reconstructs NATO and the EU by year', () => {
    const nato = BLOC_BY_ID.get('nato')!;
    expect(membersIn(nato, 1990)).toHaveLength(16);
    expect(membersIn(nato, 2004)).toHaveLength(26);
    expect(membersIn(nato, 2026)).toHaveLength(32);
    const eu = BLOC_BY_ID.get('eu')!;
    expect(membersIn(eu, 1995)).toHaveLength(15);
    expect(membersIn(eu, 2019)).toContain('GBR');
    expect(membersIn(eu, 2020)).not.toContain('GBR');
    expect(membersIn(eu, 2026)).toHaveLength(27);
  });

  it('handles exits and re-entries', () => {
    const opec = BLOC_BY_ID.get('opec')!;
    expect(membersIn(opec, 2018)).toContain('QAT');
    expect(membersIn(opec, 2019)).not.toContain('QAT');
    expect(membersIn(opec, 2010)).not.toContain('GAB');
    expect(membersIn(opec, 2016)).toContain('GAB');
    const ecowas = BLOC_BY_ID.get('ecowas')!;
    expect(membersIn(ecowas, 2024)).toContain('MLI');
    expect(membersIn(ecowas, 2025)).not.toContain('MLI');
  });

  it('produces one point per year with growing GDP coverage', () => {
    const t = blocTrend(BLOC_BY_ID.get('nato')!);
    expect(t[0]!.year).toBe(1990);
    expect(t.at(-1)!.year).toBe(WB_HISTORY.to);
    expect(t.at(-1)!.members).toBe(32);
    expect(t.at(-1)!.covered).toBeGreaterThan(25);
    expect(t.at(-1)!.gdpUsd).toBeGreaterThan(t[0]!.gdpUsd);
    const aes = blocTrend(BLOC_BY_ID.get('aes')!);
    expect(aes[0]!.year).toBe(2023);
  });
});

describe('former members', () => {
  it('have ordered spells that end before or at the present', () => {
    for (const b of BLOCS) {
      for (const f of b.former ?? []) {
        expect(f.since).toBeLessThan(f.until);
        expect(f.until).toBeLessThanOrEqual(new Date().getFullYear());
        expect(b.members.some((m) => m.iso === f.iso && m.status === 'member' && m.since !== undefined && m.since < f.until && m.since >= f.since)).toBe(false);
      }
    }
  });
});
