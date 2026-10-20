import { geoCentroid, geoDistance } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { largestPolygon } from './camera';
import { COUNTRY_FEATURES, MICROSTATES } from './geo';

const MIN_K = 1;
const MAX_FIT_K = 4;

/** Globe centre and zoom that bring a set of countries into view together. */
export function footprintView(isos: string[]): { centre: [number, number]; k: number } | null {
  const parts: Array<Feature<Geometry>> = [];
  for (const iso of isos) {
    const f = COUNTRY_FEATURES.find((x) => x.properties.iso === iso);
    const micro = MICROSTATES.find((m) => m.iso === iso);
    if (f) parts.push(largestPolygon(f) ?? f);
    else if (micro) parts.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: micro.lonLat } });
  }
  if (!parts.length) return null;
  const fc: FeatureCollection = { type: 'FeatureCollection', features: parts };
  const centre = geoCentroid(fc) as [number, number];
  if (!centre.every(Number.isFinite)) return null;
  // Angular radius of the footprint: the farthest member centroid from the centre, plus a margin.
  const reach = Math.max(...parts.map((p) => geoDistance(centre, geoCentroid(p) as [number, number]))) + 0.12;
  const k = reach >= Math.PI / 2 ? 1 : Math.max(MIN_K, Math.min(MAX_FIT_K, 0.85 / Math.sin(reach)));
  return { centre, k };
}
