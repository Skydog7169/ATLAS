import raw from '../data/countries.generated.json';
import type { CountryRecord } from '../data/types';

export const COUNTRIES = raw as CountryRecord[];

export const COUNTRY_BY_ISO: ReadonlyMap<string, CountryRecord> = new Map(COUNTRIES.map((c) => [c.cca3, c]));

const BY_NUMERIC = new Map<string, CountryRecord>();
for (const c of COUNTRIES) if (c.ccn3) BY_NUMERIC.set(c.ccn3, c);

/**
 * Natural Earth polygons that carry no ISO numeric id. Kosovo is widely
 * referenced by the user-assigned code "UNK"; the other two are unrecognised
 * and are rendered as neutral territory with a name-only tooltip.
 */
const UNNUMBERED_BY_NAME: Record<string, string | null> = {
  Kosovo: 'UNK',
  'N. Cyprus': null,
  Somaliland: null,
};

export function isoForFeature(id: string | number | undefined, name: string | undefined): string | null {
  if (id !== undefined && id !== null && String(id) !== 'undefined') {
    const hit = BY_NUMERIC.get(String(id).padStart(3, '0'));
    if (hit) return hit.cca3;
  }
  if (name && name in UNNUMBERED_BY_NAME) return UNNUMBERED_BY_NAME[name] ?? null;
  return null;
}

export function countryName(iso: string): string {
  return COUNTRY_BY_ISO.get(iso)?.name ?? iso;
}

/** Country centroid as [lon, lat] (world-countries stores [lat, lon]). */
export function countryLonLat(iso: string): [number, number] | null {
  const c = COUNTRY_BY_ISO.get(iso);
  if (!c) return null;
  const [lat, lon] = c.latlng;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return [lon, lat];
}
