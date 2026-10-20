import { describe, expect, it } from 'vitest';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { fitBounds, inView, largestPolygon, unionBounds, visibleRect, type Bounds } from './camera';
import { blocFocus, backerOutlines, focusForSelection } from './focus';
import { footprintView } from './globeCamera';
import { COUNTRY_FEATURES } from './geo';
import { CONFLICT_BY_ID } from '../data/conflicts';

const W = 412;
const H = 822;

describe('visibleRect', () => {
  it('excludes the bottom sheet and the chip row', () => {
    expect(visibleRect(W, H, { top: 60, right: 0, bottom: 427 })).toEqual({ x0: 0, y0: 60, x1: W, y1: H - 427 });
  });
  it('excludes the side panel', () => {
    expect(visibleRect(1440, 800, { top: 0, right: 424, bottom: 0 }).x1).toBe(1016);
  });
  it('never collapses to a sliver', () => {
    const r = visibleRect(300, 250, { top: 200, right: 290, bottom: 240 });
    expect(r.x1).toBeGreaterThanOrEqual(120);
    expect(r.y1 - r.y0).toBeGreaterThanOrEqual(250 * 0.35 - 1e-9);
  });
});

describe('fitBounds', () => {
  const rect = { x0: 0, y0: 60, x1: W, y1: 395 };
  it('centres the target in the uncovered rect, not the stage', () => {
    const b: Bounds = [
      [100, 300],
      [140, 340],
    ];
    const f = fitBounds(b, rect, 0.65, 1, 16);
    expect(f.x + f.k * 120).toBeCloseTo(W / 2);
    expect(f.y + f.k * 320).toBeCloseTo((60 + 395) / 2);
  });
  it('clamps k and reports the unclamped value', () => {
    const tiny: Bounds = [
      [10, 10],
      [11, 11],
    ];
    expect(fitBounds(tiny, rect, 0.85, 1, 6).k).toBe(6);
    const huge: Bounds = [
      [0, 0],
      [2000, 900],
    ];
    const f = fitBounds(huge, rect, 0.85, 1, 6);
    expect(f.k).toBe(1);
    expect(f.rawK).toBeLessThan(1);
  });
  it('inView agrees with the fit', () => {
    const b: Bounds = [
      [100, 300],
      [140, 340],
    ];
    const f = fitBounds(b, rect, 0.65, 1, 16);
    expect(inView([120, 320], f, rect)).toBe(true);
    expect(inView([120, 320], { k: 1, x: 0, y: 0 }, rect)).toBe(true);
    expect(inView([120, 500], { k: 1, x: 0, y: 0 }, rect)).toBe(false);
  });
});

describe('unionBounds', () => {
  it('spans all inputs and skips non-finite ones', () => {
    expect(
      unionBounds([
        [
          [0, 5],
          [10, 20],
        ],
        [
          [-4, 8],
          [3, 30],
        ],
        [
          [NaN, 0],
          [1, 1],
        ],
      ]),
    ).toEqual([
      [-4, 5],
      [10, 30],
    ]);
    expect(unionBounds([])).toBeNull();
  });
});

describe('largestPolygon', () => {
  const path = geoPath(geoNaturalEarth1().fitExtent([[0, 0], [1000, 500]], { type: 'Sphere' }));
  it('drops overseas territories from France', () => {
    const fra = COUNTRY_FEATURES.find((f) => f.properties.iso === 'FRA')!;
    const main = largestPolygon(fra)!;
    const [[x0], [x1]] = path.bounds(main);
    const [[fx0], [fx1]] = path.bounds(fra);
    expect(x1 - x0).toBeLessThan((fx1 - fx0) / 3);
    // Metropolitan France sits in Europe, east of Greenwich.
    const lon = geoNaturalEarth1().fitExtent([[0, 0], [1000, 500]], { type: 'Sphere' }).invert!(path.centroid(main))![0];
    expect(lon).toBeGreaterThan(-5);
    expect(lon).toBeLessThan(8);
  });
});

describe('focusForSelection', () => {
  it('frames bloc members, pairs and conflicts', () => {
    const asean = blocFocus('asean');
    expect(asean?.kind).toBe('isos');
    expect(asean && asean.kind === 'isos' ? asean.isos : []).toContain('IDN');
    expect(focusForSelection({ kind: 'pair', a: 'USA', b: 'CHN' })).toEqual({ kind: 'isos', isos: ['USA', 'CHN'] });
    expect(focusForSelection({ kind: 'pair', a: 'USA', b: null })).toEqual({ kind: 'country', iso: 'USA' });
    expect(focusForSelection({ kind: 'conflict', id: 'sudan' })).toMatchObject({ kind: 'point', scale: 3.5 });
    expect(focusForSelection({ kind: 'about' })).toBeNull();
    expect(focusForSelection(null)).toBeNull();
  });
  it('frames both blocs while comparing', () => {
    const f = focusForSelection({ kind: 'compare' }, { bloc: 'nato', vs: 'eu' });
    expect(f?.kind).toBe('isos');
    const isos = f && f.kind === 'isos' ? f.isos : [];
    expect(isos).toContain('USA');
    expect(isos).toContain('AUT'); // EU, not NATO
    expect(new Set(isos).size).toBe(isos.length);
  });
});

describe('backerOutlines', () => {
  it('outlines foreign backers, not the parties themselves', () => {
    for (const [id, c] of CONFLICT_BY_ID) {
      for (const iso of backerOutlines(id).keys()) expect(c.countries).not.toContain(iso);
    }
    expect(backerOutlines('no-such-conflict').size).toBe(0);
  });
});

describe('footprintView', () => {
  it('rotates to a regional bloc and zooms in', () => {
    const v = footprintView(['IDN', 'THA', 'VNM', 'PHL', 'MYS'])!;
    expect(v.centre[0]).toBeGreaterThan(95);
    expect(v.centre[0]).toBeLessThan(130);
    expect(v.k).toBeGreaterThan(1.5);
  });
  it('stays zoomed out for a bloc spanning the hemisphere', () => {
    expect(footprintView(['USA', 'JPN', 'AUS', 'IND'])!.k).toBeLessThan(1.5);
  });
});
