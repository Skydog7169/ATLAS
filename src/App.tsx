import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BLOCS, BLOC_BY_ID, blocsForCountry } from './data/blocs';
import { CONFLICTS, CONFLICT_BY_ID, INTENSITY_ORDER, conflictsForCountry } from './data/conflicts';
import type { Intensity } from './data/types';
import { useAppState } from './hooks/useAppState';
import { INTENSITY_COLOR, INTENSITY_RADIUS } from './lib/labels';
import BlocChips from './components/BlocChips';
import DetailPanel from './components/DetailPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import Legend from './components/Legend';
import Search, { type SearchHit } from './components/Search';
import ThemeToggle from './components/ThemeToggle';
import type { CountryFill, Focus, MapMarker } from './components/WorldMap';

// The map pulls in d3 and the 110m geometry; loading it after the shell
// paints keeps first render fast on phones.
const WorldMap = lazy(() => import('./components/WorldMap'));

const OVERVIEW_STEPS = ['var(--land)', '#3a4a7a', '#4a5fa3', '#5b74cc', '#7aa2ff'];

const membershipCount = new Map<string, number>();
for (const b of BLOCS) for (const m of b.members) if (m.status === 'member') membershipCount.set(m.iso, (membershipCount.get(m.iso) ?? 0) + 1);

const maxIntensityByCountry = new Map<string, Intensity>();
for (const c of CONFLICTS) {
  for (const iso of c.countries) {
    const cur = maxIntensityByCountry.get(iso);
    if (!cur || INTENSITY_ORDER[c.intensity] > INTENSITY_ORDER[cur]) maxIntensityByCountry.set(iso, c.intensity);
  }
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="16" cy="16" rx="6" ry="14" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 16h28M16 2v28" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MapSkeleton() {
  return (
    <div className="map-skeleton" aria-busy="true">
      <div>
        <div className="globe" />
        Loading map…
      </div>
    </div>
  );
}

