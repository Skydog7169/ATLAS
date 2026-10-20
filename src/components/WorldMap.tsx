import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useHoverIso, useThemeKey } from '../hooks/useMapOverlays';
import { useSize } from '../hooks/useSize';
import { triPath } from '../lib/shapes';
import { geoGraticule10, geoNaturalEarth1, geoPath, type GeoPath } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, zoomTransform, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import 'd3-transition';
import { COUNTRY_FEATURES, MICROSTATES, drawnIsos, loadDetailedFeatures, prefetchDetailedFeatures, type CountryFeature } from '../lib/geo';
import { COUNTRY_BY_ISO } from '../lib/countries';
import { fitBounds, inView, largestPolygon, unionBounds, visibleRect, type Bounds, type Focus, type Insets } from '../lib/camera';
import { labelAnchors, placeLabels, type Box } from '../lib/mapLabels';

export type { Focus } from '../lib/camera';
import { NO_DATA_PATTERN, isDarkFill } from '../lib/palette';

export interface MapMarker {
  id: string;
  lonLat: [number, number];
  color: string;
  radius: number;
  label: string;
  pulse?: boolean;
  /** Diamonds mark chokepoints so they read apart from round conflict markers. */
  shape?: 'circle' | 'diamond' | 'triangle';
  /** Diamond fill style, so status does not rest on colour alone. */
  glyph?: DiamondGlyph;
}

export type DiamondGlyph = 'outline' | 'half' | 'solid' | 'cross';

/** A chokepoint diamond: outline (open), half-filled (restricted), solid (closed, with an ×). */
export function DiamondCore({ r, color, glyph = 'solid' }: { r: number; color: string; glyph?: DiamondGlyph }) {
  const d = r * Math.SQRT2;
  return (
    <>
      <rect className={'core glyph-' + glyph} x={-r} y={-r} width={2 * r} height={2 * r} transform="rotate(45)" fill={glyph === 'outline' ? 'var(--bg)' : color} style={glyph === 'outline' ? { stroke: color } : undefined} filter="url(#marker-glow)" />
      {glyph === 'half' && <path className="glyph-mask" d={`M${-d} 0L0 ${-d}L${d} 0Z`} fill="var(--bg)" />}
      {glyph === 'cross' && <path className="glyph-x" d={`M${-r * 0.55} ${-r * 0.55}L${r * 0.55} ${r * 0.55}M${r * 0.55} ${-r * 0.55}L${-r * 0.55} ${r * 0.55}`} />}
    </>
  );
}

export interface CountryFill {
  fill: string;
  /** When set, the polygon is drawn with a hatched pattern in this colour (suspended / frozen members). */
  hatch?: string;
  /** When set, alternating diagonal stripes of two colours (a country in both compared blocs). */
  stripes?: [string, string];
  dim?: boolean;
  /** When set, a dashed outline in this colour over the fill (a party fighting abroad, or a conflict's foreign backer). */
  outline?: string;
}

interface Props {
  /** Fill rule for a polygon or microstate dot. `null` is unrecognised territory. */
  fillFor: (iso: string | null) => CountryFill;
  markers: MapMarker[];
  showMicrostates: boolean;
  /** Countries drawn with the selection stroke (one country, or both sides of a pair). */
  selectedIsos: string[];
  /** Markers drawn with the selection reticle. */
  selectedMarkerIds: string[];
  focus: Focus;
  /** Screen pixels covered by the chip row (top), side panel (right) and bottom sheet; fly-to frames targets in the rest. */
  insetTop?: number;
  insetRight?: number;
  insetBottom?: number;
  /** Floating chrome (legend, controls) in stage pixels; country labels keep clear of it. */
  obstacles?: Box[];
  /** Countries whose labels are placed first (the theatre of the selected conflict). */
  labelPriority?: string[];
  onCountryClick: (iso: string) => void;
  onMarkerClick: (id: string) => void;
  onHover: (hover: { label: string; sub?: string; iso?: string | null } | null, x: number, y: number) => void;
  zoomApiRef?: RefObject<{ zoomIn: () => void; zoomOut: () => void; reset: () => void } | null>;
}

