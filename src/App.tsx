import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BLOCS, BLOC_BY_ID, blocsForCountry } from './data/blocs';
import { CONFLICTS, CONFLICT_BY_ID, INTENSITY_ORDER, conflictsForCountry } from './data/conflicts';
import type { Intensity } from './data/types';
import { useAppState } from './hooks/useAppState';
import { currentMonth, earliestMonth, entryAt, monthRange } from './lib/history';
import Timeline from './components/Timeline';
import { displacementFill } from './lib/displacement';
import { sanctionsFill } from './lib/sanctions';
import { electionColor } from './lib/elections';
import { nuclearColor } from './lib/nuclear';
import { ACLED, acledColor, acledUnrestColor } from './lib/acled';
import { UCDP, ucdpColor, ucdpYear } from './lib/ucdp';
import { UNREST, UNREST_BY_ID } from './data/unrest';
import { UNREST_COLOR, UNREST_MARKER_PREFIX, UNREST_RADIUS, UNREST_KIND_LABEL, unrestColor } from './lib/unrest';
import { militaryColor } from './lib/military';
import { tradeColor } from './lib/trade';
import { CHOKEPOINTS, CHOKEPOINT_BY_ID, CHOKEPOINT_COLOR, CHOKEPOINT_MARKER_PREFIX, CHOKEPOINT_STATUS_LABEL, currentStatus } from './lib/chokepoints';
import LayerMenu, { type LayerOption } from './components/LayerMenu';
import { INTENSITY_COLOR, INTENSITY_LABEL, INTENSITY_RADIUS } from './lib/labels';
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
import { formatDate, formatMonth } from './lib/labels';
import type { CountryFill, Focus, MapMarker } from './components/WorldMap';
import Briefing, { type BriefItem } from './components/Briefing';
import { COUNTRY_BY_ISO } from './lib/countries';
import { downloadBlob, readLegend, renderPng } from './lib/exportPng';
import { serialize } from './lib/urlState';
import { useMapChrome } from './hooks/useMapInsets';
import { backerOutlines, blocFocus, focusForSelection } from './lib/focus';
import { layerSummary } from './lib/layerSummary';
import { relationship } from './lib/relationship';
import LegendDock from './components/LegendDock';
import EmbedCaption from './components/EmbedCaption';
import MoreMenu from './components/MoreMenu';
import { conflictFillMaps, isTheatre } from './lib/theatre';
import { SOVEREIGN, memberFor, territoryLine } from './lib/sovereign';

// The map pulls in d3 and the 110m geometry; loading it after the shell
// paints keeps first render fast on phones.
const WorldMap = lazy(() => import('./components/WorldMap'));
const GlobeMap = lazy(() => import('./components/GlobeMap'));

const OVERVIEW_STEPS = ['var(--land)', '#123a4a', '#17607a', '#1f8fb3', '#35e0ff'];

const LAYER_OPTIONS: LayerOption[] = [
  { id: 'displacement', label: 'Displacement', hint: 'People displaced from each country (UNHCR)' },
  { id: 'sanctions', label: 'Sanctions', hint: 'UN, US and EU regimes targeting the country' },
  { id: 'elections', label: 'Elections', hint: 'Months to the next national election' },
  { id: 'nuclear', label: 'Nuclear', hint: 'Armed, threshold, hosting and umbrella states' },
  { id: 'military', label: 'Military presence', hint: 'Foreign bases, deployments and peace operations by host' },
  { id: 'trade', label: 'Trade dependence', hint: 'Export share to the US, China or the EU (WITS)' },
  { id: 'chokepoints', label: 'Chokepoints', hint: 'Eight maritime passages with dated status' },
  { id: 'unrest', label: 'Civil unrest', hint: 'Protest movements, riots, uprisings, coups and crackdowns' },
  // The ACLED slot only appears when the weekly build had credentials for the API.
  ...(ACLED.available ? [{ id: 'acled' as const, label: 'Violence events', hint: `ACLED political-violence events, last ${ACLED.days} days` }] : []),
  ...(ACLED.available ? [{ id: 'acled-unrest' as const, label: 'Protests and riots', hint: `ACLED protest and riot events, last ${ACLED.days} days` }] : []),
  ...(UCDP.available ? [{ id: 'ucdp' as const, label: 'Organised violence', hint: `UCDP deaths in state-based, non-state and one-sided violence, ${ucdpYear()}` }] : []),
];

