import { describe, expect, it } from 'vitest';
import { COUNTRY_BY_ISO } from './countries';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { ChokepointsFileSchema, MilitaryFileSchema, TradeFileSchema } from '../data/schema';
import chokepointsJson from '../data/chokepoints.json';
import militaryJson from '../data/military.json';
import tradeJson from '../data/trade.generated.json';
import { CHOKEPOINTS, CHOKEPOINT_BY_ID, currentStatus, linkedConflicts } from './chokepoints';
import { MILITARY, PRESENCE_ACTIVE, militaryBin, militaryBinLabel, militaryColor, militaryDossier, militarySummary, operatorsIn, presencesBy } from './military';
import { TRADE, leadingPartner, tradeColor, tradeDossier, tradeSummary } from './trade';
import { EU27, buildRows, parseSdmx } from '../../scripts/build-trade.mjs';
import { countryDossier } from './dossier';

describe('chokepoints', () => {
  it('validates, has the eight agreed passages and resolves linked conflicts', () => {
    const r = ChokepointsFileSchema.safeParse(chokepointsJson);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
    expect(CHOKEPOINTS.map((c) => c.id).sort()).toEqual(['bab-el-mandeb', 'bosporus', 'giuk', 'hormuz', 'malacca', 'panama', 'suez', 'taiwan-strait']);
    for (const c of CHOKEPOINTS) {
      for (const id of c.conflicts) expect(CONFLICT_BY_ID.has(id), `${c.id}: ${id}`).toBe(true);
      const dates = c.history.map((h) => h.date);
      expect(dates).toEqual([...dates].sort().reverse());
    }
    expect(currentStatus(CHOKEPOINT_BY_ID.get('hormuz')!).status).toBe('closed');
    expect(linkedConflicts(CHOKEPOINT_BY_ID.get('bab-el-mandeb')!).map((c) => c.id)).toEqual(['yemen']);
  });
});

describe('military presence', () => {
  it('validates and resolves every host and state operator', () => {
    const r = MilitaryFileSchema.safeParse(militaryJson);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
    for (const p of MILITARY.presence) {
      expect(COUNTRY_BY_ISO.has(p.host), `host ${p.host}`).toBe(true);
      if (p.operator.length === 3) expect(COUNTRY_BY_ISO.has(p.operator), `operator ${p.operator}`).toBe(true);
    }
    expect(PRESENCE_ACTIVE.length).toBeGreaterThan(60);
    expect(PRESENCE_ACTIVE.some((p) => p.ended)).toBe(false);
  });

  it('counts distinct foreign operators per host and bins them', () => {
    expect(operatorsIn('DJI').sort()).toEqual(['CHN', 'FRA', 'ITA', 'JPN', 'USA']);
    expect(operatorsIn('ISL')).toEqual([]);
    expect(presencesBy('RUS').length).toBeGreaterThan(5);
    expect([0, 1, 2, 3, 4, 5, 9].map(militaryBin)).toEqual([0, 1, 2, 3, 3, 4, 4]);
    expect(militaryBinLabel(1)).toBe('1 foreign operator');
    expect(militaryBinLabel(4)).toBe('5+ foreign operators');
    expect(militaryColor('DJI')).toBe('#9fc0ff');
    expect(militaryColor('ISL')).toBe('var(--land)');
    expect(militarySummary('SEN')).toBeNull();
    expect(militarySummary('DJI')).toMatch(/^Hosts: /);
  });

  it('builds a dossier section for hosts and operators, with ended rows in the footnote', () => {
    const fra = militaryDossier('FRA')!;
    expect(fra.rows.some((r) => r.countryIso === 'DJI')).toBe(true);
    expect(fra.footnote).toMatch(/Ended: .*Senegal/);
    expect(militaryDossier('ISL')).toBeNull();
    expect(countryDossier('DJI')!.sections).toContain('military');
  });
});

describe('trade dependence', () => {
  it('validates the generated file', () => {
    const r = TradeFileSchema.safeParse(tradeJson);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
    for (const row of TRADE.rows) {
      expect(COUNTRY_BY_ISO.has(row.iso), row.iso).toBe(true);
      expect(row.us + row.china + row.eu).toBeLessThanOrEqual(1.001);
    }
  });

  it('picks the leading partner above a floor and tints by share', () => {
    expect(leadingPartner({ iso: 'X', year: 2023, exportsUsd: 1, us: 0.5, china: 0.2, eu: 0.1 })).toBe('us');
    expect(leadingPartner({ iso: 'X', year: 2023, exportsUsd: 1, us: 0.05, china: 0.05, eu: 0.09 })).toBeNull();
    expect(tradeColor('MEX')).toMatch(/^color-mix\(in srgb, #4f8cff 100%/);
    expect(tradeColor('ZZZ')).toBe('var(--land)');
    expect(tradeSummary('MEX')).toMatch(/^Exports 20\d\d: US \d+% · China \d+% · EU \d+%$/);
    expect(tradeDossier('DEU')!.rows.find((r) => r.label === 'European Union')!.note).toBe('Largest of the three');
    expect(countryDossier('DEU')!.sections).toContain('trade');
  });

  it('parses WITS SDMX and computes EU shares from member rows', () => {
    const json = {
      structure: { dimensions: { series: [{ id: 'FREQ', values: [{ id: 'A' }] }, { id: 'REPORTER', values: [{ id: 'MEX' }, { id: 'DEU' }] }, { id: 'PARTNER', values: [{ id: 'USA' }, { id: 'CHN' }] }, { id: 'PRODUCTCODE', values: [{ id: 'Total' }] }, { id: 'INDICATOR', values: [{ id: 'X' }] }] } },
      dataSets: [{ series: { '0:0:0:0:0': { observations: { '0': [800, 0] } }, '0:0:1:0:0': { observations: { '0': [20, 0] } }, '0:1:0:0:0': { observations: { '0': [100, 0] } } } }],
    };
    const usChn = parseSdmx(json);
    expect(usChn.get('MEX')!.get('USA')).toBe(800);
    const eu = new Map([['DEU', new Map([['FRA', 300], ['AUT', 200], ['CHE', 999]])]]);
    const world = new Map([['MEX', new Map([['WLD', 1000]])], ['DEU', new Map([['WLD', 1000]])], ['XXX', new Map([['WLD', 5]])]]);
    const rows = buildRows(2023, usChn, eu, world);
    expect(rows).toEqual([
      { iso: 'MEX', year: 2023, exportsUsd: 1_000_000, us: 0.8, china: 0.02, eu: 0 },
      { iso: 'DEU', year: 2023, exportsUsd: 1_000_000, us: 0.1, china: 0, eu: 0.5 },
    ]);
    expect(EU27).toHaveLength(27);
  });
});
