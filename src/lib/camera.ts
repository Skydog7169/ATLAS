import { geoArea } from 'd3-geo';
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson';

/**
 * What the map should frame. `isos` fits the union of several countries
 * (bloc members, a relationship pair) into the part of the stage that no
 * panel or sheet covers.
 */
export type Focus =
  | { kind: 'country'; iso: string }
  | { kind: 'isos'; isos: string[] }
  | { kind: 'point'; lonLat: [number, number]; scale?: number }
  | { kind: 'reset' }
  /** Back to the view before the last fly-to, unless the user has moved the map since. */
  | { kind: 'restore' }
  | null;

/** Screen pixels covered by chrome on each side of the map stage. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0 };

export interface ViewRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Bounds = [[number, number], [number, number]];

/**
 * The uncovered part of a width x height stage. A sliver is never returned:
 * at least 40% of the width and 35% of the height stay usable, so a huge
 * panel on a tiny embed still frames something.
 */
export function visibleRect(width: number, height: number, insets: Insets): ViewRect {
  const x1 = Math.max(width - insets.right, width * 0.4);
  const y1 = Math.max(height - insets.bottom, height * 0.35);
  const y0 = Math.min(Math.max(0, insets.top), y1 - height * 0.35);
  return { x0: 0, y0: Math.max(0, y0), x1, y1 };
}

export interface Fit {
  k: number;
  x: number;
  y: number;
  /** The zoom the bounds needed before clamping; below the minimum means they do not fit. */
  rawK: number;
}

/**
 * Zoom transform that puts `bounds` (in k=1 map pixels) in the centre of
 * `rect`, filling `fill` of its tighter dimension, with k clamped.
 */
export function fitBounds(bounds: Bounds, rect: ViewRect, fill: number, minK: number, maxK: number): Fit {
  const [[bx0, by0], [bx1, by1]] = bounds;
  const visW = rect.x1 - rect.x0;
  const visH = rect.y1 - rect.y0;
  const dx = Math.max(bx1 - bx0, 1e-6);
  const dy = Math.max(by1 - by0, 1e-6);
  const rawK = fill / Math.max(dx / visW, dy / visH);
  const k = Math.max(minK, Math.min(maxK, rawK));
  const cx = (bx0 + bx1) / 2;
  const cy = (by0 + by1) / 2;
  return { k, x: (rect.x0 + rect.x1) / 2 - k * cx, y: (rect.y0 + rect.y1) / 2 - k * cy, rawK };
}

export function unionBounds(list: Bounds[]): Bounds | null {
  const ok = list.filter((b) => b.every((p) => p.every(Number.isFinite)));
  if (!ok.length) return null;
  return [
    [Math.min(...ok.map((b) => b[0][0])), Math.min(...ok.map((b) => b[0][1]))],
    [Math.max(...ok.map((b) => b[1][0])), Math.max(...ok.map((b) => b[1][1]))],
  ];
}

/** True when a point (map pixels at k=1) lands inside rect under transform {k,x,y}. */
export function inView(p: [number, number], t: { k: number; x: number; y: number }, rect: ViewRect): boolean {
  const sx = t.x + t.k * p[0];
  const sy = t.y + t.k * p[1];
  return sx >= rect.x0 && sx <= rect.x1 && sy >= rect.y0 && sy <= rect.y1;
}

const largestCache = new WeakMap<object, Feature<Polygon, unknown>>();

/**
 * The biggest single polygon of a feature, so overseas territories (French
 * Guiana, Hawaii) and antimeridian slivers do not stretch a frame or drag a
 * label into the sea.
 */
export function largestPolygon<P>(f: Feature<Geometry, P>): Feature<Polygon, P> | null {
  const hit = largestCache.get(f);
  if (hit) return hit as Feature<Polygon, P>;
  const g = f.geometry;
  let out: Feature<Polygon, P> | null = null;
  if (g?.type === 'Polygon') out = f as Feature<Polygon, P>;
  else if (g?.type === 'MultiPolygon') {
    let best: Polygon['coordinates'] | null = null;
    let bestArea = -1;
    for (const coords of (g as MultiPolygon).coordinates) {
      const a = geoArea({ type: 'Polygon', coordinates: coords });
      if (a > bestArea) {
        bestArea = a;
        best = coords;
      }
    }
    if (best) out = { type: 'Feature', id: f.id, properties: f.properties, geometry: { type: 'Polygon', coordinates: best } };
  }
  if (out) largestCache.set(f, out as Feature<Polygon, unknown>);
  return out;
}
