import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath, type GeoPath } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import 'd3-transition';
import { COUNTRY_FEATURES, MICROSTATES, type CountryFeature } from '../lib/geo';
import { COUNTRY_BY_ISO } from '../lib/countries';

export interface MapMarker {
  id: string;
  lonLat: [number, number];
  color: string;
  radius: number;
  label: string;
  pulse?: boolean;
}

export type Focus =
  | { kind: 'country'; iso: string }
  | { kind: 'point'; lonLat: [number, number]; scale?: number }
  | { kind: 'reset' }
  | null;

export interface CountryFill {
  fill: string;
  /** When set, the polygon is drawn with a hatched pattern in this colour (suspended / frozen members). */
  hatch?: string;
  dim?: boolean;
}

interface Props {
  /** Fill rule for a polygon or microstate dot. `null` is unrecognised territory. */
  fillFor: (iso: string | null) => CountryFill;
  markers: MapMarker[];
  showMicrostates: boolean;
  selectedIso: string | null;
  selectedMarkerId: string | null;
  focus: Focus;
  /** Screen pixels covered by an overlay on the right; fly-to centres targets in the remaining area. */
  insetRight?: number;
  onCountryClick: (iso: string) => void;
  onMarkerClick: (id: string) => void;
  onHover: (hover: { label: string; sub?: string; iso?: string | null } | null, x: number, y: number) => void;
  zoomApiRef?: RefObject<{ zoomIn: () => void; zoomOut: () => void; reset: () => void } | null>;
}

const PAD = 8;
const MIN_SCALE = 1;
const MAX_SCALE = 16;

function useSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function hatchId(color: string) {
  return 'hatch-' + color.replace(/[^a-z0-9]/gi, '');
}

interface LayerProps {
  features: CountryFeature[];
  paths: string[];
  fillFor: Props['fillFor'];
  selectedIso: string | null;
  onCountryClick: Props['onCountryClick'];
  onHover: Props['onHover'];
}

