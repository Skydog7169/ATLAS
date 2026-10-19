import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BLOCS, BLOC_BY_ID, blocsForCountry } from './data/blocs';
import { CONFLICTS, CONFLICT_BY_ID, INTENSITY_ORDER, conflictsForCountry } from './data/conflicts';
import type { Intensity } from './data/types';
import { useAppState } from './hooks/useAppState';
import { currentMonth, earliestMonth, entryAt, monthRange } from './lib/history';
import Timeline from './components/Timeline';
import { DISPLACEMENT_BY_ISO, displacementColor, formatPeople } from './lib/displacement';
import { sanctionsColor, sanctionsSummary } from './lib/sanctions';
import { electionColor, electionSummary } from './lib/elections';
import { nuclearColor, nuclearSummary } from './lib/nuclear';
import { ACLED, acledColor, acledSummary } from './lib/acled';
import { militaryColor, militarySummary } from './lib/military';
import { tradeColor, tradeSummary } from './lib/trade';
import { CHOKEPOINTS, CHOKEPOINT_BY_ID, CHOKEPOINT_COLOR, CHOKEPOINT_MARKER_PREFIX, CHOKEPOINT_STATUS_LABEL, currentStatus } from './lib/chokepoints';
import LayerMenu, { type LayerOption } from './components/LayerMenu';
import { INTENSITY_COLOR, INTENSITY_RADIUS } from './lib/labels';
import BlocChips from './components/BlocChips';
import DetailPanel from './components/DetailPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import Legend from './components/Legend';
import Search, { type SearchHit } from './components/Search';
import ThemeToggle from './components/ThemeToggle';
import Clock from './components/Clock';
import Ticker from './components/Ticker';
import SinceLastVisit from './components/SinceLastVisit';
import { ASK_ENABLED } from './components/AskPanel';
import { useWatchlist } from './hooks/useWatchlist';
import { formatMonth } from './lib/labels';
import type { CountryFill, Focus, MapMarker } from './components/WorldMap';

// The map pulls in d3 and the 110m geometry; loading it after the shell
// paints keeps first render fast on phones.
const WorldMap = lazy(() => import('./components/WorldMap'));

const OVERVIEW_STEPS = ['var(--land)', '#123a4a', '#17607a', '#1f8fb3', '#35e0ff'];

const LAYER_OPTIONS: LayerOption[] = [
  { id: 'displacement', label: 'Displacement', hint: 'People displaced from each country (UNHCR)' },
  { id: 'sanctions', label: 'Sanctions', hint: 'UN, US and EU regimes targeting the country' },
  { id: 'elections', label: 'Elections', hint: 'Months to the next national election' },
  { id: 'nuclear', label: 'Nuclear', hint: 'Armed, threshold, hosting and umbrella states' },
  { id: 'military', label: 'Military presence', hint: 'Foreign bases, deployments and peace operations by host' },
  { id: 'trade', label: 'Trade dependence', hint: 'Export share to the US, China or the EU (WITS)' },
  { id: 'chokepoints', label: 'Chokepoints', hint: 'Eight maritime passages with dated status' },
  // The ACLED slot only appears when the weekly build had credentials for the API.
  ...(ACLED.available ? [{ id: 'acled' as const, label: 'Violence events', hint: `ACLED political-violence events, last ${ACLED.days} days` }] : []),
];

/** Newest `updated` month across both datasets, shown in the header readouts. */
const DATA_ASOF = [...BLOCS.map((b) => b.updated), ...CONFLICTS.map((c) => c.updated)].sort().at(-1) ?? '';

const membershipCount = new Map<string, number>();
for (const b of BLOCS) for (const m of b.members) if (m.status === 'member') membershipCount.set(m.iso, (membershipCount.get(m.iso) ?? 0) + 1);

// Replay covers conflict assessments only; bloc events go back years and would stretch the scrubber.
const TIMELINE_MONTHS = monthRange(earliestMonth(CONFLICTS, []), currentMonth());

/** Conflicts with the assessment in force for the view month (live = newest). */
function conflictsAt(month: string | null): Array<{ conflict: (typeof CONFLICTS)[number]; intensity: Intensity }> {
  const out: Array<{ conflict: (typeof CONFLICTS)[number]; intensity: Intensity }> = [];
  for (const c of CONFLICTS) {
    const entry = month ? entryAt(c, month) : c.history[0];
    if (entry) out.push({ conflict: c, intensity: entry.intensity });
  }
  return out;
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 1v6M16 25v6M1 16h6M25 16h6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="1.6" fill="var(--warn)" />
    </svg>
  );
}

