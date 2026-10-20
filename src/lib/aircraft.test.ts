import { describe, expect, it, vi } from 'vitest';
import { feedCache, slim, toFeed } from '../../api/_lib/aircraft';
import { DEFAULT_AIRCRAFT_FILTER, ahead, aircraftLabel, applyFilter, countByRole, emergencyOf, formatAltitude, isNotable, positionAt, roleOf, typeName, type Aircraft } from './aircraft';
import { countryAt, countriesOverhead } from './aircraftGeo';
import { DEFAULT_STATE, parse, serialize } from './urlState';

const base = { hex: 'ae01d0', lat: 41, lon: -96, alt: 14250, age: 3 } satisfies Aircraft;

describe('aircraft feed relay', () => {
  it('keeps what the map needs and drops vehicles, obstacles and stale positions', () => {
    expect(slim({ hex: 'AE01D0', flight: 'TOPCT93 ', r: '62-4139', t: 'R135', lat: 40.7781234, lon: -96.632, alt_baro: 14250, gs: 180.4, track: 32.2, baro_rate: -1637, squawk: '4246', emergency: 'none', seen_pos: 2.6, mlat: ['lat', 'lon'], category: 'A5', rssi: -20 })).toEqual({
      hex: 'ae01d0', flight: 'TOPCT93', r: '62-4139', t: 'R135', lat: 40.7781, lon: -96.632, alt: 14250, gs: 180, track: 32, vr: -1637, squawk: '4246', age: 3, mlat: true, cat: 'A5',
    });
    expect(slim({ hex: 'abc', lat: 1, lon: 2, category: 'C3' })).toBeNull();
    expect(slim({ hex: 'abc', lat: 1, lon: 2, t: 'TWR' })).toBeNull();
    expect(slim({ hex: 'abc' })).toBeNull();
    expect(slim({ hex: 'abc', lastPosition: { lat: 1, lon: 2, seen_pos: 900 } })).toBeNull();
    expect(slim({ hex: 'abc', lastPosition: { lat: 1, lon: 2, seen_pos: 120 } })).toMatchObject({ lat: 1, lon: 2, age: 120 });
    expect(slim({ hex: 'abc', lat: 1, lon: 2, alt_baro: 'ground', emergency: 'general', t: 'ZZZZ' })).toEqual({ hex: 'abc', lat: 1, lon: 2, alt: null, ground: true, age: 0, emergency: 'general' });
  });

  it('names the source by host and counts what the upstream sent', () => {
    const feed = toFeed({ now: 1_792_461_200_001, ac: [{ hex: 'a', lat: 1, lon: 1 }, { hex: 'b' }] }, 'https://api.adsb.lol/v2/mil');
    expect(feed).toMatchObject({ now: 1_792_461_200_001, total: 2, source: { name: 'adsb.lol', license: 'ODbL 1.0' } });
    expect(feed.aircraft).toHaveLength(1);
  });

  it('caches for the TTL, falls back to the next feed, serves stale and backs off when every feed fails', async () => {
    const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    const calls: string[] = [];
    let failFirst = false;
    let failAll = false;
    const fetcher = vi.fn((url: string | URL | Request) => {
      calls.push(String(url));
      if (failAll || (failFirst && String(url).includes('one'))) return Promise.resolve(new Response('slow down', { status: 429 }));
      return ok({ now: 1000, ac: [{ hex: String(url).includes('one') ? 'a1' : 'b2', lat: 1, lon: 1 }] });
    }) as unknown as typeof fetch;
    const cache = feedCache(['https://one.example/mil', 'https://two.example/mil'], 60_000, fetcher);

    expect((await cache.get(0)).aircraft[0]!.hex).toBe('a1');
    await cache.get(30_000);
    expect(calls).toHaveLength(1);

    failFirst = true;
    expect((await cache.get(61_000)).aircraft[0]!.hex).toBe('b2');
    expect(calls.slice(1)).toEqual(['https://one.example/mil', 'https://two.example/mil']);

    failAll = true;
    const stale = await cache.get(130_000);
    expect(stale).toMatchObject({ stale: true, aircraft: [{ hex: 'b2' }] });
    const n = calls.length;
    await cache.get(140_000); // inside the back-off window: no new upstream calls
    expect(calls).toHaveLength(n);
    await expect(feedCache(['https://one.example/mil'], 1000, fetcher).get(0)).rejects.toThrow(/every aircraft feed failed/);
  });

  it('shares one upstream request between concurrent misses', async () => {
    let resolve: (r: Response) => void = () => {};
    const fetcher = vi.fn(() => new Promise<Response>((r) => (resolve = r))) as unknown as typeof fetch;
    const cache = feedCache(['https://one.example/mil'], 60_000, fetcher);
    const a = cache.get(0);
    const b = cache.get(1);
    resolve(new Response(JSON.stringify({ now: 5, ac: [] })));
    expect(await a).toBe(await b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('aircraft roles and labels', () => {
  it('classifies by type designator, then emitter category and description', () => {
    expect(roleOf({ ...base, t: 'R135' })).toBe('isr');
    expect(roleOf({ ...base, t: 'K35R' })).toBe('tanker');
    expect(roleOf({ ...base, t: 'B52' })).toBe('bomber');
    expect(roleOf({ ...base, t: 'C17' })).toBe('transport');
    expect(roleOf({ ...base, t: 'F35' })).toBe('fighter');
    expect(roleOf({ ...base, cat: 'A7' })).toBe('helicopter');
    expect(roleOf({ ...base, desc: 'SIKORSKY UH-60 Black Hawk' })).toBe('helicopter');
    expect(roleOf({ ...base, desc: 'NORTHROP GRUMMAN RQ-4 Global Hawk' })).toBe('other');
    expect(roleOf(base)).toBe('other');
    expect(typeName({ ...base, t: 'P8' })).toBe('P-8 Poseidon maritime patrol');
    expect(typeName({ ...base, t: 'XYZ1' })).toBe('XYZ1');
    expect(typeName({ ...base, t: 'P8', desc: 'BOEING P-8A' })).toBe('BOEING P-8A');
  });

  it('flags emergencies and notable roles', () => {
    expect(emergencyOf({ ...base, squawk: '7700' })).toMatch(/General emergency/);
    expect(emergencyOf({ ...base, emergency: 'nordo' })).toMatch(/nordo/);
    expect(emergencyOf({ ...base, squawk: '1200' })).toBeNull();
    expect(isNotable({ ...base, t: 'E3TF' })).toBe(true);
    expect(isNotable({ ...base, t: 'C17' })).toBe(false);
    expect(isNotable({ ...base, t: 'C17', squawk: '7600' })).toBe(true);
  });

  it('formats altitude as a flight level above 18,000 ft', () => {
    expect(formatAltitude({ ...base, alt: 35000 })).toBe('FL350');
    expect(formatAltitude({ ...base, alt: 14250 })).toBe('14,250 ft');
    expect(formatAltitude({ ...base, alt: null, ground: true })).toBe('on the ground');
    expect(aircraftLabel({ ...base, flight: 'TOPCT93', t: 'R135', gs: 180 })).toBe('TOPCT93 · RC-135 reconnaissance · 14,250 ft · 180 kt');
  });
});

describe('dead reckoning', () => {
  it('steps along the track at ground speed', () => {
    const [lon, lat] = ahead([0, 0], 0, 60, 3600);
    expect(lat).toBeCloseTo(1, 5);
    expect(lon).toBeCloseTo(0, 5);
    const [lon2, lat2] = ahead([0, 60], 90, 60, 3600);
    expect(lat2).toBeCloseTo(60, 5);
    expect(lon2).toBeCloseTo(2, 2); // a nautical mile spans twice the longitude at 60°
    expect(ahead([179.9, 0], 90, 600, 3600)[0]).toBeLessThan(-170);
  });

  it('extrapolates from the report time, caps at five minutes and leaves slow or grounded aircraft put', () => {
    const a = { ...base, lat: 0, lon: 0, age: 0, gs: 360, track: 0 };
    expect(positionAt(a, 0, 60_000)[1]).toBeCloseTo(0.1, 5);
    expect(positionAt(a, 0, 3_600_000)[1]).toBeCloseTo(0.5, 5);
    expect(positionAt({ ...a, gs: 10 }, 0, 60_000)).toEqual([0, 0]);
    expect(positionAt({ ...a, ground: true }, 0, 60_000)).toEqual([0, 0]);
  });

  it('filters by role, ground and notability, and counts what is left', () => {
    const list: Aircraft[] = [{ ...base, hex: '1', t: 'R135' }, { ...base, hex: '2', t: 'C17' }, { ...base, hex: '3', t: 'H60', ground: true, alt: null }];
    expect(applyFilter(list, DEFAULT_AIRCRAFT_FILTER).map((a) => a.hex)).toEqual(['1', '2']);
    expect(applyFilter(list, { ...DEFAULT_AIRCRAFT_FILTER, notableOnly: true }).map((a) => a.hex)).toEqual(['1']);
    expect(applyFilter(list, { hidden: new Set(['isr']), airborneOnly: false, notableOnly: false }).map((a) => a.hex)).toEqual(['2', '3']);
    expect(countByRole(list).find((c) => c.role === 'isr')!.count).toBe(1);
  });
});

describe('aircraft in the link and on the map', () => {
  it('round-trips the aircraft panel and the list', () => {
    const valid = { bloc: () => false, conflict: () => false, country: () => false };
    expect(serialize({ ...DEFAULT_STATE, layer: 'aircraft', selection: { kind: 'aircraft', hex: 'ae01d0' } })).toContain('aircraft=ae01d0');
    expect(parse('#layer=aircraft&aircraft=AE01D0', valid)).toMatchObject({ layer: 'aircraft', selection: { kind: 'aircraft', hex: 'ae01d0' } });
    expect(parse('#aircraft=all', valid).selection).toEqual({ kind: 'aircraft', hex: null });
    expect(parse('#aircraft=<script>', valid).selection).toBeNull();
  });

  it('finds the country under a point', () => {
    expect(countryAt([2.35, 48.85])).toBe('FRA');
    expect(countryAt([-96.6, 40.8])).toBe('USA');
    expect(countryAt([-30, 30])).toBeNull();
    expect(countriesOverhead([[2.35, 48.85], [4.8, 45.7], [-96.6, 40.8], [-30, 30]])).toEqual([{ iso: 'FRA', count: 2 }, { iso: 'USA', count: 1 }]);
  });
});
