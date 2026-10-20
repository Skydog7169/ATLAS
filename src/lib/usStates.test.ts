import { describe, expect, it } from 'vitest';
import { HOUSE_SEATS, STATES, buildLegislature, control, parseCongress, parseGovernors, parseLongDate, parseOpenStates, partyCode } from '../../scripts/build-us-states.mjs';
import { DEFAULT_STATE, parse, serialize } from './urlState';
import { search } from './search';
import {
  US,
  US_LAYERS,
  US_STATES,
  electionDay,
  houseCounts,
  legislatureControl,
  nextFederalElection,
  nextGovernorElection,
  onBallot,
  openGovernorSeat,
  senateDelegation,
  stateFill,
  stateSummary,
  trifecta,
  usLegend,
  type UsState,
} from './usStates';

const BEFORE = new Date('2026-10-20T12:00:00Z');
const AFTER = new Date('2026-11-04T12:00:00Z');

function fake(over: Partial<UsState> = {}): UsState {
  return {
    code: 'TX',
    fips: '48',
    name: 'Texas',
    governor: { name: 'Gov', party: 'R', partyName: 'Republican', since: '2015-01-20', termEnds: 2027 },
    senators: [
      { name: 'A', party: 'R', class: 1, since: '2013-01-03', nextElection: 2030 },
      { name: 'B', party: 'R', class: 2, since: '2002-11-30', nextElection: 2026 },
    ],
    houseSeats: 4,
    house: [
      { name: 'H1', party: 'D', district: 1 },
      { name: 'H2', party: 'R', district: 2 },
      { name: 'H3', party: 'R', district: 3 },
    ],
    legislature: {
      chambers: [
        { id: 'upper', name: 'Senate', D: 12, R: 19, O: 0, control: 'R' },
        { id: 'lower', name: 'House of Representatives', D: 62, R: 88, O: 0, control: 'R' },
      ],
    },
    ...over,
  };
}

describe('US election calendar', () => {
  it('puts election day on the Tuesday after the first Monday in November', () => {
    expect(electionDay(2026)).toBe('2026-11-03');
    expect(electionDay(2028)).toBe('2028-11-07');
    expect(electionDay(2030)).toBe('2030-11-05');
    expect(nextFederalElection(BEFORE)).toBe('2026-11-03');
    expect(nextFederalElection(AFTER)).toBe('2028-11-07');
  });

  it('knows each governorship cycle, including two-year terms and odd years', () => {
    expect(nextGovernorElection('TX', BEFORE)).toBe(2026);
    expect(nextGovernorElection('TX', AFTER)).toBe(2030);
    expect(nextGovernorElection('NH', AFTER)).toBe(2028);
    expect(nextGovernorElection('VT', BEFORE)).toBe(2026);
    expect(nextGovernorElection('KY', BEFORE)).toBe(2027);
    expect(nextGovernorElection('VA', BEFORE)).toBe(2029);
    expect(nextGovernorElection('NC', BEFORE)).toBe(2028);
    // 36 governorships are on the 2026 ballot.
    expect(US_STATES.filter((s) => s.code !== 'DC' && nextGovernorElection(s.code, BEFORE) === 2026)).toHaveLength(36);
  });
});

