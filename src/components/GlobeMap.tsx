import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoCentroid, geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { COUNTRY_FEATURES, MICROSTATES, drawnIsos } from '../lib/geo';
import { useSize } from '../hooks/useSize';
import { triPath } from '../lib/shapes';
import { useHoverIso } from '../hooks/useMapOverlays';
import { CountryLayer, CountryOutlines, DiamondCore, type Focus, type MapMarker, type CountryFill } from './WorldMap';

interface Props {
  fillFor: (iso: string | null) => CountryFill;
  markers: MapMarker[];
  showMicrostates: boolean;
  selectedIso: string | null;
  selectedMarkerId: string | null;
  focus: Focus;
  insetRight?: number;
  /** Globe centre [longitude, latitude]. */
  rotation: [number, number];
  onRotate: (rotation: [number, number]) => void;
  onCountryClick: (iso: string) => void;
  onMarkerClick: (id: string) => void;
  onHover: (hover: { label: string; sub?: string; iso?: string | null } | null, x: number, y: number) => void;
  zoomApiRef?: React.RefObject<{ zoomIn: () => void; zoomOut: () => void; reset: () => void } | null>;
}

const PAD = 12;
const MIN_K = 1;
const MAX_K = 8;
const KEY_STEP = 12;

/**
 * Orthographic globe. Dragging rotates it (with inertia on release), the
 * wheel and pinch zoom, arrow keys rotate. The 1:110m geometry is always
 * used because every path is re-projected on each frame of rotation.
 * Rotation is reported back so the URL can carry it.
 */
