import { describe, expect, it } from 'vitest';
import { captureUnrest, findDuplicate, placeOf, slugify } from '../../scripts/research/capture.mjs';
import { UnrestInputSchema } from '../data/schema';
import { UNREST } from '../data/unrest';
import { countryLonLat } from './countries';

const today = '2026-10-20';
const twoOutlets = [
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/news/2026/10/18/mock' },
  { name: 'AP', url: 'https://apnews.com/article/mock' },
];
const candidate = {
  name: 'Portugal rent-cap riots',
  kind: 'riots',
  since: '2026-10',
  countries: ['PRT'],
  location: [-9.14, 38.72],
  parties: ['Tenant unions and students', 'Government'],
  intensity: 'medium',
  confidence: 'medium',
  trigger: 'The repeal of a rent cap announced on 1 October 2026 set off protest camps in Lisbon that turned into nightly clashes.',
  summary: 'Protest camps in Lisbon and Porto over housing costs grew into nightly clashes with police within two weeks of the rent-cap repeal.',
  status: 'On 17 October 2026 thousands marched in Lisbon and clashes followed near parliament, with dozens of arrests reported. The government has not withdrawn the repeal.',
};

describe('unrest capture', () => {
  it('slugifies names into ids', () => {
    expect(slugify('Albania student riots against Rama government')).toBe('albania-student-riots-against-rama-government');
    expect(slugify('  Shkodër & Tirana: riots!! ')).toBe('shkoder-tirana-riots');
  });

  it('adds a candidate backed by two outlets and the result fits the episode schema', () => {
    const decision = captureUnrest(candidate, twoOutlets, UNREST, today, countryLonLat);
    expect(decision.add).toBe(true);
    if (!decision.add) return;
    expect(decision.episode.id).toBe('portugal-rent-cap-riots');
    expect(decision.episode.location).toEqual([-9.14, 38.72]);
    expect(decision.episode.history[0]!.date).toBe(today);
    expect(decision.episode.history[0]!.sources).toHaveLength(2);
    expect(() => UnrestInputSchema.parse(decision.episode)).not.toThrow();
  });

  it('only reports a candidate with one outlet, or whose second source is Wikipedia', () => {
    const one = captureUnrest(candidate, twoOutlets.slice(0, 1), UNREST, today, countryLonLat);
    expect(one).toMatchObject({ add: false, reason: expect.stringContaining('two independent') });
    const wiki = captureUnrest(candidate, [twoOutlets[0]!, { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/2026_Portuguese_protests' }], UNREST, today, countryLonLat);
    expect(wiki.add).toBe(false);
  });

  it('rejects unknown countries, future start months, low confidence and thin text', () => {
    expect(captureUnrest({ ...candidate, countries: ['XXX'] }, twoOutlets, UNREST, today, countryLonLat)).toMatchObject({ add: false, reason: 'unknown country code' });
    expect(captureUnrest({ ...candidate, since: '2027-01' }, twoOutlets, UNREST, today, countryLonLat).add).toBe(false);
    expect(captureUnrest({ ...candidate, since: 'October 2026' }, twoOutlets, UNREST, today, countryLonLat).add).toBe(false);
    expect(captureUnrest({ ...candidate, confidence: 'low' }, twoOutlets, UNREST, today, countryLonLat)).toMatchObject({ add: false, reason: 'low confidence' });
    expect(captureUnrest({ ...candidate, trigger: 'too short' }, twoOutlets, UNREST, today, countryLonLat)).toMatchObject({ add: false, reason: 'description too thin' });
  });

  it('treats a look-alike of an existing episode as a duplicate', () => {
    const kenya = { ...candidate, name: 'Kenya youth protests', countries: ['KEN'], kind: 'protests', since: '2026-09' };
    const decision = captureUnrest(kenya, twoOutlets, UNREST, today, countryLonLat);
    expect(decision).toMatchObject({ add: false, reason: expect.stringContaining('kenya-gen-z-protests') });
    const existing = [{ id: 'x-riots', name: 'Example riots', kind: 'riots', since: '2026-08', countries: ['PRT'] }];
    expect(findDuplicate({ name: 'Lisbon housing clashes', kind: 'riots', since: '2026-10', countries: ['PRT'] }, existing)?.id).toBe('x-riots');
    expect(findDuplicate({ name: 'Lisbon housing clashes', kind: 'riots', since: '2026-10', countries: ['ESP'] }, existing)).toBeNull();
    expect(findDuplicate({ name: 'Lisbon crackdown', kind: 'crackdown', since: '2026-10', countries: ['PRT'] }, existing)).toBeNull();
  });

  it('falls back to the country centroid when the proposed place is implausible', () => {
    const centroid = countryLonLat('PRT');
    expect(placeOf([38.72, -9.14], centroid)).toEqual(centroid); // swapped lon/lat lands in the Indian Ocean
    expect(placeOf([-9.14321, 38.72], centroid)).toEqual([-9.1432, 38.72]);
    expect(placeOf('nowhere', centroid)).toEqual(centroid);
    expect(placeOf([200, 0], null)).toBeNull();
  });

  it('trims status and trigger to the schema limits', () => {
    const long = { ...candidate, status: 'x'.repeat(900), trigger: `${'y'.repeat(400)}` };
    const decision = captureUnrest(long, twoOutlets, UNREST, today, countryLonLat);
    expect(decision.add).toBe(true);
    if (!decision.add) return;
    expect(decision.episode.history[0]!.status).toHaveLength(700);
    expect(decision.episode.trigger).toHaveLength(300);
    expect(() => UnrestInputSchema.parse(decision.episode)).not.toThrow();
  });
});
