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

const topology = topo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;

const collection = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>;

export const COUNTRY_FEATURES: CountryFeature[] = collection.features.map((f) => ({
  ...f,
  properties: { iso: isoForFeature(f.id, f.properties?.name), name: f.properties?.name ?? 'Unknown' },
}));

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