/** Memoised so pan/zoom (which only mutates the parent <g> transform) never re-renders 177 paths. */
const CountryLayer = memo(function CountryLayer({ features, paths, fillFor, selectedIso, onCountryClick, onHover }: LayerProps) {
  const hatches = new Set<string>();
  const rendered = features.map((f, i) => {
    const iso = f.properties.iso;
    const style = fillFor(iso);
    if (style.hatch) hatches.add(style.hatch);
    const fill = style.hatch ? `url(#${hatchId(style.hatch)})` : style.fill;
    const country = iso ? COUNTRY_BY_ISO.get(iso) : undefined;
    return (
      <path
        key={iso ?? f.properties.name}
        className="country"
        d={paths[i]}
        fill={fill}
        opacity={style.dim ? 0.55 : 1}
        data-iso={iso ?? undefined}
        data-selected={iso !== null && iso === selectedIso}
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
        {[...hatches].map((color) => (
          <pattern key={color} id={hatchId(color)} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={color} opacity="0.35" />
            <rect width="3" height="6" fill={color} />
          </pattern>
        ))}
      </defs>
      {rendered}
    </>
  );
});

export default function WorldMap({
  fillFor,
  markers,
  showMicrostates,
  selectedIso,
  selectedMarkerId,
  focus,
  insetRight = 0,
  onCountryClick,
  onMarkerClick,
  onHover,
  zoomApiRef,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const { width, height } = useSize(rootRef);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;

  // Portrait screens (phones) would otherwise show a thin strip of map with
  // empty space above and below, so the globe is fitted to a wider virtual
  // canvas and the viewport starts centred on Europe and Africa. Panning is
  // bounded to the globe, not the viewport, so nothing becomes unreachable.
  const portrait = height > width * 1.15;
  const fitWidth = portrait ? Math.max(width, height * 1.25) : width;

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

  const path: GeoPath | null = useMemo(() => (projection ? geoPath(projection) : null), [projection]);

  const paths = useMemo(() => (path ? COUNTRY_FEATURES.map((f) => path(f) ?? '') : []), [path]);

  const sphereBounds = useMemo(() => (path ? path.bounds({ type: 'Sphere' }) : null), [path]);

  const initialTransform = useMemo(() => {
    if (!projection || !portrait) return zoomIdentity;
    const anchor = projection([18, 12]);
    return anchor ? zoomIdentity.translate(width / 2 - anchor[0], 0) : zoomIdentity;
  }, [projection, portrait, width]);
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
    const [[bx0, by0], [bx1, by1]] = sphereBounds ?? [
      [0, 0],
      [width, height],
    ];
    const behaviour = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .translateExtent([
        [Math.min(0, bx0 - PAD), Math.min(0, by0 - PAD)],
        [Math.max(width, bx1 + PAD), Math.max(height, by1 + PAD)],
      ])
      .on('zoom', (event) => {
        const t = event.transform as ZoomTransform;
        layerRef.current?.setAttribute('transform', t.toString());
        setTransform(t);
        // Whatever was under the pointer has moved; drop the tooltip until the next enter.
        onHoverRef.current(null, 0, 0);
      });
    const sel = select(svg);
    sel.call(behaviour).on('dblclick.zoom', null);
    behaviour.transform(sel, initialRef.current);
    zoomRef.current = behaviour;
    return () => {
      sel.on('.zoom', null);
      zoomRef.current = null;
    };
  }, [width, height, sphereBounds]);

  // Expose simple controls to the parent.
  useEffect(() => {
    if (!zoomApiRef) return;
    const run = (fn: (sel: ReturnType<typeof select<SVGSVGElement, unknown>>) => void) => {
      const svg = svgRef.current;
      if (!svg || !zoomRef.current) return;
      fn(select(svg).transition().duration(250) as unknown as ReturnType<typeof select<SVGSVGElement, unknown>>);
    };
    zoomApiRef.current = {
      zoomIn: () => run((s) => zoomRef.current!.scaleBy(s, 1.6)),
      zoomOut: () => run((s) => zoomRef.current!.scaleBy(s, 1 / 1.6)),
      reset: () => run((s) => zoomRef.current!.transform(s, initialRef.current)),
    };
  }, [zoomApiRef]);

  // Fly to the focused country or point whenever it changes.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current || !projection || !path || !width || !height || !focus) return;
    const visW = Math.max(width - insetRight, width * 0.4);
    const cxView = visW / 2;
    const cyView = height / 2;
    let target: ZoomTransform | null = null;
    if (focus.kind === 'reset') {
      target = initialRef.current;
    } else if (focus.kind === 'country') {
      const f = COUNTRY_FEATURES.find((x) => x.properties.iso === focus.iso);
      if (f) {
        const [[x0, y0], [x1, y1]] = path.bounds(f);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, 0.65 / Math.max(dx / visW, dy / height)));
        target = zoomIdentity.translate(cxView - k * cx, cyView - k * cy).scale(k);
      } else {
        const micro = MICROSTATES.find((m) => m.iso === focus.iso);
        if (micro) {
          const p = projection(micro.lonLat);
          if (p) target = zoomIdentity.translate(cxView - 6 * p[0], cyView - 6 * p[1]).scale(6);
        }
      }
    } else {
      const p = projection(focus.lonLat);
      const k = focus.scale ?? 4;
      if (p) target = zoomIdentity.translate(cxView - k * p[0], cyView - k * p[1]).scale(k);
    }
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sel = select(svg);
    if (reduce) zoomRef.current.transform(sel, target);
    else zoomRef.current.transform(sel.transition().duration(650) as never, target);
    // insetRight is read when focus changes; a panel opening on its own should not move the map.
  }, [focus, projection, path, width, height]);

  const scaleAdjust = 1 / Math.sqrt(transform.k);

  return (
    <div ref={rootRef} className="map-root" role="img" aria-label="World map">
      {projection && path && (
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
          <g ref={layerRef}>
            <path className="sphere" d={spherePath} />
            <path className="graticule" d={graticulePath} />
            <CountryLayer features={COUNTRY_FEATURES} paths={paths} fillFor={fillFor} selectedIso={selectedIso} onCountryClick={onCountryClick} onHover={onHover} />
          </g>
          <defs>
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
              MICROSTATES.map((m) => {
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
                    fill={style.hatch ?? style.fill}
                    opacity={style.dim ? 0.6 : 1}
                    stroke={m.iso === selectedIso ? 'var(--fg)' : undefined}
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
              const selected = mk.id === selectedMarkerId;
              return (
                <g
                  key={mk.id}
                  className={'marker' + (mk.pulse ? ' pulse' : '')}
                  data-selected={selected}
                  transform={`translate(${x},${y})`}
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
                  <circle className="ring" r={r + 3} stroke={mk.color} />
                  <circle className="core" r={r} fill={mk.color} filter="url(#marker-glow)" />
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