export default function GlobeMap({ fillFor, markers, showMicrostates, selectedIso, selectedMarkerId, focus, insetRight = 0, rotation, onRotate, onCountryClick, onMarkerClick, onHover, zoomApiRef }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { width, height } = useSize(rootRef);
  const [hoverIso, onCountryHover] = useHoverIso(onHover);
  const [k, setK] = useState(1);
  // Live rotation during a drag lives in state; the parent only hears about it when the gesture ends.
  const [rot, setRot] = useState<[number, number]>(rotation);
  const rotRef = useRef(rot);
  rotRef.current = rot;
  const onRotateRef = useRef(onRotate);
  onRotateRef.current = onRotate;
  const drawn = useMemo(() => drawnIsos(COUNTRY_FEATURES), []);

  useEffect(() => {
    if (rotation[0] !== rotRef.current[0] || rotation[1] !== rotRef.current[1]) setRot(rotation);
    // Only external changes (URL, fly-to) should overwrite the live rotation.
  }, [rotation[0], rotation[1]]);

  const base = useMemo(() => {
    if (!width || !height) return null;
    const visW = Math.max(width - insetRight, width * 0.5);
    return geoOrthographic().fitExtent(
      [
        [PAD, PAD],
        [visW - PAD, height - PAD],
      ],
      { type: 'Sphere' },
    );
  }, [width, height, insetRight]);

  const projection = useMemo(() => {
    if (!base) return null;
    return geoOrthographic()
      .translate(base.translate())
      .scale(base.scale() * k)
      .rotate([-rot[0], -rot[1]])
      .clipAngle(90);
  }, [base, k, rot]);

  const path = useMemo(() => (projection ? geoPath(projection) : null), [projection]);
  const paths = useMemo(() => (path ? COUNTRY_FEATURES.map((f) => path(f) ?? '') : []), [path]);
  const spherePath = useMemo(() => (path ? (path({ type: 'Sphere' }) ?? '') : ''), [path]);
  const graticulePath = useMemo(() => (path ? (path(geoGraticule10()) ?? '') : ''), [path]);
  const centre = useMemo<[number, number]>(() => [rot[0], rot[1]], [rot]);
  const visible = useCallback((lonLat: [number, number]) => geoDistance(lonLat, centre) < Math.PI / 2 - 0.02, [centre]);

  const degPerPx = base ? 57.3 / (base.scale() * k) : 0.3;

  // --- pointer handling: drag to rotate, two pointers to pinch, inertia on release ---
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; t: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; k: number } | null>(null);
  const inertia = useRef<number | null>(null);

  const stopInertia = () => {
    if (inertia.current !== null) cancelAnimationFrame(inertia.current);
    inertia.current = null;
  };

  const commit = useCallback((r: [number, number]) => {
    const norm: [number, number] = [Math.round(((((r[0] + 180) % 360) + 360) % 360) - 180), Math.round(Math.max(-89, Math.min(89, r[1])))];
    onRotateRef.current(norm);
  }, []);

  const applyDelta = (dx: number, dy: number) => {
    setRot((r) => [r[0] - dx * degPerPx, Math.max(-89, Math.min(89, r[1] + dy * degPerPx))]);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    stopInertia();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), k };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: performance.now(), moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      setK(Math.max(MIN_K, Math.min(MAX_K, (pinch.current.k * d) / pinch.current.d)));
      return;
    }
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
    const dt = Math.max(1, now - d.t);
    d.vx = 0.7 * d.vx + 0.3 * (dx / dt);
    d.vy = 0.7 * d.vy + 0.3 * (dy / dt);
    d.x = e.clientX;
    d.y = e.clientY;
    d.t = now;
    applyDelta(dx, dy);
    if (d.moved) onHover(null, 0, 0);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let vx = d.vx * 16;
    let vy = d.vy * 16; // px per frame at 60fps
    if (reduce || Math.hypot(vx, vy) < 1.5) {
      commit(rotRef.current);
      return;
    }
    const step = () => {
      vx *= 0.94;
      vy *= 0.94;
      applyDelta(vx, vy);
      if (Math.hypot(vx, vy) < 0.3) {
        inertia.current = null;
        commit(rotRef.current);
        return;
      }
      inertia.current = requestAnimationFrame(step);
    };
    inertia.current = requestAnimationFrame(step);
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setK((cur) => Math.max(MIN_K, Math.min(MAX_K, cur * Math.exp(-e.deltaY * 0.0015))));
  };

  // Smoothly rotate to a target centre (fly-to and keyboard).
  const tweenTo = useCallback(
    (target: [number, number], targetK?: number) => {
      stopInertia();
      const from = rotRef.current;
      const fromK = k;
      let dLon = target[0] - from[0];
      dLon = ((((dLon + 180) % 360) + 360) % 360) - 180;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        setRot([from[0] + dLon, target[1]]);
        if (targetK) setK(targetK);
        commit([from[0] + dLon, target[1]]);
        return;
      }
      const t0 = performance.now();
      const dur = 700;
      const step = () => {
        const u = Math.min(1, (performance.now() - t0) / dur);
        const e = 1 - Math.pow(1 - u, 3);
        setRot([from[0] + dLon * e, from[1] + (target[1] - from[1]) * e]);
        if (targetK) setK(fromK + (targetK - fromK) * e);
        if (u < 1) inertia.current = requestAnimationFrame(step);
        else {
          inertia.current = null;
          commit([from[0] + dLon, target[1]]);
        }
      };
      inertia.current = requestAnimationFrame(step);
    },
    [k, commit],
  );

  useEffect(() => {
    if (!focus || focus.kind === 'restore') return;
    if (focus.kind === 'reset') tweenTo([15, 20], 1);
    else if (focus.kind === 'country') {
      const f = COUNTRY_FEATURES.find((x) => x.properties.iso === focus.iso);
      const micro = MICROSTATES.find((m) => m.iso === focus.iso);
      const c = f ? (geoCentroid(f) as [number, number]) : micro?.lonLat;
      if (c) tweenTo([c[0], c[1]], f ? 2.2 : 4);
    } else tweenTo([focus.lonLat[0], focus.lonLat[1]], Math.min(MAX_K, (focus.scale ?? 4) / 1.4));
    // tweenTo captures k; re-running on k changes would restart the tween.
  }, [focus]);

  useEffect(() => {
    if (!zoomApiRef) return;
    zoomApiRef.current = {
      zoomIn: () => setK((c) => Math.min(MAX_K, c * 1.6)),
      zoomOut: () => setK((c) => Math.max(MIN_K, c / 1.6)),
      reset: () => tweenTo([15, 20], 1),
    };
  }, [zoomApiRef, tweenTo]);

  useEffect(() => () => stopInertia(), []);

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const r = rotRef.current;
    const steps: Record<string, [number, number]> = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, KEY_STEP], ArrowDown: [0, -KEY_STEP] };
    if (steps[e.key]) {
      const [a, b] = steps[e.key]!;
      tweenTo([r[0] + a, Math.max(-89, Math.min(89, r[1] + b))]);
    } else if (e.key === '+' || e.key === '=') setK((c) => Math.min(MAX_K, c * 1.5));
    else if (e.key === '-' || e.key === '_') setK((c) => Math.max(MIN_K, c / 1.5));
    else if (e.key === '0' || e.key === 'Home') tweenTo([15, 20], 1);
    else if (e.key === 'Escape') onHover(null, 0, 0);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={rootRef} className="map-root globe" data-view="globe" data-rotation={`${Math.round(rot[0])},${Math.round(rot[1])}`}>
      {projection && path && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          tabIndex={0}
          role="group"
          aria-roledescription="map"
          aria-label="Globe. Drag to rotate, arrow keys rotate, plus and minus zoom, 0 resets."
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onClickCapture={(e) => {
            // A drag that moved should not count as a click on whatever is under the pointer.
            if (drag.current?.moved) e.stopPropagation();
          }}
        >
          <defs>
            <radialGradient id="globe-shade" cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="white" stopOpacity="0.07" />
              <stop offset="1" stopColor="black" stopOpacity="0.35" />
            </radialGradient>
            <filter id="marker-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g>
            <path className="sphere" d={spherePath} />
            <path className="graticule" d={graticulePath} />
            <CountryLayer features={COUNTRY_FEATURES} paths={paths} fillFor={fillFor} selectedIso={selectedIso} onCountryClick={onCountryClick} onHover={onCountryHover} />
            <path className="globe-shade" d={spherePath} fill="url(#globe-shade)" pointerEvents="none" />
            <CountryOutlines features={COUNTRY_FEATURES} paths={paths} selectedIso={selectedIso} hoverIso={hoverIso} />
          </g>
          <g className="overlay">
            {showMicrostates &&
              MICROSTATES.filter((m) => !drawn.has(m.iso) && visible(m.lonLat)).map((m) => {
                const p = projection(m.lonLat);
                if (!p) return null;
                const style = fillFor(m.iso);
                return (
                  <rect
                    key={m.iso}
                    className="microstate"
                    x={p[0] - 3.5}
                    y={p[1] - 3.5}
                    width={7}
                    height={7}
                    rx={1.5}
                    fill={style.stripes ? style.stripes[0] : (style.hatch ?? style.fill)}
                    opacity={style.dim ? 0.6 : 1}
                    stroke={m.iso === selectedIso ? 'var(--fg)' : style.outline}
                    strokeDasharray={style.outline && m.iso !== selectedIso ? '2 1.5' : undefined}
                    onClick={() => onCountryClick(m.iso)}
                    onPointerEnter={(e) => onHover({ label: m.name, iso: m.iso }, e.clientX, e.clientY)}
                    onPointerLeave={() => onHover(null, 0, 0)}
                  />
                );
              })}
            {markers.map((mk) => {
              if (!visible(mk.lonLat)) return null;
              const p = projection(mk.lonLat);
              if (!p) return null;
              const r = mk.radius * (0.6 + 0.4 / Math.sqrt(k));
              const selected = mk.id === selectedMarkerId;
              return (
                <g
                  key={mk.id}
                  className={'marker' + (mk.pulse ? ' pulse' : '') + (mk.shape && mk.shape !== 'circle' ? ' ' + mk.shape : '')}
                  data-selected={selected}
                  data-shape={mk.shape ?? 'circle'}
                  transform={`translate(${p[0]},${p[1]})`}
                  tabIndex={0}
                  role="button"
                  aria-label={mk.label}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onMarkerClick(mk.id);
                    }
                  }}
                  onClick={() => onMarkerClick(mk.id)}
                  onPointerEnter={(e) => onHover({ label: mk.label }, e.clientX, e.clientY)}
                  onPointerLeave={() => onHover(null, 0, 0)}
                >
                  {selected && (
                    <g className="reticle">
                      <circle r={r + 11} strokeDasharray="6 5" />
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
          </g>
        </svg>
      )}
    </div>
  );
}
