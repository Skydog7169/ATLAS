import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { geoIdentity, geoPath } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import 'd3-transition';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import topo from 'us-atlas/states-albers-10m.json';
import { useSize } from '../hooks/useSize';
import { STATE_BY_FIPS, type UsState } from '../lib/usStates';

interface Props {
  fillFor: (s: UsState) => string;
  selectedCode: string | null;
  /** Fly to this state when it changes (search, a shared link). */
  focusCode: string | null;
  insetRight?: number;
  onStateClick: (code: string) => void;
  onHover: (hover: { label: string; sub?: string; iso?: string | null; state?: string } | null, x: number, y: number) => void;
  zoomApiRef?: RefObject<{ zoomIn: () => void; zoomOut: () => void; reset: () => void } | null>;
}

type StateFeature = Feature<Geometry, { name: string }> & { state: UsState };

// us-atlas ships the states already projected to Albers USA (Alaska and
// Hawaii inset) on a 975×610 canvas, so the map only scales it to fit.
const FEATURES: StateFeature[] = (() => {
  const t = topo as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>;
  const fc = feature(t, t.objects.states) as FeatureCollection<Geometry, { name: string }>;
  return fc.features.flatMap((f) => {
    const state = STATE_BY_FIPS.get(String(f.id).padStart(2, '0'));
    return state ? [{ ...f, state }] : [];
  });
})();

const PAD = 16;
const MAX_SCALE = 12;
const KEY_PAN = 80;

export default function UsMap({ fillFor, selectedCode, focusCode, insetRight = 0, onStateClick, onHover, zoomApiRef }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const { width, height } = useSize(rootRef);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;

  const path = useMemo(() => {
    if (!width || !height) return null;
    const projection = geoIdentity().fitExtent(
      [
        [PAD, PAD + 44],
        [Math.max(PAD * 2, width - PAD), Math.max(PAD * 2, height - PAD - 40)],
      ],
      { type: 'FeatureCollection', features: FEATURES },
    );
    return geoPath(projection);
  }, [width, height]);

  const shapes = useMemo(
    () =>
      path
        ? FEATURES.map((f) => {
            const [[x0, y0], [x1, y1]] = path.bounds(f);
            const [cx, cy] = path.centroid(f);
            return { f, d: path(f) ?? '', cx, cy, w: x1 - x0, bounds: [x0, y0, x1, y1] as const };
          })
        : [],
    [path],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !width || !height) return;
    const behaviour = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_SCALE])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on('zoom', (event) => {
        const t = event.transform as ZoomTransform;
        layerRef.current?.setAttribute('transform', t.toString());
        setTransform(t);
        onHoverRef.current(null, 0, 0);
      });
    const sel = select(svg);
    sel.call(behaviour).on('dblclick.zoom', null);
    zoomRef.current = behaviour;
    return () => {
      sel.on('.zoom', null);
      zoomRef.current = null;
    };
  }, [width, height]);

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
      reset: () => run((s) => zoomRef.current!.transform(s, zoomIdentity)),
    };
  }, [zoomApiRef]);

  // Fly to a state picked from search or opened from a link.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current || !focusCode || !width || !height) return;
    const shape = shapes.find((s) => s.f.state.code === focusCode);
    if (!shape) return;
    const [x0, y0, x1, y1] = shape.bounds;
    const visW = Math.max(width - insetRight, width * 0.4);
    const k = Math.max(1, Math.min(MAX_SCALE, 0.6 / Math.max((x1 - x0) / visW, (y1 - y0) / height)));
    const target = zoomIdentity.translate(visW / 2 - (k * (x0 + x1)) / 2, height / 2 - (k * (y0 + y1)) / 2).scale(k);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sel = select(svg);
    if (reduce) zoomRef.current.transform(sel, target);
    else zoomRef.current.transform(sel.transition().duration(650) as never, target);
    // insetRight is read when the focus changes; a panel opening on its own should not move the map.
  }, [focusCode, shapes, width, height]);

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
    else if (e.key === '0' || e.key === 'Home') z.transform(sel, zoomIdentity);
    else if (e.key === 'Escape') onHover(null, 0, 0);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={rootRef} className="map-root us-map">
      {path && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          tabIndex={0}
          role="application"
          aria-label="Map of the United States by state. Arrow keys pan, plus and minus zoom, 0 resets. Use search to jump to a state."
          onKeyDown={onKeyDown}
        >
          <g ref={layerRef}>
            {shapes.map(({ f, d }) => {
              const s = f.state;
              return (
                <path
                  key={s.code}
                  className="country us-state"
                  d={d}
                  fill={fillFor(s)}
                  data-state={s.code}
                  data-selected={s.code === selectedCode}
                  onClick={() => onStateClick(s.code)}
                  onPointerEnter={(e) => onHover({ label: s.name, state: s.code }, e.clientX, e.clientY)}
                  onPointerLeave={() => onHover(null, 0, 0)}
                />
              );
            })}
          </g>
          <g className="overlay" aria-hidden="true">
            {shapes.map(({ f, cx, cy, w }) => {
              if (!Number.isFinite(cx) || w * transform.k < 30) return null;
              const [x, y] = transform.apply([cx, cy]);
              return (
                <text key={f.state.code} className="country-label state-label" x={x} y={y} textAnchor="middle" dominantBaseline="middle">
                  {transform.k >= 3 ? f.state.name.toUpperCase() : f.state.code}
                </text>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
