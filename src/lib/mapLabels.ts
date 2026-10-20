import { geoArea, geoBounds, geoCentroid, type GeoPath, type GeoProjection } from 'd3-geo';
import { largestPolygon, type ViewRect } from './camera';
import { COUNTRY_BY_ISO } from './countries';
import type { CountryFeature } from './geo';

export interface LabelAnchor {
  iso: string;
  name: string;
  /** Anchor in k=1 map pixels. */
  x: number;
  y: number;
  /** Projected width of the largest polygon at k=1; gates whether a name fits. */
  width: number;
  /** Projected area of the largest polygon, for ordering. */
  area: number;
}

/**
 * Hand-placed anchors [lon, lat] where the largest polygon's centroid still
 * reads badly (concave or very long shapes, or island states).
 */
export const LABEL_OVERRIDES: Record<string, [number, number]> = {
  FRA: [2.4, 46.6],
  NOR: [9.5, 61.6],
  USA: [-98.5, 39.5],
  RUS: [95, 62],
  NLD: [5.7, 52.3],
  KIR: [173, 1.4],
  CAN: [-103, 56],
  CHL: [-71, -33],
  VNM: [108.2, 14.2],
  HRV: [15.8, 45.4],
};

/** Anchors computed once per feature set and projection. */
export function labelAnchors(features: CountryFeature[], path: GeoPath, projection: GeoProjection): LabelAnchor[] {
  const out: LabelAnchor[] = [];
  for (const f of features) {
    const iso = f.properties.iso;
    if (!iso) continue;
    const main = largestPolygon(f) ?? f;
    const [[x0], [x1]] = path.bounds(main);
    const override = LABEL_OVERRIDES[iso];
    const p = override ? projection(override) : path.centroid(main);
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    out.push({ iso, name: (COUNTRY_BY_ISO.get(iso)?.name ?? f.properties.name).toUpperCase(), x: p[0], y: p[1], width: x1 - x0, area: path.area(main) });
  }
  return out;
}

export interface GeoAnchor {
  iso: string;
  name: string;
  lonLat: [number, number];
  /** East-west extent of the largest polygon, in radians of arc. */
  span: number;
  /** Steradians, for ordering. */
  area: number;
}

/** Projection-independent anchors for the globe, which re-projects every frame. */
export function geoAnchors(features: CountryFeature[]): GeoAnchor[] {
  const out: GeoAnchor[] = [];
  for (const f of features) {
    const iso = f.properties.iso;
    if (!iso) continue;
    const main = largestPolygon(f) ?? f;
    const lonLat = LABEL_OVERRIDES[iso] ?? (geoCentroid(main) as [number, number]);
    const [[lon0, lat0], [lon1, lat1]] = geoBounds(main);
    const dLon = (((lon1 - lon0) % 360) + 360) % 360;
    const span = ((dLon * Math.PI) / 180) * Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
    out.push({ iso, name: (COUNTRY_BY_ISO.get(iso)?.name ?? f.properties.name).toUpperCase(), lonLat, span, area: geoArea(main) });
  }
  return out;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PlacedLabel {
  iso: string;
  name: string;
  x: number;
  y: number;
}

export interface PlaceOptions {
  /** Zoom transform applied to the k=1 anchors. */
  t: { k: number; x: number; y: number };
  /** Labels must sit inside this rect (the uncovered part of the stage). */
  view: ViewRect;
  /** Screen boxes to keep clear: chrome, panel, legend. */
  obstacles: Box[];
  /** Markers in screen space; a label that hits one is nudged to its right. */
  markers: Array<{ x: number; y: number; r: number }>;
  /** Placed first (e.g. the countries a conflict is fought in). */
  priority?: ReadonlySet<string>;
  /** Minimum projected width of the largest polygon, in screen px. */
  minWidth?: number;
}

/** Monospace label metrics (global.css .country-label: 10px, 0.14em tracking). */
export const CHAR_W = 7.4;
export const LABEL_H = 12;

function hits(a: Box, b: Box) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/** Greedy screen-space collision pass: biggest (or prioritised) countries win. */
export function placeLabels(anchors: LabelAnchor[], opts: PlaceOptions): PlacedLabel[] {
  const { t, view, priority } = opts;
  const minWidth = opts.minWidth ?? 70;
  const markerBoxes = opts.markers.map((m) => ({ m, box: { x0: m.x - m.r - 6, y0: m.y - m.r - 6, x1: m.x + m.r + 6, y1: m.y + m.r + 6 } }));
  const taken: Box[] = [...opts.obstacles];
  const candidates = anchors
    .filter((a) => a.width * t.k >= minWidth)
    .sort((a, b) => {
      const pa = priority?.has(a.iso) ? 1 : 0;
      const pb = priority?.has(b.iso) ? 1 : 0;
      return pb - pa || b.area - a.area;
    });
  const out: PlacedLabel[] = [];
  const fits = (x: number, y: number, w: number) => {
    const box = { x0: x - w / 2, y0: y - LABEL_H / 2, x1: x + w / 2, y1: y + LABEL_H / 2 };
    if (box.x0 < view.x0 + 2 || box.x1 > view.x1 - 2 || box.y0 < view.y0 || box.y1 > view.y1) return null;
    if (taken.some((o) => hits(box, o))) return null;
    const marker = markerBoxes.find((mb) => hits(box, mb.box));
    return marker ? { marker: marker.m, box } : { marker: null, box };
  };
  for (const a of candidates) {
    const w = a.name.length * CHAR_W;
    let x = t.x + t.k * a.x;
    let y = t.y + t.k * a.y;
    let r = fits(x, y, w);
    if (r?.marker) {
      // Try the right-hand side of the marker before giving up.
      x = r.marker.x + r.marker.r + 8 + w / 2;
      y = r.marker.y;
      r = fits(x, y, w);
      if (r?.marker) r = null;
    }
    if (!r) continue;
    taken.push(r.box);
    out.push({ iso: a.iso, name: a.name, x, y });
  }
  return out;
}