export default function App() {
  const { state, update } = useAppState();
  const { mode, bloc, selection } = state;
  const [hover, setHover] = useState<{ label: string; sub?: string; iso: string | null; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const zoomApi = useRef<{ zoomIn: () => void; zoomOut: () => void; reset: () => void } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [insetRight, setInsetRight] = useState(0);

  // On wide screens the detail panel floats over the right edge; tell the map
  // so fly-to animations centre targets in the uncovered area.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 821px)');
    const apply = () => setInsetRight(mq.matches && selection ? 380 + 24 : 0);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [selection]);

  const activeBloc = bloc ? BLOC_BY_ID.get(bloc) : undefined;

  const fillFor = useCallback(
    (iso: string | null): CountryFill => {
      if (!iso) return { fill: 'var(--land-dim)' };
      if (mode === 'conflicts') {
        const intensity = maxIntensityByCountry.get(iso);
        if (!intensity) return { fill: 'var(--land)' };
        const pct = intensity === 'high' ? 55 : intensity === 'medium' ? 42 : intensity === 'low' ? 30 : 22;
        return { fill: `color-mix(in srgb, ${INTENSITY_COLOR[intensity]} ${pct}%, var(--land))` };
      }
      if (activeBloc) {
        const m = activeBloc.members.find((x) => x.iso === iso);
        if (!m) return { fill: 'var(--land)', dim: true };
        if (m.status === 'member') return { fill: activeBloc.color };
        if (m.status === 'suspended' || m.status === 'frozen') return { fill: activeBloc.color, hatch: activeBloc.color };
        return { fill: `color-mix(in srgb, ${activeBloc.color} 45%, var(--land))` };
      }
      const n = Math.min(membershipCount.get(iso) ?? 0, OVERVIEW_STEPS.length - 1);
      return { fill: OVERVIEW_STEPS[n] ?? 'var(--land)' };
    },
    [mode, activeBloc],
  );

  const markers = useMemo<MapMarker[]>(() => {
    if (mode !== 'conflicts') return [];
    return [...CONFLICTS]
      .sort((a, b) => INTENSITY_ORDER[a.intensity] - INTENSITY_ORDER[b.intensity])
      .map((c) => ({
        id: c.id,
        lonLat: c.location,
        color: INTENSITY_COLOR[c.intensity],
        radius: INTENSITY_RADIUS[c.intensity],
        label: c.name,
        pulse: c.intensity === 'high',
      }));
  }, [mode]);

  const selectedIso = selection?.kind === 'country' ? selection.iso : null;
  const selectedMarkerId = selection?.kind === 'conflict' ? selection.id : null;

  const selectCountry = useCallback(
    (iso: string) => {
      update({ selection: { kind: 'country', iso } });
      setFocus({ kind: 'country', iso });
    },
    [update],
  );

  const selectConflict = useCallback(
    (id: string) => {
      const c = CONFLICT_BY_ID.get(id);
      update({ mode: 'conflicts', selection: { kind: 'conflict', id } });
      if (c) setFocus({ kind: 'point', lonLat: c.location, scale: 3.5 });
    },
    [update],
  );

  const selectBloc = useCallback(
    (id: string) => {
      update({ mode: 'blocs', bloc: id, selection: { kind: 'bloc', id } });
      setFocus({ kind: 'reset' });
    },
    [update],
  );

  const onPick = useCallback(
    (hit: SearchHit) => {
      if (hit.kind === 'country') selectCountry(hit.id);
      else if (hit.kind === 'bloc') selectBloc(hit.id);
      else selectConflict(hit.id);
    },
    [selectCountry, selectBloc, selectConflict],
  );

  const onHover = useCallback((h: { label: string; sub?: string; iso?: string | null } | null, clientX: number, clientY: number) => {
    if (!h) return setHover(null);
    const rect = stageRef.current?.getBoundingClientRect();
    setHover({ label: h.label, sub: h.sub, iso: h.iso ?? null, x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) });
  }, []);

  // Second tooltip line: memberships in blocs mode, conflicts in conflicts mode.
  const hoverDetail = useMemo(() => {
    if (!hover) return null;
    if (hover.sub) return hover.sub;
    if (!hover.iso) return null;
    if (mode === 'conflicts') {
      const list = conflictsForCountry(hover.iso).sort((a, b) => INTENSITY_ORDER[b.intensity] - INTENSITY_ORDER[a.intensity]);
      return list.length ? list.map((c) => c.name).join(' · ') : null;
    }
    const list = blocsForCountry(hover.iso).filter((x) => x.membership.status === 'member');
    return list.length ? list.map((x) => x.bloc.shortName).join(' · ') : 'No tracked bloc memberships';
  }, [hover, mode]);

  const conflictColor = useCallback((id: string) => {
    const c = CONFLICT_BY_ID.get(id);
    return c ? INTENSITY_COLOR[c.intensity] : 'var(--fg-muted)';
  }, []);

  return (
    <div className="app" data-panel-open={selection !== null}>
      <header className="header">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); update({ selection: null, bloc: null }); setFocus({ kind: 'reset' }); }}>
          <Logo />
          ATLAS
        </a>
        <div className="segmented" role="group" aria-label="Map mode">
          <button aria-pressed={mode === 'blocs'} onClick={() => update({ mode: 'blocs', selection: selection?.kind === 'conflict' ? null : selection })}>
            Blocs
          </button>
          <button aria-pressed={mode === 'conflicts'} onClick={() => update({ mode: 'conflicts', selection: selection?.kind === 'bloc' ? null : selection })}>
            Conflicts
          </button>
        </div>
        <div className="spacer" />
        <Search onPick={onPick} conflictColor={conflictColor} />
        <ThemeToggle />
      </header>

      <main className="stage" ref={stageRef}>
        <ErrorBoundary>
          <Suspense fallback={<MapSkeleton />}>
            <WorldMap
              fillFor={fillFor}
              markers={markers}
              showMicrostates={mode === 'blocs'}
              selectedIso={selectedIso}
              selectedMarkerId={selectedMarkerId}
              focus={focus}
              insetRight={insetRight}
              onCountryClick={selectCountry}
              onMarkerClick={selectConflict}
              onHover={onHover}
              zoomApiRef={zoomApi}
            />
          </Suspense>
        </ErrorBoundary>

        {mode === 'blocs' && (
          <BlocChips
            active={bloc}
            onChange={(id) => {
              update({ bloc: id, selection: id ? { kind: 'bloc', id } : selection?.kind === 'bloc' ? null : selection });
              if (!id) setFocus({ kind: 'reset' });
            }}
          />
        )}

        <Legend mode={mode} bloc={bloc} overviewSteps={OVERVIEW_STEPS} />

        <div className="map-controls">
          <button className="icon-btn" aria-label="Zoom in" onClick={() => zoomApi.current?.zoomIn()}>
            +
          </button>
          <button className="icon-btn" aria-label="Zoom out" onClick={() => zoomApi.current?.zoomOut()}>
            −
          </button>
          <button className="icon-btn" aria-label="Reset view" onClick={() => zoomApi.current?.reset()} title="Reset view">
            ⌂
          </button>
        </div>

        {hover && (
          <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
            <div>{hover.label}</div>
            {hoverDetail && <div className="sub">{hoverDetail}</div>}
          </div>
        )}

        {selection && (
          <ErrorBoundary>
            <DetailPanel
              selection={selection}
              onClose={() => update({ selection: null })}
              onSelectCountry={selectCountry}
              onSelectBloc={selectBloc}
              onSelectConflict={selectConflict}
              onHighlightBloc={(id) => {
                update({ mode: 'blocs', bloc: id });
                setFocus({ kind: 'reset' });
              }}
            />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
