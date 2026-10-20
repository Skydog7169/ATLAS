import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import topo from '../data/geo/countries-110m.json';
import { COUNTRIES, isoForFeature } from './countries';
import detailUrl from '../data/geo/countries-50m.json?url';
import { reloadOnce } from './chunkReload';

export interface CountryFeatureProps {
  iso: string | null;
  name: string;
}

export type CountryFeature = Feature<Geometry, CountryFeatureProps>;

type CountriesTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

function toFeatures(t: CountriesTopology): CountryFeature[] {
  const collection = feature(t, t.objects.countries) as FeatureCollection<Geometry, { name: string }>;
  return collection.features.map((f) => ({
    ...f,
    properties: { iso: isoForFeature(f.id, f.properties?.name), name: f.properties?.name ?? 'Unknown' },
  }));
}

/** 1:110m polygons, bundled: small enough to ship on first load. */
export const COUNTRY_FEATURES: CountryFeature[] = toFeatures(topo as unknown as CountriesTopology);

// Fetched as a hashed static asset rather than imported as a JS chunk: fetch()
// failures are not cached like failed module imports, so a dropped request can
// be retried, and JSON.parse is cheaper than evaluating a module.
const RETRY_AFTER_MS = 30_000;
let detailed: Promise<CountryFeature[]> | null = null;
let failedAt = 0;

/**
 * 1:50m polygons (about 250 KB gzipped), fetched on demand when the user
 * zooms in. Adds coastline detail and real shapes for microstates. After a
 * failure the next call retries, at most once every 30 seconds.
 */
export function loadDetailedFeatures(fetcher: typeof fetch = fetch, now: () => number = Date.now): Promise<CountryFeature[]> {
  if (detailed) return detailed;
  if (failedAt && now() - failedAt < RETRY_AFTER_MS) return Promise.reject(new Error('1:50m geometry: waiting to retry'));
  detailed = fetcher(detailUrl)
    .then((r) => {
      // A 404 on a hashed asset means a newer deploy replaced this build.
      if (r.status === 404) reloadOnce();
      return r.ok ? (r.json() as Promise<unknown>) : Promise.reject(new Error(`1:50m geometry: HTTP ${r.status}`));
    })
    .then((t) => toFeatures(t as CountriesTopology))
    .catch((error: unknown) => {
      detailed = null;
      failedAt = now();
      throw error;
    });
  return detailed;
}

/** Test hook: forget any cached or failed load. */
export function resetDetailedFeatures() {
  detailed = null;
  failedAt = 0;
}

/** ISO codes that have a polygon in the given feature set. */
export function drawnIsos(features: CountryFeature[]): Set<string> {
  return new Set(features.map((f) => f.properties.iso).filter((x): x is string => Boolean(x)));
}

const DRAWN = new Set(COUNTRY_FEATURES.map((f) => f.properties.iso).filter((x): x is string => Boolean(x)));

export function hasPolygon(iso: string): boolean {
  return DRAWN.has(iso);
}

/**
 * Sovereign states too small to appear in the 1:110m polygons. They are drawn
 * as point markers so bloc membership (Malta in the EU, Singapore in ASEAN,
 * Bahrain in the GCC) is never silently missing.
 */
export const MICROSTATES = COUNTRIES.filter((c) => c.independent && !DRAWN.has(c.cca3)).map((c) => {
  const [lat, lon] = c.latlng;
  return { iso: c.cca3, name: c.name, lonLat: [lon, lat] as [number, number] };
});
