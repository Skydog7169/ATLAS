// Which country an aircraft is over. Loaded on demand by the aircraft panel
// so the country geometry stays out of the first-paint bundle.
import { geoBounds, geoContains } from 'd3-geo';
import { COUNTRY_FEATURES } from './geo';

const BOXES = COUNTRY_FEATURES.filter((f) => f.properties.iso).map((f) => ({ f, iso: f.properties.iso!, b: geoBounds(f) }));

function inBox([lon, lat]: [number, number], [[x0, y0], [x1, y1]]: [[number, number], [number, number]]): boolean {
  if (lat < y0 || lat > y1) return false;
  // A box crossing the antimeridian has x0 > x1.
  return x0 <= x1 ? lon >= x0 && lon <= x1 : lon >= x0 || lon <= x1;
}

/** ISO code of the country under a point, or null over the sea and unrecognised territory. */
export function countryAt(lonLat: [number, number]): string | null {
  for (const { f, iso, b } of BOXES) if (inBox(lonLat, b) && geoContains(f, lonLat)) return iso;
  return null;
}

/** Countries with the most aircraft overhead, most first. */
export function countriesOverhead(points: Array<[number, number]>, limit = 10): Array<{ iso: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of points) {
    const iso = countryAt(p);
    if (iso) counts.set(iso, (counts.get(iso) ?? 0) + 1);
  }
  return [...counts].map(([iso, count]) => ({ iso, count })).sort((a, b) => b.count - a.count || a.iso.localeCompare(b.iso)).slice(0, limit);
}