describe('US state politics', () => {
  it('computes trifectas, delegations and what is on the ballot', () => {
    const tx = fake();
    expect(trifecta(tx)).toBe('R');
    expect(trifecta(fake({ governor: { ...tx.governor!, party: 'D', partyName: 'Democratic' } }))).toBe('divided');
    expect(trifecta(fake({ legislature: { unicameral: true, chambers: [{ id: 'legislature', name: 'Legislature', D: 0, R: 0, O: 49, control: 'nonpartisan' }] } }))).toBe('nonpartisan');
    expect(legislatureControl(tx)).toBe('R');
    expect(legislatureControl(fake({ legislature: { chambers: [{ id: 'upper', name: 'Senate', D: 1, R: 0, O: 0, control: 'D' }, { id: 'lower', name: 'House', D: 0, R: 1, O: 0, control: 'R' }] } }))).toBe('split');
    expect(senateDelegation(tx)).toBe('R');
    expect(senateDelegation(fake({ senators: [{ name: 'S', party: 'I', caucus: 'D', class: 1, since: '2007-01-04', nextElection: 2030 }, { name: 'W', party: 'D', class: 3, since: '2023-01-03', nextElection: 2028 }] }))).toBe('D');
    expect(houseCounts(tx)).toEqual({ D: 1, R: 2, I: 0, vacant: 1 });
    const b = onBallot(tx, BEFORE);
    expect(b).toMatchObject({ year: 2026, governor: true, house: true });
    expect(b.senate.map((s) => s.name)).toEqual(['B']);
    expect(openGovernorSeat(fake({ governor: { ...tx.governor!, termNote: 'term limits' } }), BEFORE)).toBe(true);
    expect(openGovernorSeat(tx, BEFORE)).toBe(false);
  });

  it('colours and describes every state under every layer', () => {
    for (const layer of US_LAYERS) {
      expect(usLegend(layer).length).toBeGreaterThanOrEqual(3);
      for (const s of US_STATES) {
        expect(stateFill(s, layer, BEFORE), `${layer} ${s.code}`).toBeTruthy();
        expect(stateSummary(s, layer, BEFORE), `${layer} ${s.code}`).toBeTruthy();
      }
    }
    expect(stateSummary(fake(), 'ballot', BEFORE)).toMatch(/Nov 3, 2026: governor, Senate \(B's seat\), 4 House seats/);
  });

  it('ships every state with a governor, two senators and its House delegation', () => {
    expect(US_STATES).toHaveLength(51);
    expect(US.sources.map((s) => s.id)).toEqual(['governors', 'congress', 'legislatures']);
    let seats = 0;
    for (const s of US_STATES) {
      expect(s.governor?.name, s.code).toBeTruthy();
      if (s.code === 'DC') continue;
      seats += s.houseSeats;
      expect(s.senators, s.code).toHaveLength(2);
      expect(s.house.length, s.code).toBeLessThanOrEqual(s.houseSeats);
      expect(s.house.length, s.code).toBeGreaterThanOrEqual(s.houseSeats - 2);
      expect(s.legislature?.chambers.length, s.code).toBeGreaterThanOrEqual(1);
    }
    expect(seats).toBe(435);
    expect(US_STATES.find((s) => s.code === 'NE')!.legislature!.unicameral).toBe(true);
  });

  it('round-trips the US view, its layer and a state in the link', () => {
    const hash = serialize({ ...DEFAULT_STATE, view: 'us', usLayer: 'senate', selection: { kind: 'state', code: 'TX' } });
    expect(hash).toContain('view=us');
    expect(hash).toContain('us=senate');
    expect(hash).toContain('state=TX');
    const s = parse(hash, { bloc: () => false, conflict: () => false, country: () => false, state: (c) => c === 'TX' });
    expect(s).toMatchObject({ view: 'us', usLayer: 'senate', selection: { kind: 'state', code: 'TX' } });
    expect(parse('#view=us&us=bogus&state=ZZ', { bloc: () => false, conflict: () => false, country: () => false, state: () => false })).toMatchObject({ usLayer: 'governor', selection: null });
    expect(serialize({ ...DEFAULT_STATE, view: 'us' })).not.toContain('us=');
  });

  it('finds states by name and by governor; the country Georgia ranks above the state', () => {
    expect(search('texas')[0]).toMatchObject({ kind: 'state', id: 'TX' });
    const georgia = search('georgia');
    expect(georgia[0]).toMatchObject({ kind: 'country', id: 'GEO' });
    expect(georgia.some((h) => h.kind === 'state' && h.id === 'GA')).toBe(true);
    const gov = US_STATES.find((s) => s.code === 'CA')!.governor!.name;
    expect(search(gov).some((h) => h.kind === 'state' && h.id === 'CA')).toBe(true);
  });
});

describe('US states build', () => {
  it('lists 50 states and DC with 435 apportioned seats', () => {
    expect(STATES).toHaveLength(51);
    expect(Object.entries(HOUSE_SEATS).filter(([k]) => k !== 'DC').reduce((n, [, v]) => n + v, 0)).toBe(435);
  });

  it('normalises parties and dates', () => {
    expect(partyCode('Democratic-Farmer-Labor')).toBe('D');
    expect(partyCode('Democratic/Progressive')).toBe('D');
    expect(partyCode('Republican')).toBe('R');
    expect(partyCode('Nonpartisan')).toBe('O');
    expect(parseLongDate('April 10, 2017')).toBe('2017-04-10');
    expect(parseLongDate('soon')).toBeNull();
  });

  it('counts legislators by chamber from a CSV with quoted fields', () => {
    const csv = 'id,name,current_party,current_district,current_chamber\n1,"Smith, Ann",Democratic,1,upper\n2,Bob,Republican,2,upper\n3,Cy,Republican,3,lower\n4,"Di ""DJ"" Lee",Independent,4,lower\n';
    expect(parseOpenStates(csv)).toEqual({ upper: { D: 1, R: 1, O: 0 }, lower: { D: 0, R: 1, O: 1 } });
  });

  it('gives a chamber to the larger party unless a coalition is curated', () => {
    expect(control({ D: 75, R: 73, O: 5 })).toBe('D');
    expect(control({ D: 10, R: 10, O: 0 })).toBe('tied');
    expect(buildLegislature('AK', { upper: { D: 9, R: 11, O: 0 }, lower: { D: 14, R: 21, O: 5 } }).chambers.map((c) => c.control)).toEqual(['coalition', 'coalition']);
    expect(buildLegislature('NE', { legislature: { D: 0, R: 0, O: 49 } })).toMatchObject({ unicameral: true });
    expect(buildLegislature('NY', { upper: { D: 41, R: 22, O: 0 }, lower: { D: 103, R: 47, O: 0 } }).chambers[1]!.name).toBe('Assembly');
  });

  it('reads senators, special elections, caucuses and House districts from the roster', () => {
    const people = [
      { name: { official_full: 'Sen A' }, id: { wikipedia: 'Sen A' }, terms: [{ type: 'rep', start: '2015-01-03', end: '2019-01-03', state: 'OH' }, { type: 'sen', start: '2019-01-03', end: '2025-01-03', state: 'OH', class: 1, party: 'Democrat' }, { type: 'sen', start: '2025-01-03', end: '2031-01-03', state: 'OH', class: 1, party: 'Democrat' }] },
      { name: { first: 'Jon', last: 'B' }, id: {}, terms: [{ type: 'sen', start: '2025-01-21', end: '2026-11-03', state: 'OH', class: 3, party: 'Republican', how: 'appointment', 'end-type': 'special-election' }] },
      { name: { official_full: 'Ind C' }, id: {}, terms: [{ type: 'sen', start: '2025-01-03', end: '2031-01-03', state: 'VT', class: 1, party: 'Independent', caucus: 'Democrat' }] },
      { name: { official_full: 'Rep D' }, id: {}, terms: [{ type: 'rep', start: '2025-01-03', end: '2027-01-03', state: 'OH', district: 3, party: 'Republican' }] },
    ];
    const c = parseCongress(people);
    const oh = c.get('OH')!;
    expect(oh.senators).toEqual([
      expect.objectContaining({ name: 'Sen A', party: 'D', class: 1, since: '2019-01-03', nextElection: 2030, wiki: 'Sen_A' }),
      expect.objectContaining({ name: 'Jon B', party: 'R', class: 3, nextElection: 2026, special: true, appointed: true }),
    ]);
    expect(oh.house).toEqual([{ name: 'Rep D', party: 'R', district: 3 }]);
    expect(c.get('VT')!.senators[0]).toMatchObject({ party: 'I', caucus: 'D' });
  });

  it('parses the governors table', () => {
    const html = `<table class="wikitable sortable"><tbody>
<tr><th>State</th><th>Image</th><th>Governor</th><th colspan="2">Party</th><th>Born</th><th>Prior</th><th>Term start</th><th>Term end</th></tr>
<tr><td><a href="https://en.wikipedia.org/wiki/Alabama">Alabama</a> (<a href="./List">list</a>)</td><td></td><th scope="row"><a href="https://en.wikipedia.org/wiki/Kay_Ivey">Kay Ivey</a></th><td style="background-color:#E81B23;"></td><td>Republican</td><td>1944</td><td>Lt Gov</td><td>April 10, 2017</td><td>2027 (term limits)<sup>[1]</sup></td></tr>
</tbody></table>`;
    expect(parseGovernors(html).get('AL')).toEqual({ name: 'Kay Ivey', wiki: 'Kay_Ivey', party: 'R', partyName: 'Republican', since: '2017-04-10', termEnds: 2027, termNote: 'term limits' });
  });
});