const PAD = 8;
const MIN_SCALE = 1;
/** Bloc and pair frames stop here so a two-member bloc doesn't dive to street level. */
const ISOS_MAX_SCALE = 6;
/** Lowest zoom the 'Fit' chip may use to squeeze a trans-Pacific bloc into view. */
const FIT_MIN_SCALE = 0.3;
/** A bottom sheet resize smaller than this keeps the camera where it is. */
const REFLY_THRESHOLD = 24;
const MAX_SCALE = 16;
/** Zoom factor at which the 1:50m geometry loads and country labels appear. */
const DETAIL_SCALE = 2.5;
const KEY_PAN = 80;

function labelTone(fill: string, themeKey: string): string {
  const dark = isDarkFill(fill, themeKey);
  return dark === null ? '' : dark ? ' on-dark' : ' on-light';
}

function hatchId(color: string) {
  return 'hatch-' + color.replace(/[^a-z0-9]/gi, '');
}

function stripesId(a: string, b: string) {
  return 'stripes-' + (a + b).replace(/[^a-z0-9]/gi, '');
}

type Extent = [[number, number], [number, number]];

/**
 * d3-zoom's default constraint, except below k=1: the 'Fit' chip zooms out to
 * squeeze a spread-out bloc into the uncovered area, and the default would
 * re-centre that small world on the whole stage, under the panel.
 */
function constrain(t: ZoomTransform, extent: Extent, translateExtent: Extent): ZoomTransform {
  if (t.k < 1) return t;
  const dx0 = t.invertX(extent[0][0]) - translateExtent[0][0];
  const dx1 = t.invertX(extent[1][0]) - translateExtent[1][0];
  const dy0 = t.invertY(extent[0][1]) - translateExtent[0][1];
  const dy1 = t.invertY(extent[1][1]) - translateExtent[1][1];
  return t.translate(dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1), dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1));
}

/** Pan bounds: the sphere, widened by whatever chrome covers the stage edges and by the portrait top-align shift. */
function setExtent(z: ZoomBehavior<SVGSVGElement, unknown>, sphere: Extent | null, width: number, height: number, insets: Insets, initial: ZoomTransform) {
  const [[bx0, by0], [bx1, by1]] = sphere ?? [
    [0, 0],
    [width, height],
  ];
  const lift = Math.max(0, -initial.y);
  z.translateExtent([
    [Math.min(0, bx0 - PAD), Math.min(0, by0 - PAD - insets.top)],
    [Math.max(width, bx1 + PAD + insets.right), Math.max(height, by1 + PAD + insets.bottom) + lift],
  ]);
}

export interface LayerProps {
  features: CountryFeature[];
  paths: string[];
  fillFor: Props['fillFor'];
  selectedIsos: string[];
  onCountryClick: Props['onCountryClick'];
  onHover: Props['onHover'];
}

/** Memoised so pan/zoom (which only mutates the parent <g> transform) never re-renders 177 paths. */
export const CountryLayer = memo(function CountryLayer({ features, paths, fillFor, selectedIsos, onCountryClick, onHover }: LayerProps) {
  const hatches = new Set<string>();
  const stripes = new Map<string, [string, string]>();
  const rendered = features.map((f, i) => {
    const iso = f.properties.iso;
    const style = fillFor(iso);
    if (style.hatch) hatches.add(style.hatch);
    if (style.stripes) stripes.set(stripesId(...style.stripes), style.stripes);
    const fill = style.stripes ? `url(#${stripesId(...style.stripes)})` : style.hatch ? `url(#${hatchId(style.hatch)})` : style.fill;
    const country = iso ? COUNTRY_BY_ISO.get(iso) : undefined;
    return (
      <path
        key={iso ?? f.properties.name}
        className="country"
        d={paths[i]}
        fill={fill}
        opacity={style.dim ? 0.55 : 1}
        style={style.outline ? { ['--outline' as string]: style.outline } : undefined}
        data-outline={style.outline ? true : undefined}
        data-iso={iso ?? undefined}
        data-selected={iso !== null && selectedIsos.includes(iso)}
        data-neutral={iso === null}
        onClick={iso ? () => onCountryClick(iso) : undefined}
        onPointerEnter={(e) => onHover({ label: country?.name ?? f.properties.name, sub: iso ? undefined : 'Unrecognised territory', iso }, e.clientX, e.clientY)}
        onPointerLeave={() => onHover(null, 0, 0)}
      />
    );
  });
  return (
    <>
      <defs>
        {/* Sparse cross-hatch over land: a country the layer's source has no row for. */}
        <pattern id={NO_DATA_PATTERN} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--land)" />
          <path d="M0 0V6M0 0H6" stroke="var(--fg-faint)" strokeWidth="0.7" opacity="0.7" />
        </pattern>
        {[...hatches].map((color) => (
          <pattern key={color} id={hatchId(color)} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--land)" />
            <rect width="6" height="6" fill={color} opacity="0.35" />
            <rect width="3" height="6" fill={color} />
          </pattern>
        ))}
        {[...stripes].map(([id, [a, b]]) => (
          <pattern key={id} id={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill={a} />
            <rect width="4" height="8" fill={b} />
          </pattern>
        ))}
      </defs>
      {rendered}
    </>
  );
});