/** Newest `updated` month across both datasets, shown in the header readouts. */
const DATA_ASOF = [...BLOCS.map((b) => b.updated), ...CONFLICTS.map((c) => c.updated)].sort().at(-1) ?? '';

const membershipCount = new Map<string, number>();
for (const b of BLOCS) for (const m of b.members) if (m.status === 'member') membershipCount.set(m.iso, (membershipCount.get(m.iso) ?? 0) + 1);
// Territories drawn on their own (Greenland) count the alliances they inherit from their sovereign.
for (const iso of Object.keys(SOVEREIGN)) for (const b of BLOCS) if (!b.members.some((m) => m.iso === iso) && memberFor(b, iso)) membershipCount.set(iso, (membershipCount.get(iso) ?? 0) + 1);

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
  const { mode, bloc, vs, selection, month, layer, view, rotation, brief, embed } = state;
  const [exporting, setExporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<{ label: string; sub?: string; iso: string | null; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const zoomApi = useRef<{ zoomIn: () => void; zoomOut: () => void; reset: () => void } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const watchlist = useWatchlist();

  // What the detail panel (side panel or bottom sheet), the embed caption and
  // the chip row cover, so every fly-to frames its target in the rest.
  const panelOpen = selection !== null && !embed;
  const chromeKey = [selection?.kind ?? '', mode, layer ?? '', embed, brief, bloc ?? '', vs ?? ''].join('|');
  const { insets, obstacles } = useMapChrome(stageRef, panelOpen, chromeKey);

  // A shared link that names a subject should land framed on it.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current) return;
    landed.current = true;
    const f = focusForSelection(selection, { bloc, vs });
    if (f) setFocus(f);
  }, [selection, bloc, vs]);

  const activeBloc = bloc ? BLOC_BY_ID.get(bloc) : undefined;
  const vsBloc = vs ? BLOC_BY_ID.get(vs) : undefined;
  const compare = mode === 'blocs' && activeBloc && vsBloc ? { a: activeBloc, b: vsBloc } : null;

  const viewMonth = mode === 'conflicts' ? month : null;
  const visible = useMemo(() => conflictsAt(viewMonth), [viewMonth]);
  // Theatre states are filled; parties fighting only abroad get a dashed outline.
  const { home: maxIntensityByCountry, abroad: partyAbroadByCountry } = useMemo(() => conflictFillMaps(visible), [visible]);

  const pair = selection?.kind === 'pair' ? selection : null;
  const selectedConflict = selection?.kind === 'conflict' ? CONFLICT_BY_ID.get(selection.id) : undefined;
  const theatre = useMemo(() => (selectedConflict ? new Set(selectedConflict.countries.filter((iso) => isTheatre(selectedConflict, iso))) : null), [selectedConflict]);
  const backers = useMemo(() => (selectedConflict ? backerOutlines(selectedConflict.id) : new Map<string, string>()), [selectedConflict]);

  const fillFor = useCallback(
    (iso: string | null): CountryFill => {
      if (!iso) return { fill: 'var(--land-dim)' };
      if (layer === 'displacement') return displacementFill(iso);
      if (layer === 'sanctions') return sanctionsFill(iso);
      if (layer === 'elections') return { fill: electionColor(iso) };
      if (layer === 'nuclear') return { fill: nuclearColor(iso) };
      if (layer === 'acled') return { fill: acledColor(iso) };
      if (layer === 'acled-unrest') return { fill: acledUnrestColor(iso) };
      if (layer === 'ucdp') return { fill: ucdpColor(iso) };
      if (layer === 'military') return { fill: militaryColor(iso) };
      if (layer === 'trade') return { fill: tradeColor(iso) };
      if (layer === 'unrest') return { fill: unrestColor(iso) };
      // The pair view paints its two countries and steps everything else back.
      if (pair) {
        if (iso === pair.a) return { fill: 'var(--accent)' };
        if (iso === pair.b) return { fill: 'var(--warn)' };
        if (pair.b) return { fill: 'var(--land)', dim: true };
      }
      if (mode === 'conflicts') {
        const intensity = maxIntensityByCountry.get(iso);
        if (!intensity) {
          const abroad = partyAbroadByCountry.get(iso);
          // With a conflict open, its foreign backers are outlined; parties fighting abroad keep theirs.
          const outline = (theatre ? backers.get(iso) : undefined) ?? (abroad ? INTENSITY_COLOR[abroad] : undefined);
          return { fill: 'var(--land)', dim: Boolean(theatre), outline };
        }
        const outline = theatre ? backers.get(iso) : undefined;
        const pct = intensity === 'high' ? 55 : intensity === 'medium' ? 42 : intensity === 'low' ? 30 : 22;
        // With a conflict open, only its theatre keeps full strength; backers get a dashed outline.
        return { fill: `color-mix(in srgb, ${INTENSITY_COLOR[intensity]} ${pct}%, var(--land))`, dim: theatre ? !theatre.has(iso) : false, outline };
      }
      if (compare) {
        const inA = memberFor(compare.a, iso)?.status === 'member';
        const inB = memberFor(compare.b, iso)?.status === 'member';
        if (inA && inB) return { fill: compare.a.color, stripes: [compare.a.color, compare.b.color] };
        if (inA) return { fill: compare.a.color };
        if (inB) return { fill: compare.b.color };
        return { fill: 'var(--land)', dim: true };
      }
      if (activeBloc) {
        const m = memberFor(activeBloc, iso);
        if (!m) return { fill: 'var(--land)', dim: true };
        if (m.status === 'member') return { fill: activeBloc.color };
        if (m.status === 'suspended' || m.status === 'frozen') return { fill: activeBloc.color, hatch: activeBloc.color };
        return { fill: `color-mix(in srgb, ${activeBloc.color} 45%, var(--land))` };
      }
      const n = Math.min(membershipCount.get(iso) ?? 0, OVERVIEW_STEPS.length - 1);
      return { fill: OVERVIEW_STEPS[n] ?? 'var(--land)' };
    },
    [mode, activeBloc, compare, maxIntensityByCountry, partyAbroadByCountry, layer, pair, theatre, backers],
  );

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    if (mode === 'conflicts') {
      for (const { conflict: c, intensity } of [...visible].sort((a, b) => INTENSITY_ORDER[a.intensity] - INTENSITY_ORDER[b.intensity])) {
        out.push({ id: c.id, lonLat: c.location, color: INTENSITY_COLOR[intensity], radius: INTENSITY_RADIUS[intensity], label: c.name, pulse: intensity === 'high' && viewMonth === null });
      }
    }
    if (layer === 'unrest') {
      for (const u of [...UNREST].sort((a, b) => INTENSITY_ORDER[a.intensity] - INTENSITY_ORDER[b.intensity])) {
        out.push({ id: UNREST_MARKER_PREFIX + u.id, lonLat: u.location, color: UNREST_COLOR[u.intensity], radius: UNREST_RADIUS[u.intensity], label: `${u.name}: ${UNREST_KIND_LABEL[u.kind]}, ${INTENSITY_LABEL[u.intensity].toLowerCase()}`, shape: 'triangle', pulse: u.intensity === 'high' });
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

  const selectedIsos = useMemo(() => (selection?.kind === 'country' ? [selection.iso] : selection?.kind === 'pair' ? [selection.a, ...(selection.b ? [selection.b] : [])] : []), [selection]);
  const selectedMarkerIds = useMemo(() => {
    if (selection?.kind === 'conflict') return [selection.id];
    if (selection?.kind === 'chokepoint') return [CHOKEPOINT_MARKER_PREFIX + selection.id];
    if (selection?.kind === 'unrest') return [UNREST_MARKER_PREFIX + selection.id];
    // The conflicts that link a pair carry the reticle too.
    if (selection?.kind === 'pair' && selection.b) return relationship(selection.a, selection.b).conflicts.map((l) => l.conflict.id);
    return [];
  }, [selection]);
  // Labels for the countries being fought over are placed before any other.
  const labelPriority = useMemo(() => (theatre ? [...theatre] : mode === 'conflicts' ? [...maxIntensityByCountry.keys()] : undefined), [theatre, mode, maxIntensityByCountry]);
  const focusNow = useMemo(() => focusForSelection(selection, { bloc, vs }), [selection, bloc, vs]);

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

  const selectUnrest = useCallback(
    (id: string) => {
      const u = UNREST_BY_ID.get(id);
      update({ layer: 'unrest', selection: { kind: 'unrest', id } });
      if (u) setFocus({ kind: 'point', lonLat: u.location, scale: 3.5 });
    },
    [update],
  );

  const onMarkerClick = useCallback(
    (id: string) => {
      if (id.startsWith(CHOKEPOINT_MARKER_PREFIX)) selectChokepoint(id.slice(CHOKEPOINT_MARKER_PREFIX.length));
      else if (id.startsWith(UNREST_MARKER_PREFIX)) selectUnrest(id.slice(UNREST_MARKER_PREFIX.length));
      else selectConflict(id);
    },
    [selectChokepoint, selectConflict, selectUnrest],
  );

  const selectPair = useCallback(
    (a: string, b: string | null) => {
      update({ selection: { kind: 'pair', a, b } });
      if (b) setFocus({ kind: 'isos', isos: [a, b] });
    },
    [update],
  );

  const selectBloc = useCallback(
    (id: string) => {
      update({ mode: 'blocs', bloc: id, vs: null, selection: { kind: 'bloc', id } });
      setFocus(blocFocus(id));
    },
    [update],
  );

  // While the relationship picker waits for a second country, a map click picks it.
  const pickingPair = selection?.kind === 'pair' && !selection.b ? selection.a : null;
  const onMapCountryClick = useCallback(
    (iso: string) => {
      if (pickingPair && iso !== pickingPair) selectPair(pickingPair, iso);
      else selectCountry(iso);
    },
    [pickingPair, selectPair, selectCountry],
  );

  const onPick = useCallback(
    (hit: SearchHit) => {
      if (hit.kind === 'country') selectCountry(hit.id);
      else if (hit.kind === 'bloc') selectBloc(hit.id);
      else if (hit.kind === 'unrest') selectUnrest(hit.id);
      else selectConflict(hit.id);
    },
    [selectCountry, selectBloc, selectConflict, selectUnrest],
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
    const onLayer = layerSummary(layer, hover.iso);
    if (onLayer) return onLayer;
    if (mode === 'conflicts') {
      const list = conflictsForCountry(hover.iso).sort((a, b) => INTENSITY_ORDER[b.intensity] - INTENSITY_ORDER[a.intensity]);
      return list.length ? list.map((c) => (isTheatre(c, hover.iso!) ? c.name : `${c.name} (abroad)`)).join(' · ') : null;
    }
    const list = blocsForCountry(hover.iso).filter((x) => x.membership.status === 'member');
    const territory = territoryLine(hover.iso, BLOCS);
    if (territory) return territory;
    return list.length ? list.map((x) => x.bloc.shortName).join(' · ') : 'No tracked bloc memberships';
  }, [hover, mode, layer]);

  // Briefing cycles the live high-intensity conflicts first, then whatever is starred.
  const briefItems = useMemo<BriefItem[]>(() => {
    const out: BriefItem[] = [];
    const seen = new Set<string>();
    for (const c of CONFLICTS) {
      if (c.history[0]?.intensity !== 'high') continue;
      seen.add('conflict:' + c.id);
      out.push({ id: c.id, kind: 'conflict', title: c.name, eyebrow: 'Live conflict', detail: c.history[0]?.status ?? '', color: INTENSITY_COLOR.high, conflict: c });
    }
    for (const w of watchlist.items) {
      const key = w.kind + ':' + w.id;
      if (seen.has(key)) continue;
      seen.add(key);
      if (w.kind === 'conflict') {
        const c = CONFLICT_BY_ID.get(w.id);
        if (c) out.push({ id: c.id, kind: 'conflict', title: c.name, eyebrow: 'Watchlist · conflict', detail: c.history[0]?.status ?? '', color: INTENSITY_COLOR[c.intensity], conflict: c });
      } else if (w.kind === 'country') {
        const country = COUNTRY_BY_ISO.get(w.id);
        const memberships = blocsForCountry(w.id).filter((x) => x.membership.status === 'member');
        const live = conflictsForCountry(w.id);
        if (country) out.push({ id: w.id, kind: 'country', title: country.name, eyebrow: 'Watchlist · country', detail: [memberships.length ? memberships.map((x) => x.bloc.shortName).join(' · ') : 'No tracked bloc memberships', live.length ? `${live.length} tracked conflict${live.length > 1 ? 's' : ''}` : null].filter(Boolean).join(' — '), color: 'var(--accent)' });
      } else if (w.kind === 'unrest') {
        const u = UNREST_BY_ID.get(w.id);
        if (u) out.push({ id: u.id, kind: 'unrest', title: u.name, eyebrow: `Watchlist · ${UNREST_KIND_LABEL[u.kind].toLowerCase()}`, detail: u.status, color: UNREST_COLOR[u.intensity], conflict: u });
      } else {
        const b = BLOC_BY_ID.get(w.id);
        if (b) out.push({ id: b.id, kind: 'bloc', title: b.name, eyebrow: 'Watchlist · bloc', detail: `${b.members.filter((m) => m.status === 'member').length} members · ${b.changes[0] ? `latest change ${b.changes[0].date}` : 'no dated changes'}`, color: b.color });
      }
    }
    return out;
  }, [watchlist.items]);

  const onBriefShow = useCallback(
    (item: BriefItem) => {
      if (item.kind === 'conflict') {
        update({ mode: 'conflicts', month: null, selection: null });
        if (item.conflict) setFocus({ kind: 'point', lonLat: item.conflict.location, scale: 3.5 });
      } else if (item.kind === 'country') {
        update({ selection: null });
        setFocus({ kind: 'country', iso: item.id });
      } else if (item.kind === 'unrest') {
        update({ layer: 'unrest', selection: null });
        if (item.conflict) setFocus({ kind: 'point', lonLat: item.conflict.location, scale: 3.5 });
      } else {
        update({ mode: 'blocs', bloc: item.id, vs: null, selection: null });
        setFocus(blocFocus(item.id));
      }
    },
    [update],
  );

  const onBriefOpen = useCallback(
    (item: BriefItem) => {
      if (item.kind === 'conflict') update({ brief: false, mode: 'conflicts', selection: { kind: 'conflict', id: item.id } });
      else if (item.kind === 'country') update({ brief: false, selection: { kind: 'country', iso: item.id } });
      else if (item.kind === 'unrest') update({ brief: false, layer: 'unrest', selection: { kind: 'unrest', id: item.id } });
      else update({ brief: false, mode: 'blocs', bloc: item.id, selection: { kind: 'bloc', id: item.id } });
    },
    [update],
  );

  const exitBrief = useCallback(() => update({ brief: false }), [update]);

  // One-tap PNG of the current map with the legend and a date stamp.
  const exportPng = useCallback(async () => {
    const root = stageRef.current;
    const svg = root?.querySelector<SVGSVGElement>('.map-root svg');
    if (!root || !svg || exporting) return;
    setExporting(true);
    try {
      const css = getComputedStyle(document.documentElement);
      const legend = readLegend(root);
      const title = legend.title ?? (mode === 'conflicts' ? `ATLAS · Conflicts${viewMonth ? ' · ' + formatMonth(viewMonth) : ''}` : activeBloc ? `ATLAS · ${activeBloc.name}` : 'ATLAS · Bloc overview');
      const today = new Date().toISOString().slice(0, 10);
      const blob = await renderPng({
        svg,
        background: css.getPropertyValue('--bg').trim() || '#04070d',
        foreground: css.getPropertyValue('--fg').trim() || '#d9f1ff',
        muted: css.getPropertyValue('--fg-muted').trim() || '#7fa3bd',
        title,
        legendTitle: legend.title,
        legend: legend.rows,
        stamp: `Data ${formatMonth(DATA_ASOF)} · exported ${formatDate(today)} · atlas-geopolitic.vercel.app`,
      });
      downloadBlob(blob, `atlas-${layer ?? mode}-${today}.png`);
    } finally {
      setExporting(false);
    }
  }, [exporting, mode, viewMonth, activeBloc, layer]);

  const conflictColor = useCallback((id: string) => {
    const c = CONFLICT_BY_ID.get(id);
    if (c) return INTENSITY_COLOR[c.intensity];
    const u = UNREST_BY_ID.get(id);
    return u ? UNREST_COLOR[u.intensity] : 'var(--fg-muted)';
  }, []);

  return (
    <div
      className="app"
      style={{ ['--map-inset-top' as string]: `${insets.top}px`, ['--sheet-h' as string]: `${insets.bottom}px` }}
      data-panel-open={panelOpen} data-mode={mode} data-layer={layer ?? undefined} data-view={view} data-brief={brief} data-embed={embed}>
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
        <MoreMenu
          items={[
            { label: 'Recent changes', pressed: selection?.kind === 'changes', onSelect: () => update({ selection: selection?.kind === 'changes' ? null : { kind: 'changes' } }) },
            { label: 'About ATLAS', pressed: selection?.kind === 'about', onSelect: () => update({ selection: selection?.kind === 'about' ? null : { kind: 'about' } }) },
          ]}
        />
        <ThemeToggle />
      </header>

      <main className="stage" ref={stageRef}>
        <SinceLastVisit onSelectConflict={selectConflict} onSelectBloc={selectBloc} onSelectUnrest={selectUnrest} onOpenChanges={() => update({ selection: { kind: 'changes' } })} />
        <ErrorBoundary>
          <Suspense fallback={<MapSkeleton />}>
            {view === 'globe' ? (
              <GlobeMap
                fillFor={fillFor}
                markers={markers}
                showMicrostates={mode === 'blocs'}
                selectedIsos={selectedIsos}
                selectedMarkerIds={selectedMarkerIds}
                focus={focus}
                insetTop={insets.top}
                insetRight={insets.right}
                insetBottom={insets.bottom}
                obstacles={obstacles}
                labelPriority={labelPriority}
                rotation={rotation}
                onRotate={(r) => update({ rotation: r })}
                onCountryClick={onMapCountryClick}
                onMarkerClick={onMarkerClick}
                onHover={onHover}
                zoomApiRef={zoomApi}
              />
            ) : (
              <WorldMap
                fillFor={fillFor}
                markers={markers}
                showMicrostates={mode === 'blocs'}
                selectedIsos={selectedIsos}
                selectedMarkerIds={selectedMarkerIds}
                focus={focus}
                insetTop={insets.top}
                insetRight={insets.right}
                insetBottom={insets.bottom}
                obstacles={obstacles}
                labelPriority={labelPriority}
                onCountryClick={onMapCountryClick}
                onMarkerClick={onMarkerClick}
                onHover={onHover}
                zoomApiRef={zoomApi}
              />
            )}
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
              setFocus(id ? blocFocus(id) : { kind: 'reset' });
            }}
            onVs={(id) => {
              update({ vs: id, selection: id ? { kind: 'compare' } : bloc ? { kind: 'bloc', id: bloc } : null });
              setFocus(blocFocus(bloc, id));
            }}
          />
        )}

        <LegendDock panelOpen={panelOpen}>
          <Legend mode={mode} bloc={bloc} vs={mode === 'blocs' ? vs : null} overviewSteps={OVERVIEW_STEPS} layer={layer} />
        </LegendDock>

        {mode === 'conflicts' && <Timeline months={TIMELINE_MONTHS} value={month} onChange={(m) => update({ month: m })} />}

        <div className="map-controls">
          <LayerMenu options={LAYER_OPTIONS} value={layer} onChange={(l) => update({ layer: l })} />
          {focusNow && (
            <button className="icon-btn recentre" aria-label="Recentre on selection" title="Recentre on selection" onClick={() => setFocus({ ...focusNow })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            </button>
          )}
          <button className="icon-btn" aria-label="Zoom in" onClick={() => zoomApi.current?.zoomIn()}>
            +
          </button>
          <button className="icon-btn" aria-label="Zoom out" onClick={() => zoomApi.current?.zoomOut()}>
            −
          </button>
          <button className="icon-btn" aria-label="Reset view" onClick={() => zoomApi.current?.reset()} title="Reset view">
            ⌂
          </button>
          <button
            className="icon-btn"
            aria-label={view === 'globe' ? 'Flat map' : 'Globe view'}
            aria-pressed={view === 'globe'}
            title={view === 'globe' ? 'Switch to the flat map' : 'Switch to the globe'}
            onClick={() => {
              update({ view: view === 'globe' ? 'flat' : 'globe' });
              // Keep the selection in view; with none, the globe opens at its saved rotation.
              setFocus(focusNow ? { ...focusNow } : null);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {view === 'globe' ? (
                <>
                  <rect x="3" y="5" width="18" height="14" rx="1" />
                  <path d="M3 12h18M9 5v14M15 5v14" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                </>
              )}
            </svg>
          </button>
          <button className="icon-btn" aria-label="Export PNG" title="Export the map as a PNG" data-busy={exporting} onClick={() => void exportPng()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3v12M7 10l5 5 5-5M4 17v3h16v-3" />
            </svg>
          </button>
          {!embed && (
            <button className="icon-btn" aria-label="Start briefing" title="Full-screen briefing" onClick={() => update({ brief: true, selection: null })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
            </button>
          )}
        </div>

        {embed && (
          <a className="embed-badge" href={serialize({ ...state, embed: false })} target="_blank" rel="noopener noreferrer" aria-label="Open this view in ATLAS">
            <Logo />
            ATLAS ↗
          </a>
        )}

        {brief && <Briefing items={briefItems} onShow={onBriefShow} onOpen={onBriefOpen} onExit={exitBrief} />}

        <Ticker onSelectConflict={selectConflict} onSelectBloc={selectBloc} onSelectUnrest={selectUnrest} />

        {hover && (
          <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
            <div>{hover.label}</div>
            {hoverDetail && <div className="sub">{hoverDetail}</div>}
          </div>
        )}

        {embed && selection && <EmbedCaption selection={selection} href={serialize({ ...state, embed: false })} />}

        {selection && !embed && (
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
                setFocus(blocFocus(id));
              }}
              onOpenChanges={() => update({ selection: { kind: 'changes' } })}
              onSelectChokepoint={selectChokepoint}
              onSelectUnrest={selectUnrest}
              onSelectPair={selectPair}
              layer={layer}
            />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
