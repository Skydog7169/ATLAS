import { describe, expect, it } from 'vitest';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { COUNTRY_FEATURES } from './geo';
import { CHAR_W, labelAnchors, placeLabels, type LabelAnchor } from './mapLabels';

const projection = geoNaturalEarth1().fitExtent([[8, 8], [1432, 792]], { type: 'Sphere' });
const path = geoPath(projection);
const anchors = labelAnchors(COUNTRY_FEATURES, path, projection);
const byIso = new Map(anchors.map((a) => [a.iso, a]));
const view = { x0: 0, y0: 0, x1: 1440, y1: 800 };

describe('labelAnchors', () => {
  it('puts FRANCE on France, not on Spain', () => {
    const fra = byIso.get('FRA')!;
    const [lon, lat] = projection.invert!([fra.x, fra.y])!;
    expect(lat).toBeGreaterThan(44);
    expect(lon).toBeGreaterThan(-2);
  });
  it('gates on the largest polygon, so scattered islands do not qualify as wide', () => {
    const fra = byIso.get('FRA')!;
    const [[x0], [x1]] = path.bounds(COUNTRY_FEATURES.find((f) => f.properties.iso === 'FRA')!);
    expect(fra.width).toBeLessThan((x1 - x0) / 3);
  });
});

describe('placeLabels', () => {
  const a = (iso: string, x: number, y: number, area = 100): LabelAnchor => ({ iso, name: iso, x, y, width: 200, area });

  it('drops the smaller of two overlapping labels', () => {
    const out = placeLabels([a('BIG', 100, 100, 500), a('SML', 105, 102, 10)], { t: { k: 1, x: 0, y: 0 }, view, obstacles: [], markers: [] });
    expect(out.map((l) => l.iso)).toEqual(['BIG']);
  });

  it('places priority countries first', () => {
    const out = placeLabels([a('BIG', 100, 100, 500), a('WAR', 105, 102, 10)], { t: { k: 1, x: 0, y: 0 }, view, obstacles: [], markers: [], priority: new Set(['WAR']) });
    expect(out.map((l) => l.iso)).toEqual(['WAR']);
  });

  it('nudges a label off a marker instead of overprinting it', () => {
    const out = placeLabels([a('SYR', 300, 300)], { t: { k: 1, x: 0, y: 0 }, view, obstacles: [], markers: [{ x: 300, y: 300, r: 8 }] });
    expect(out).toHaveLength(1);
    expect(out[0]!.x - (3 * CHAR_W) / 2).toBeGreaterThan(300 + 8);
  });

  it('keeps labels out of chrome and outside the uncovered rect', () => {
    const obstacles = [{ x0: 0, y0: 0, x1: 400, y1: 60 }];
    const out = placeLabels([a('TOP', 100, 30), a('PNL', 1300, 400), a('OK', 600, 400)], {
      t: { k: 1, x: 0, y: 0 },
      view: { x0: 0, y0: 0, x1: 1016, y1: 800 },
      obstacles,
      markers: [],
    });
    expect(out.map((l) => l.iso)).toEqual(['OK']);
  });

  it('hides countries too narrow for the zoom', () => {
    const narrow = { ...a('NAR', 100, 100), width: 20 };
    expect(placeLabels([narrow], { t: { k: 1, x: 0, y: 0 }, view, obstacles: [], markers: [] })).toHaveLength(0);
    expect(placeLabels([narrow], { t: { k: 4, x: 0, y: 0 }, view: { x0: 0, y0: 0, x1: 4000, y1: 4000 }, obstacles: [], markers: [] })).toHaveLength(1);
  });
});
