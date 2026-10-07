import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import topo from '../data/geo/countries-110m.json';
import { COUNTRIES, isoForFeature } from './countries';

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

let detailed: Promise<CountryFeature[]> | null = null;

/**
 * 1:50m polygons (about 250 KB gzipped), fetched once on demand when the user
 * zooms in. Adds coastlines detail and real shapes for microstates.
 */
export function loadDetailedFeatures(): Promise<CountryFeature[]> {
  detailed ??= import('../data/geo/countries-50m.json').then((m) => toFeatures((m.default ?? m) as unknown as CountriesTopology));
  return detailed;
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
