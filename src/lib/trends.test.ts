import { describe, expect, it } from 'vitest';
import { BLOCS, BLOC_BY_ID } from '../data/blocs';
import { WB_HISTORY, gdpIn } from './worldbankHistory';
import { blocTrend, gdpCarried, lastChange, membersIn, trendComplete } from './trends';
import { blocFigures } from './worldbank';

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
    expect(t.at(-1)!.covered).toBe(32);
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

describe('combined GDP never collapses because a member has not reported yet', () => {
  it('GCC last point is within 5% of the previous one', () => {
    const t = blocTrend(BLOC_BY_ID.get('gcc')!);
    expect(Math.abs(t.at(-1)!.gdpUsd - t.at(-2)!.gdpUsd) / t.at(-2)!.gdpUsd).toBeLessThan(0.05);
  });

  it.each(['gcc', 'opec', 'arab-league', 'brics', 'au'])('%s does not fall more than 5 percent in the last year', (id) => {
    const t = blocTrend(BLOC_BY_ID.get(id)!);
    expect(t.at(-1)!.gdpUsd, id).toBeGreaterThan(t.at(-2)!.gdpUsd * 0.95);
  });

  it('carries a missing year forward and records it', () => {
    const iso = Object.keys(WB_HISTORY.gdpUsd).find((k) => gdpIn(k, WB_HISTORY.to) === null && gdpIn(k, WB_HISTORY.to - 1) !== null);
    if (!iso) return;
    expect(gdpCarried(iso, WB_HISTORY.to)).toEqual({ value: gdpIn(iso, WB_HISTORY.to - 1), from: WB_HISTORY.to - 1 });
  });

  it('agrees with the At a glance tile for blocs whose membership has not changed since the last data year', () => {
    for (const id of ['gcc', 'au', 'mercosur', 'ecowas', 'brics', 'csto']) {
      const b = BLOC_BY_ID.get(id)!;
      expect(blocTrend(b).at(-1)!.gdpUsd, id).toBeCloseTo(blocFigures(b).gdpUsd, -9);
    }
  });

  it('reports a world share and the last membership change', () => {
    const t = blocTrend(BLOC_BY_ID.get('brics')!);
    expect(t.at(-1)!.worldShare).toBeGreaterThan(0.15);
    expect(t.at(-1)!.worldShare).toBeLessThan(0.5);
    expect(lastChange(BLOC_BY_ID.get('gcc')!)).toBe(1981);
  });
});