function MapSkeleton() {
  return (
    <div className="map-skeleton" aria-busy="true">
      <div>
        <div className="globe" />
        INITIALISING MAP
      </div>
    </div>
  );
}

export default function App() {
  const { state, update } = useAppState();
  const { mode, bloc, vs, selection, month, layer } = state;
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<{ label: string; sub?: string; iso: string | null; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const zoomApi = useRef<{ zoomIn: () => void; zoomOut: () => void; reset: () => void } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [insetRight, setInsetRight] = useState(0);
  const watchlist = useWatchlist();

  // On wide screens the detail panel floats over the right edge; tell the map
  // so fly-to animations centre targets in the uncovered area.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 821px)');
    const apply = () => setInsetRight(mq.matches && selection ? 380 + 24 : 0);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [selection]);

  // A shared link that names a country or conflict should land zoomed on it.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current) return;
    landed.current = true;
    if (selection?.kind === 'country') setFocus({ kind: 'country', iso: selection.iso });
    else if (selection?.kind === 'conflict') {
      const c = CONFLICT_BY_ID.get(selection.id);
      if (c) setFocus({ kind: 'point', lonLat: c.location, scale: 3.5 });
    } else if (selection?.kind === 'chokepoint') {
      const cp = CHOKEPOINT_BY_ID.get(selection.id);
      if (cp) setFocus({ kind: 'point', lonLat: cp.location, scale: 3 });
    }
  }, [selection]);

  const activeBloc = bloc ? BLOC_BY_ID.get(bloc) : undefined;
  const vsBloc = vs ? BLOC_BY_ID.get(vs) : undefined;
  const compare = mode === 'blocs' && activeBloc && vsBloc ? { a: activeBloc, b: vsBloc } : null;

  const viewMonth = mode === 'conflicts' ? month : null;
  const visible = useMemo(() => conflictsAt(viewMonth), [viewMonth]);
  const maxIntensityByCountry = useMemo(() => {
    const map = new Map<string, Intensity>();
    for (const { conflict, intensity } of visible) {
      for (const iso of conflict.countries) {
        const cur = map.get(iso);
        if (!cur || INTENSITY_ORDER[intensity] > INTENSITY_ORDER[cur]) map.set(iso, intensity);
      }
    }
    return map;
  }, [visible]);

  const fillFor = useCallback(
    (iso: string | null): CountryFill => {
      if (!iso) return { fill: 'var(--land-dim)' };
      if (layer === 'displacement') return { fill: displacementColor(iso) };
      if (layer === 'sanctions') return { fill: sanctionsColor(iso) };
      if (layer === 'elections') return { fill: electionColor(iso) };
      if (layer === 'nuclear') return { fill: nuclearColor(iso) };
      if (layer === 'acled') return { fill: acledColor(iso) };
      if (layer === 'military') return { fill: militaryColor(iso) };
      if (layer === 'trade') return { fill: tradeColor(iso) };
      if (mode === 'conflicts') {
        const intensity = maxIntensityByCountry.get(iso);
        if (!intensity) return { fill: 'var(--land)' };
        const pct = intensity === 'high' ? 55 : intensity === 'medium' ? 42 : intensity === 'low' ? 30 : 22;
        return { fill: `color-mix(in srgb, ${INTENSITY_COLOR[intensity]} ${pct}%, var(--land))` };
      }
      if (compare) {
        const inA = compare.a.members.some((x) => x.iso === iso && x.status === 'member');
        const inB = compare.b.members.some((x) => x.iso === iso && x.status === 'member');
        if (inA && inB) return { fill: compare.a.color, stripes: [compare.a.color, compare.b.color] };
        if (inA) return { fill: compare.a.color };
        if (inB) return { fill: compare.b.color };
        return { fill: 'var(--land)', dim: true };
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
    [mode, activeBloc, compare, maxIntensityByCountry, layer],
  );

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    if (mode === 'conflicts') {
      for (const { conflict: c, intensity } of [...visible].sort((a, b) => INTENSITY_ORDER[a.intensity] - INTENSITY_ORDER[b.intensity])) {
        out.push({ id: c.id, lonLat: c.location, color: INTENSITY_COLOR[intensity], radius: INTENSITY_RADIUS[intensity], label: c.name, pulse: intensity === 'high' && viewMonth === null });
      }
    }
    if (layer === 'chokepoints') {
      for (const cp of CHOKEPOINTS) {
        const st = currentStatus(cp).status;
        out.push({ id: CHOKEPOINT_MARKER_PREFIX + cp.id, lonLat: cp.location, color: CHOKEPOINT_COLOR[st], radius: 7, label: `${cp.name}: ${CHOKEPOINT_STATUS_LABEL[st]}`, shape: 'diamond' });
      }
    }
    return out;
  }, [mode, visible, viewMonth, layer]);

  const selectedIso = selection?.kind === 'country' ? selection.iso : null;
  const selectedMarkerId = selection?.kind === 'conflict' ? selection.id : selection?.kind === 'chokepoint' ? CHOKEPOINT_MARKER_PREFIX + selection.id : null;

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

  const selectChokepoint = useCallback(
    (id: string) => {
      const cp = CHOKEPOINT_BY_ID.get(id);
      update({ layer: 'chokepoints', selection: { kind: 'chokepoint', id } });
      if (cp) setFocus({ kind: 'point', lonLat: cp.location, scale: 3 });
    },
    [update],
  );

  const onMarkerClick = useCallback(
    (id: string) => (id.startsWith(CHOKEPOINT_MARKER_PREFIX) ? selectChokepoint(id.slice(CHOKEPOINT_MARKER_PREFIX.length)) : selectConflict(id)),
    [selectChokepoint, selectConflict],
  );

  const selectPair = useCallback(
    (a: string, b: string | null) => {
      update({ selection: { kind: 'pair', a, b } });
      if (b) setFocus({ kind: 'reset' });
    },
    [update],
  );

  const selectBloc = useCallback(
    (id: string) => {
      update({ mode: 'blocs', bloc: id, vs: null, selection: { kind: 'bloc', id } });
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
    if (layer === 'displacement') {
      const row = DISPLACEMENT_BY_ISO.get(hover.iso);
      return row ? `${formatPeople(row.total)} displaced · ${formatPeople(row.refugees)} refugees · ${formatPeople(row.idps)} IDPs` : 'No UNHCR displacement figure';
    }
    if (layer === 'sanctions') {
      const s = sanctionsSummary(hover.iso);
      return s ? `Sanctions: ${s}` : 'No country-level sanctions regime';
    }
    if (layer === 'elections') return electionSummary(hover.iso) ?? 'No election on record';
    if (layer === 'nuclear') return nuclearSummary(hover.iso) ?? 'No nuclear role recorded';
    if (layer === 'acled') return acledSummary(hover.iso) ?? 'No ACLED events in the window';
    if (layer === 'military') return militarySummary(hover.iso) ?? 'No foreign military presence recorded';
    if (layer === 'trade') return tradeSummary(hover.iso) ?? 'No WITS export data';
    if (mode === 'conflicts') {
      const list = conflictsForCountry(hover.iso).sort((a, b) => INTENSITY_ORDER[b.intensity] - INTENSITY_ORDER[a.intensity]);
      return list.length ? list.map((c) => c.name).join(' · ') : null;
    }
    const list = blocsForCountry(hover.iso).filter((x) => x.membership.status === 'member');
    return list.length ? list.map((x) => x.bloc.shortName).join(' · ') : 'No tracked bloc memberships';
  }, [hover, mode, layer]);

  const conflictColor = useCallback((id: string) => {
    const c = CONFLICT_BY_ID.get(id);
    return c ? INTENSITY_COLOR[c.intensity] : 'var(--fg-muted)';
  }, []);

  return (
    <div className="app" data-panel-open={selection !== null} data-mode={mode} data-layer={layer ?? undefined}>
      <header className="header">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); update({ selection: null, bloc: null }); setFocus({ kind: 'reset' }); }}>
          <Logo />
          <span>
            <span className="word">ATLAS</span>
            <span className="tag">GEOPOLITICAL AWARENESS</span>
          </span>
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
        <div className="readouts" aria-label="Status readouts">
          <Clock />
          <span className="optional">
            TRACKED <b>{CONFLICTS.length}</b> · BLOCS <b>{BLOCS.length}</b>
          </span>
          <button className="readout-btn optional" onClick={() => update({ selection: { kind: 'changes' } })} title="Recent changes">
            DATA <b>{formatMonth(DATA_ASOF).toUpperCase()}</b>
          </button>
        </div>
        <Search onPick={onPick} conflictColor={conflictColor} />
        <button
          className="icon-btn"
          aria-label="Recent changes"
          aria-pressed={selection?.kind === 'changes'}
          title="Recent changes"
          onClick={() => update({ selection: selection?.kind === 'changes' ? null : { kind: 'changes' } })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h10M4 18h7" />
            <circle cx="18" cy="17" r="3" />
            <path d="M18 15.5V17l1 1" />
          </svg>
        </button>
        <button
          className="icon-btn"
          aria-label="Watchlist"
          aria-pressed={selection?.kind === 'watchlist'}
          title="Watchlist"
          data-count={watchlist.items.length || undefined}
          onClick={() => update({ selection: selection?.kind === 'watchlist' ? null : { kind: 'watchlist' } })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={watchlist.items.length ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8L12 3Z" />
          </svg>
        </button>
        {ASK_ENABLED && (
          <button
            className="icon-btn"
            aria-label="Ask ATLAS"
            aria-pressed={selection?.kind === 'ask'}
            title="Ask ATLAS"
            onClick={() => update({ selection: selection?.kind === 'ask' ? null : { kind: 'ask' } })}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 5h16v11H9l-5 4V5Z" />
              <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4" />
              <path d="M12 15.5h.01" />
            </svg>
          </button>
        )}
        <button
          className="icon-btn"
          aria-label="About ATLAS"
          aria-pressed={selection?.kind === 'about'}
          title="About"
          onClick={() => update({ selection: selection?.kind === 'about' ? null : { kind: 'about' } })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-5M12 8h.01" />
          </svg>
        </button>
        <ThemeToggle />
      </header>

      <main className="stage" ref={stageRef}>
        <SinceLastVisit onSelectConflict={selectConflict} onSelectBloc={selectBloc} onOpenChanges={() => update({ selection: { kind: 'changes' } })} />
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
              onMarkerClick={onMarkerClick}
              onHover={onHover}
              zoomApiRef={zoomApi}
            />
          </Suspense>
        </ErrorBoundary>

        {mode === 'blocs' && (
          <BlocChips
            active={bloc}
            vs={vs}
            picking={picking}
            onPicking={setPicking}
            onChange={(id) => {
              setPicking(false);
              update({ bloc: id, vs: null, selection: id ? { kind: 'bloc', id } : selection?.kind === 'bloc' || selection?.kind === 'compare' ? null : selection });
              if (!id) setFocus({ kind: 'reset' });
            }}
            onVs={(id) => {
              update({ vs: id, selection: id ? { kind: 'compare' } : bloc ? { kind: 'bloc', id: bloc } : null });
              setFocus({ kind: 'reset' });
            }}
          />
        )}

        <Legend mode={mode} bloc={bloc} vs={mode === 'blocs' ? vs : null} overviewSteps={OVERVIEW_STEPS} layer={layer} />

        {mode === 'conflicts' && <Timeline months={TIMELINE_MONTHS} value={month} onChange={(m) => update({ month: m })} />}

        <div className="map-controls">
          <LayerMenu options={LAYER_OPTIONS} value={layer} onChange={(l) => update({ layer: l })} />
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

        <Ticker onSelectConflict={selectConflict} onSelectBloc={selectBloc} />

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
              month={viewMonth}
              compare={compare}
              onStopCompare={() => update({ vs: null, selection: bloc ? { kind: 'bloc', id: bloc } : null })}
              onClose={() => update({ selection: null })}
              onSelectCountry={selectCountry}
              onSelectBloc={selectBloc}
              onSelectConflict={selectConflict}
              onHighlightBloc={(id) => {
                update({ mode: 'blocs', bloc: id });
                setFocus({ kind: 'reset' });
              }}
              onOpenChanges={() => update({ selection: { kind: 'changes' } })}
              onSelectChokepoint={selectChokepoint}
              onSelectPair={selectPair}
            />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