/**
 * Hover and selection outlines, drawn above every country so neighbours cannot
 * paint over them and the fill (the key to the legend) never changes. The
 * strokes do not scale with zoom.
 */
export function CountryOutlines({ features, paths, selectedIsos, hoverIso }: { features: CountryFeature[]; paths: string[]; selectedIsos: string[]; hoverIso: string | null }) {
  const index = (iso: string | null) => (iso ? features.findIndex((f) => f.properties.iso === iso) : -1);
  const sel = selectedIsos.map(index).filter((i) => i >= 0 && paths[i]);
  const hov = hoverIso && !selectedIsos.includes(hoverIso) ? index(hoverIso) : -1;
  return (
    <g aria-hidden="true">
      {hov >= 0 && paths[hov] && <path className="hover-outline" d={paths[hov]} />}
      {sel.map((i) => (
        <g key={i}>
          <path className="selection-halo" d={paths[i]} />
          <path className="selection-line" d={paths[i]} />
        </g>
      ))}
    </g>
  );
}

export default function WorldMap({
  fillFor,
  markers,
  showMicrostates,
  selectedIsos,
  selectedMarkerIds,
  focus,
  insetTop = 0,
  insetRight = 0,
  insetBottom = 0,
  obstacles,
  labelPriority,
  onCountryClick,
  onMarkerClick,
  onHover,
  zoomApiRef,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const preFlyRef = useRef<ZoomTransform | null>(null);
  const { width, height } = useSize(rootRef);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoverIso, onCountryHover] = useHoverIso(onHover);
  const onHoverRef = useRef(onCountryHover);
  onHoverRef.current = onCountryHover;
  const [detail, setDetail] = useState<CountryFeature[] | null>(null);
  const [flying, setFlying] = useState(false);
  const flyingRef = useRef(false);
  const features = detail ?? COUNTRY_FEATURES;
  // The fly-to reads geometry through a ref: the 1:50m swap must never re-target the camera.
  const featuresRef = useRef(features);
  featuresRef.current = features;
  const insets: Insets = { top: insetTop, right: insetRight, bottom: insetBottom };
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const drawn = useMemo(() => drawnIsos(features), [features]);

  // Parse the 1:50m geometry while the browser is idle, so the first zoom past
  // DETAIL_SCALE never pays for it mid-flight.
  useEffect(() => prefetchDetailedFeatures(), []);

  // Swap in the detailed geometry once zoomed in, but never during a fly-to:
  // committing ~1.5M characters of path data stalls the main thread.
  useEffect(() => {
    if (transform.k < DETAIL_SCALE || detail || flying) return;
    let live = true;
    loadDetailedFeatures()
      .then((f) => {
        if (live && !flyingRef.current) setDetail(f);
      })
      .catch(() => {
        // A failed chunk is retried on the next zoom.
      });
    return () => {
      live = false;
    };
  }, [transform.k, detail, flying]);

  // Portrait screens (phones) would otherwise show a thin strip of map with
  // empty space above and below, so the globe is fitted to a wider virtual
  // canvas and the viewport starts centred on Europe and Africa with the land
  // top-aligned under the chips. Panning is bounded to the globe, not the
  // viewport, so nothing becomes unreachable. Tablets get a narrower canvas
  // so most of the world's width fits.
  const portrait = height > width * 1.15;
  const fitWidth = portrait ? Math.max(width, height * (height / width < 1.6 ? 0.9 : 1.25)) : width;

  const projection = useMemo(() => {
    if (!width || !height) return null;
    return geoNaturalEarth1().fitExtent(
      [
        [PAD, PAD],
        [fitWidth - PAD, height - PAD],
      ],
      { type: 'Sphere' },
    );
  }, [fitWidth, width, height]);

  // Two decimals: invisible even at MAX_SCALE, and ~12% less path text for the 1:50m build.
  const path: GeoPath | null = useMemo(() => (projection ? geoPath(projection).digits(2) : null), [projection]);

  const paths = useMemo(() => (path ? features.map((f) => path(f) ?? '') : []), [path, features]);

  const anchors = useMemo(() => (path && projection ? labelAnchors(features, path, projection) : []), [path, projection, features]);

  const sphereBounds = useMemo(() => (path ? path.bounds({ type: 'Sphere' }) : null), [path]);

  const initialTransform = useMemo(() => {
    if (!projection || !portrait) return zoomIdentity;
    const anchor = projection([18, 12]);
    const top = projection([0, 84]);
    if (!anchor || !top) return zoomIdentity;
    // Land starts just under the chip row; Antarctica is what gets clipped.
    return zoomIdentity.translate(width / 2 - anchor[0], Math.min(0, insetTop + 8 - top[1]));
  }, [projection, portrait, width, insetTop]);
  const initialRef = useRef(initialTransform);
  initialRef.current = initialTransform;
  const spherePath = useMemo(() => (path ? (path({ type: 'Sphere' }) ?? '') : ''), [path]);
  const graticulePath = useMemo(() => (path ? (path(geoGraticule10()) ?? '') : ''), [path]);

  // Attach d3-zoom once per size. The transform is written straight to the
  // DOM for the heavy country layer; React state only drives the light
  // marker layer so markers can stay a constant screen size.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !width || !height) return;
    const behaviour = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .constrain(constrain)
      .on('zoom', (event) => {
        const t = event.transform as ZoomTransform;
        // A drag or wheel is the user's own framing: nothing to restore any more.
        if (event.sourceEvent) preFlyRef.current = null;
        layerRef.current?.setAttribute('transform', t.toString());
        setTransform(t);
        // Whatever was under the pointer has moved; drop the tooltip until the next enter.
        onHoverRef.current(null, 0, 0);
      });
    const sel = select(svg);
    sel.call(behaviour).on('dblclick.zoom', null);
    zoomRef.current = behaviour;
    setExtent(behaviour, sphereBounds, width, height, insetsRef.current, initialRef.current);
    behaviour.transform(sel, initialRef.current);
    return () => {
      sel.on('.zoom', null);
      zoomRef.current = null;
    };
  }, [width, height, sphereBounds]);

  // Panning may push the edges of the world out from under the panel, the
  // sheet and the chip row.
  useEffect(() => {
    if (zoomRef.current) setExtent(zoomRef.current, sphereBounds, width, height, insets, initialTransform);
  }, [sphereBounds, width, height, insetTop, insetRight, insetBottom, initialTransform]);

  // Expose simple controls to the parent.
  useEffect(() => {
    if (!zoomApiRef) return;
    const run = (fn: (sel: ReturnType<typeof select<SVGSVGElement, unknown>>) => void) => {
      const svg = svgRef.current;
      if (!svg || !zoomRef.current) return;
      preFlyRef.current = null;
      fn(select(svg).transition().duration(250) as unknown as ReturnType<typeof select<SVGSVGElement, unknown>>);
    };
    zoomApiRef.current = {
      zoomIn: () => run((s) => zoomRef.current!.scaleBy(s, 1.6)),
      zoomOut: () => run((s) => zoomRef.current!.scaleBy(s, 1 / 1.6)),
      reset: () => run((s) => zoomRef.current!.transform(s, initialRef.current)),
    };
  }, [zoomApiRef]);

  // Members a bloc frame could not fit (Quad across the Pacific): a chip offers a zoomed-out fit.
  const [outside, setOutside] = useState<{ count: number; fit: ZoomTransform } | null>(null);

  const flyTo = (target: ZoomTransform) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    z.scaleExtent([Math.min(MIN_SCALE, target.k), MAX_SCALE]);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sel = select(svg);
    if (reduce) {
      z.transform(sel, target);
      return;
    }
    flyingRef.current = true;
    setFlying(true);
    const done = () => {
      flyingRef.current = false;
      setFlying(false);
    };
    z.transform(sel.transition().duration(650).on('end', done).on('interrupt', done) as never, target);
  };

  // Fly to the focused target whenever it changes. A side panel opening on its
  // own does not move the map; a bottom sheet growing or shrinking by more
  // than REFLY_THRESHOLD re-frames the current target above it.
  const flown = useRef<{ focus: Focus; projection: unknown; bottom: number } | null>(null);
  useEffect(() => {
    if (!zoomRef.current || !projection || !path || !width || !height || !focus) return;
    const last = flown.current;
    if (last && last.focus === focus && last.projection === projection) {
      if (insetBottom === 0 || Math.abs(last.bottom - insetBottom) <= REFLY_THRESHOLD) return;
    }
    flown.current = { focus, projection, bottom: insetBottom };
    const rect = visibleRect(width, height, insetsRef.current);
    const cxView = (rect.x0 + rect.x1) / 2;
    const cyView = (rect.y0 + rect.y1) / 2;
    const feats = featuresRef.current;
    const footprint = (iso: string): { bounds: Bounds; centre: [number, number] } | null => {
      const f = feats.find((x) => x.properties.iso === iso);
      if (f) {
        const main = largestPolygon(f) ?? f;
        return { bounds: path.bounds(main), centre: path.centroid(main) };
      }
      const micro = MICROSTATES.find((m) => m.iso === iso);
      const p = micro ? projection(micro.lonLat) : null;
      return p
        ? {
            bounds: [
              [p[0] - 1, p[1] - 1],
              [p[0] + 1, p[1] + 1],
            ],
            centre: p,
          }
        : null;
    };
    let target: ZoomTransform | null = null;
    let miss: { count: number; fit: ZoomTransform } | null = null;
    if (focus.kind === 'restore') {
      target = preFlyRef.current;
      preFlyRef.current = null;
    } else if (focus.kind === 'reset') {
      preFlyRef.current = null;
      target = initialRef.current;
    } else if (focus.kind === 'country') {
      const f = feats.find((x) => x.properties.iso === focus.iso);
      const fp = f ? footprint(focus.iso) : null;
      if (fp) {
        const fit = fitBounds(fp.bounds, rect, 0.65, MIN_SCALE, MAX_SCALE);
        target = zoomIdentity.translate(fit.x, fit.y).scale(fit.k);
      } else {
        const micro = MICROSTATES.find((m) => m.iso === focus.iso);
        const p = micro ? projection(micro.lonLat) : null;
        if (p) target = zoomIdentity.translate(cxView - 6 * p[0], cyView - 6 * p[1]).scale(6);
      }
    } else if (focus.kind === 'isos') {
      const fps = focus.isos.map(footprint).filter((x): x is NonNullable<typeof x> => x !== null);
      const ub = unionBounds(fps.map((x) => x.bounds));
      if (ub) {
        const fit = fitBounds(ub, rect, 0.85, MIN_SCALE, ISOS_MAX_SCALE);
        if (fit.rawK >= MIN_SCALE) target = zoomIdentity.translate(fit.x, fit.y).scale(fit.k);
        else {
          // Too spread out for k >= 1: keep the world view and say what it leaves out.
          target = initialRef.current;
          const t = target;
          const count = fps.filter((x) => !inView(x.centre, t, rect)).length;
          if (count) {
            const wide = fitBounds(ub, rect, 0.92, FIT_MIN_SCALE, MIN_SCALE);
            miss = { count, fit: zoomIdentity.translate(wide.x, wide.y).scale(wide.k) };
          }
        }
      }
    } else {
      const p = projection(focus.lonLat);
      const k = focus.scale ?? 4;
      if (p) target = zoomIdentity.translate(cxView - k * p[0], cyView - k * p[1]).scale(k);
    }
    setOutside(miss);
    if (!target) return;
    // Remember where a chain of fly-tos started so closing the panel can return there.
    if (focus.kind !== 'restore' && focus.kind !== 'reset' && !preFlyRef.current) preFlyRef.current = zoomTransform(svgRef.current!);
    flyTo(target);
    // Insets other than the sheet are read when the focus changes; see REFLY_THRESHOLD.
  }, [focus, projection, path, width, height, insetBottom]);

  const placed = useMemo(() => {
    if (transform.k < DETAIL_SCALE || !projection) return [];
    const r = (mk: MapMarker) => mk.radius * (0.6 + 0.4 / Math.sqrt(transform.k));
    const screenMarkers = markers.flatMap((mk) => {
      const p = projection(mk.lonLat);
      if (!p) return [];
      const [x, y] = transform.apply(p);
      return [{ x, y, r: r(mk) + 3 }];
    });
    return placeLabels(anchors, {
      t: transform,
      view: visibleRect(width, height, insets),
      obstacles: obstacles ?? [],
      markers: screenMarkers,
      priority: labelPriority ? new Set(labelPriority) : undefined,
    });
    // insets are listed as primitives so a new object each render doesn't recompute.
  }, [anchors, transform, projection, markers, width, height, insetTop, insetRight, insetBottom, obstacles, labelPriority]);

  const themeKey = useThemeKey();
  const scaleAdjust = 1 / Math.sqrt(transform.k);

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    const sel = select(svg).transition().duration(150) as never;
    const pan: Record<string, [number, number]> = { ArrowLeft: [KEY_PAN, 0], ArrowRight: [-KEY_PAN, 0], ArrowUp: [0, KEY_PAN], ArrowDown: [0, -KEY_PAN] };
    if (pan[e.key]) {
      const [dx, dy] = pan[e.key]!;
      z.translateBy(sel, dx / transform.k, dy / transform.k);
    } else if (e.key === '+' || e.key === '=') z.scaleBy(sel, 1.5);
    else if (e.key === '-' || e.key === '_') z.scaleBy(sel, 1 / 1.5);
    else if (e.key === '0' || e.key === 'Home') z.transform(sel, initialRef.current);
    else if (e.key === 'Escape') {
      // Not consumed: the app-level Escape still closes the panel.
      onHover(null, 0, 0);
      return;
    } else return;
    preFlyRef.current = null;
    e.preventDefault();
  };

  return (
    <div ref={rootRef} className="map-root">
      {projection && path && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          tabIndex={0}
          role="group"
          aria-roledescription="map"
          aria-label="World map. Arrow keys pan, plus and minus zoom, 0 resets. Use search to jump to a country."
          onKeyDown={onKeyDown}
        >
          <g ref={layerRef}>
            <path className="sphere" d={spherePath} />
            {/* The vignette darkens the ocean edge only; drawn under the countries, it never shifts a data class. */}
            <path className="sphere-vignette" d={spherePath} fill="url(#ocean-vignette)" />
            <path className="graticule" d={graticulePath} />
            <CountryLayer features={features} paths={paths} fillFor={fillFor} selectedIsos={selectedIsos} onCountryClick={onCountryClick} onHover={onCountryHover} />
            <CountryOutlines features={features} paths={paths} selectedIsos={selectedIsos} hoverIso={hoverIso} />
          </g>
          <defs>
            <radialGradient id="ocean-vignette" cx="50%" cy="50%" r="50%">
              <stop offset="0.55" stopColor="var(--bg)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--bg)" stopOpacity="0.7" />
            </radialGradient>
            <filter id="marker-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g className="overlay">
            {showMicrostates &&
              MICROSTATES.filter((m) => !drawn.has(m.iso)).map((m) => {
                const p = projection(m.lonLat);
                if (!p) return null;
                const style = fillFor(m.iso);
                const [x, y] = transform.apply(p);
                return (
                  <rect
                    key={m.iso}
                    className="microstate"
                    x={x - 3.5}
                    y={y - 3.5}
                    width={7}
                    height={7}
                    rx={1.5}
                    fill={style.stripes ? style.stripes[0] : (style.hatch ?? style.fill)}
                    opacity={style.dim ? 0.6 : 1}
                    stroke={selectedIsos.includes(m.iso) ? 'var(--fg)' : style.outline}
                    strokeDasharray={style.outline && !selectedIsos.includes(m.iso) ? '2 1.5' : undefined}
                    onClick={() => onCountryClick(m.iso)}
                    onPointerEnter={(e) => onHover({ label: m.name, iso: m.iso }, e.clientX, e.clientY)}
                    onPointerLeave={() => onHover(null, 0, 0)}
                  />
                );
              })}
            {markers.map((mk) => {
              const p = projection(mk.lonLat);
              if (!p) return null;
              const [x, y] = transform.apply(p);
              const r = mk.radius * (0.6 + 0.4 * scaleAdjust);
              const selected = selectedMarkerIds.includes(mk.id);
              return (
                <g
                  key={mk.id}
                  className={'marker' + (mk.pulse ? ' pulse' : '') + (mk.shape && mk.shape !== 'circle' ? ' ' + mk.shape : '')}
                  data-selected={selected}
                  data-shape={mk.shape ?? 'circle'}
                  transform={`translate(${x},${y})`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onMarkerClick(mk.id);
                    }
                  }}
                  onFocus={(e) => onHover({ label: mk.label }, e.currentTarget.getBoundingClientRect().left, e.currentTarget.getBoundingClientRect().top)}
                  onBlur={() => onHover(null, 0, 0)}
                  onClick={() => onMarkerClick(mk.id)}
                  onPointerEnter={(e) => onHover({ label: mk.label }, e.clientX, e.clientY)}
                  onPointerLeave={() => onHover(null, 0, 0)}
                  role="button"
                  aria-label={mk.label}
                >
                  {selected && (
                    <g className="reticle">
                      <circle r={r + 11} strokeDasharray="6 5" />
                      <path d={`M0 ${-(r + 16)}v7M0 ${r + 16}v-7M${-(r + 16)} 0h7M${r + 16} 0h-7`} />
                    </g>
                  )}
                  {/* A finger-sized hit area on touch screens; hidden for fine pointers. */}
                  <circle className="hit" r={Math.max(12, r + 3)} />
                  {mk.shape === 'triangle' ? (
                    <>
                      <path className="ring" d={triPath(r + 3)} stroke={mk.color} />
                      <path className="core" d={triPath(r)} fill={mk.color} filter="url(#marker-glow)" />
                    </>
                  ) : mk.shape === 'diamond' ? (
                    <>
                      <rect className="ring" x={-(r + 3)} y={-(r + 3)} width={2 * (r + 3)} height={2 * (r + 3)} transform="rotate(45)" stroke={mk.color} />
                      <DiamondCore r={r} color={mk.color} glyph={mk.glyph} />
                    </>
                  ) : (
                    <>
                      <circle className="ring" r={r + 3} stroke={mk.color} />
                      <circle className="core" r={r} fill={mk.color} filter="url(#marker-glow)" />
                    </>
                  )}
                </g>
              );
            })}
            {/* Labels after markers so a marker never overprints a name; placement already avoids them. */}
            {placed.map((l) => (
              <text key={l.iso} className={'country-label' + labelTone(fillFor(l.iso).fill, themeKey)} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" aria-hidden="true">
                {l.name}
              </text>
            ))}
          </g>
        </svg>
      )}
      {outside && (
        <button
          className="map-hud"
          style={{ top: insetTop, left: Math.max(width - insetRight, width * 0.4) / 2 }}
          onClick={() => {
            flyTo(outside.fit);
            setOutside(null);
          }}
        >
          {outside.count} member{outside.count === 1 ? '' : 's'} outside view · <b>Fit</b>
        </button>
      )}
    </div>
  );
}
