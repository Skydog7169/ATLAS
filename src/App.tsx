import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { BLOCS, BLOC_BY_ID, blocsForCountry } from './data/blocs';
import { CONFLICTS, CONFLICT_BY_ID, INTENSITY_ORDER, conflictsForCountry } from './data/conflicts';
import type { Intensity } from './data/types';
import { useAppState } from './hooks/useAppState';
import { currentMonth, earliestMonth, entryAt, monthRange } from './lib/history';
import Timeline from './components/Timeline';
import { displacementFill, displacementSummary } from './lib/displacement';
import { sanctionsFill, sanctionsSummary } from './lib/sanctions';
import { electionColor, electionSummary } from './lib/elections';
import { nuclearFill, nuclearSummary } from './lib/nuclear';
import { acledColor, acledSummary, acledUnrestColor, acledUnrestSummary } from './lib/acled';
import { ucdpColor, ucdpSummary, ucdpYear } from './lib/ucdp';
import { UNREST, UNREST_BY_ID } from './data/unrest';
import { UNREST_COLOR, UNREST_MARKER_PREFIX, UNREST_RADIUS, UNREST_KIND_LABEL, unrestColor, unrestSummary } from './lib/unrest';
import { militaryColor, militarySummary } from './lib/military';
import { tradeFill, tradeSummary } from './lib/trade';
import { CHOKEPOINTS, CHOKEPOINT_BY_ID, CHOKEPOINT_COLOR, CHOKEPOINT_GLYPH, CHOKEPOINT_MARKER_PREFIX, CHOKEPOINT_STATUS_LABEL, currentStatus } from './lib/chokepoints';
import LayerMenu from './components/LayerMenu';
import { LAYER_OPTIONS } from './lib/layerOptions';
import { CONFLICT_TYPE_LABEL, INTENSITY_COLOR, INTENSITY_LABEL, INTENSITY_RADIUS, conflictFill } from './lib/labels';
import { resolveColor } from './lib/palette';
import { useSeen } from './hooks/useSeen';
import BlocChips from './components/BlocChips';
import { ErrorBoundary } from './components/ErrorBoundary';
import Legend from './components/Legend';
import Search, { type SearchHit } from './components/Search';
import ThemeToggle from './components/ThemeToggle';
import HeaderReadouts from './components/HeaderReadouts';
import ThisWeek from './components/ThisWeek';
import { PROMISE, PROMISE_SHORT, dataStamp } from './lib/frontdoor';
import Ticker from './components/Ticker';
import SinceLastVisit from './components/SinceLastVisit';
import { watchItemResolves } from './lib/feed';
import { ASK_ENABLED } from './components/AskPanel';
import { useWatchlist } from './hooks/useWatchlist';
import { formatDate, formatMonth } from './lib/labels';
import type { CountryFill, Focus, MapMarker } from './components/WorldMap';
import Briefing, { type BriefItem } from './components/Briefing';
import { COUNTRY_BY_ISO } from './lib/countries';
import { downloadBlob, readLegend, renderPng } from './lib/exportPng';
import { serialize, type AppState } from './lib/urlState';
import { focusForSelection, selectionLabel } from './lib/panelNav';
import { selectionKey } from './lib/navHistory';
import { usePanelTrail } from './hooks/usePanelTrail';
import { markAppReady } from './hooks/usePanelFocus';
import { useEscapeLayers } from './hooks/useEscapeLayers';
import StaleLinkNotice from './components/StaleLinkNotice';
import ModeToast from './components/ModeToast';
import { SEARCH_PREFILL_EVENT } from './components/Search';
import { lazyWithReload } from './lib/chunkReload';
import { titleFor } from './lib/docTitle';
import { daysSince } from './lib/edition';
import { useEdition } from './hooks/useEdition';
import { conflictFillMaps, isTheatre } from './lib/theatre';
import { memberFor, territoryLine } from './lib/sovereign';

// The map pulls in d3 and the 110m geometry; loading it after the shell
// paints keeps first render fast on phones.
// lazyWithReload reloads once if a deploy has replaced the chunk since this tab loaded.
const WorldMap = lazyWithReload(() => import('./components/WorldMap'));
const GlobeMap = lazyWithReload(() => import('./components/GlobeMap'));
// The dossier carries World Bank series, trade and the actor graph; first paint needs none of it.
const DetailPanel = lazyWithReload(() => import('./components/DetailPanel'));

// Fetch the chunks a session will likely need once the map is up, so a tab left
// open across a deploy already holds them.
function prefetchLater() {
  const run = () => {
    void import('./components/DetailPanel').catch(() => undefined);
    void import('./components/GlobeMap').catch(() => undefined);
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 8000 });
  else setTimeout(run, 4000);
}

const EARLIEST_MONTH = earliestMonth(CONFLICTS, []);

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

function PanelSkeleton() {
  return (
    <aside className="panel panel-loading" aria-busy="true" aria-label="Loading dossier">
      <div className="map-skeleton">
        <div>
          <div className="globe" />
          LOADING DOSSIER
        </div>
      </div>
    </aside>
  );
}

function panelKey(sel: NonNullable<AppState['selection']>): string {
  return sel.kind + ':' + ('id' in sel ? sel.id : 'iso' in sel ? sel.iso : sel.kind === 'pair' ? `${sel.a},${sel.b}` : '');
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
  const { state, update, back, arrival, dropped, dismissDropped } = useAppState();
  const { mode, bloc, vs, selection, month, layer, view, rotation, brief, embed } = state;
  const [exporting, setExporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<{ label: string; sub?: string; iso: string | null; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const zoomApi = useRef<{ zoomIn: () => void; zoomOut: () => void; reset: () => void } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [insetRight, setInsetRight] = useState(0);
  const watchlist = useWatchlist();
  const briefBtnRef = useRef<HTMLButtonElement>(null);
  const preBrief = useRef<Partial<AppState> | null>(null);
  const [toast, setToast] = useState<{ message: string; key: string; seq: number; prev: Partial<AppState> } | null>(null);
  const previousPanel = usePanelTrail(selection, arrival.seq);

  useEffect(() => markAppReady(), []);
  const edition = useEdition();
  const [mapError, setMapError] = useState<Error | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  // The panel renders from a deferred copy so the tap's own feedback (marker, chip, URL) paints first.
  const panelSelection = useDeferredValue(selection);

  // Replay covers conflict assessments only; bloc events go back years and would stretch the scrubber.
  // Recomputed per month so a tab left open rolls over at month end.
  const nowMonth = currentMonth();
  const timelineMonths = useMemo(() => monthRange(EARLIEST_MONTH, nowMonth), [nowMonth]);

  useEffect(() => {
    document.title = titleFor(state);
  }, [state]);

  useEffect(prefetchLater, []);

  // On wide screens the detail panel floats over the right edge; tell the map
  // so fly-to animations centre targets in the uncovered area.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 821px)');
    const apply = () => setInsetRight(mq.matches && selection ? 380 + 24 : 0);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [selection]);

  // The camera follows the URL: a shared link lands zoomed on its subject,
  // and Back/Forward (or an edited hash) fly to whatever the entry shows.
  // Arriving at an entry with no panel returns to the view before the fly-to.
  useEffect(() => {
    const target = focusForSelection(arrival.selection);
    if (target) setFocus(target);
    else if (arrival.seq > 0) setFocus({ kind: 'restore' });
  }, [arrival]);

  const activeBloc = bloc ? BLOC_BY_ID.get(bloc) : undefined;
  const vsBloc = vs ? BLOC_BY_ID.get(vs) : undefined;
  const compare = mode === 'blocs' && activeBloc && vsBloc ? { a: activeBloc, b: vsBloc } : null;

  const viewMonth = mode === 'conflicts' ? month : null;
  const visible = useMemo(() => conflictsAt(viewMonth), [viewMonth]);
  // Theatre states are filled; parties fighting only abroad get a dashed outline.
  const { home: maxIntensityByCountry, abroad: partyAbroadByCountry } = useMemo(() => conflictFillMaps(visible), [visible]);

  const fillFor = useCallback(
    (iso: string | null): CountryFill => {
      if (!iso) return { fill: 'var(--land-dim)' };
      if (layer === 'displacement') return displacementFill(iso);
      if (layer === 'sanctions') return sanctionsFill(iso);
      if (layer === 'elections') return { fill: electionColor(iso) };
      if (layer === 'nuclear') return nuclearFill(iso);
      if (layer === 'acled') return { fill: acledColor(iso) };
      if (layer === 'acled-unrest') return { fill: acledUnrestColor(iso) };
      if (layer === 'ucdp') return { fill: ucdpColor(iso) };
      if (layer === 'military') return { fill: militaryColor(iso) };
      if (layer === 'trade') return tradeFill(iso);
      if (layer === 'unrest') return { fill: unrestColor(iso) };
      if (mode === 'conflicts') {
        const intensity = maxIntensityByCountry.get(iso);
        if (!intensity) {
          const abroad = partyAbroadByCountry.get(iso);
          return abroad ? { fill: 'var(--land)', outline: INTENSITY_COLOR[abroad] } : { fill: 'var(--land)' };
        }
        return { fill: conflictFill(intensity) };
      }
      if (compare) {
        const inA = memberFor(compare.a, iso)?.status === 'member';
        const inB = memberFor(compare.b, iso)?.status === 'member';
        if (inA && inB) return { fill: compare.a.color, stripes: [compare.a.color, compare.b.color] };
        if (inA) return { fill: compare.a.color };
        // Bloc B is hatched so the comparison survives colour-vision deficiency, not just hue.
        if (inB) return { fill: compare.b.color, hatch: compare.b.color };
        return { fill: 'var(--land)', dim: true };
      }
      if (activeBloc) {
        const m = memberFor(activeBloc, iso);
        if (!m) return { fill: 'var(--land)', dim: true };
        if (m.status === 'member') return { fill: activeBloc.color };
        if (m.status === 'suspended' || m.status === 'frozen') return { fill: activeBloc.color, hatch: activeBloc.color };
        return { fill: `color-mix(in srgb, ${activeBloc.color} 45%, var(--land))` };
      }
      // No bloc picked: neutral land. A count of memberships among hand-picked blocs answers no question, so the chips are the call to action.
      return { fill: 'var(--land)' };
    },
    [mode, activeBloc, compare, maxIntensityByCountry, partyAbroadByCountry, layer],
  );

  // While a dossier, pair or conflict panel is open, the countries it is about stay at full strength and the rest recede.
  const focusIsos = useMemo<ReadonlySet<string> | null>(() => {
    if (selection?.kind === 'country') return new Set([selection.iso]);
    if (selection?.kind === 'pair') return new Set([selection.a, ...(selection.b ? [selection.b] : [])]);
    if (selection?.kind === 'conflict') {
      const c = CONFLICT_BY_ID.get(selection.id);
      return c ? new Set(c.countries) : null;
    }
    return null;
  }, [selection]);
  const fillWithFocus = useCallback(
    (iso: string | null): CountryFill => {
      const style = fillFor(iso);
      return focusIsos && (!iso || !focusIsos.has(iso)) ? { ...style, dim: true } : style;
    },
    [fillFor, focusIsos],
  );

  // Pulse rings only where they point at something: the selected conflict and what changed since the last visit.
  // Entities with an assessment the visitor has not seen (the same seen-set as the since-last-visit strip).
  const { unseen } = useSeen();
  const unseenIds = useMemo(() => new Set(unseen.map((it) => `${it.kind}:${it.id}`)), [unseen]);

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    if (mode === 'conflicts') {
      // Most intense first, so keyboard and screen-reader order reaches the wars before the flashpoints.
      for (const { conflict: c, intensity } of [...visible].sort((a, b) => INTENSITY_ORDER[b.intensity] - INTENSITY_ORDER[a.intensity])) {
        const changed = viewMonth === null && unseenIds.has(`conflict:${c.id}`);
        out.push({
          id: c.id,
          lonLat: c.location,
          color: INTENSITY_COLOR[intensity],
          radius: INTENSITY_RADIUS[intensity],
          label: `${c.name}: ${INTENSITY_LABEL[intensity].toLowerCase()}${viewMonth ? `, ${formatMonth(viewMonth)}` : ''}`,
          pulse: changed || (selection?.kind === 'conflict' && selection.id === c.id),
        });
      }
    }
    if (layer === 'unrest') {
      for (const u of [...UNREST].sort((a, b) => INTENSITY_ORDER[b.intensity] - INTENSITY_ORDER[a.intensity])) {
        const changed = unseenIds.has(`unrest:${u.id}`);
        out.push({ id: UNREST_MARKER_PREFIX + u.id, lonLat: u.location, color: UNREST_COLOR[u.intensity], radius: UNREST_RADIUS[u.intensity], label: `${u.name}: ${UNREST_KIND_LABEL[u.kind]}, ${INTENSITY_LABEL[u.intensity].toLowerCase()}`, shape: 'triangle', pulse: changed || (selection?.kind === 'unrest' && selection.id === u.id) });
      }
    }
    if (layer === 'chokepoints') {
      for (const cp of CHOKEPOINTS) {
        const st = currentStatus(cp).status;
        out.push({ id: CHOKEPOINT_MARKER_PREFIX + cp.id, lonLat: cp.location, color: CHOKEPOINT_COLOR[st], radius: 7, label: `${cp.name}: ${CHOKEPOINT_STATUS_LABEL[st]}`, shape: 'diamond', glyph: CHOKEPOINT_GLYPH[st] });
      }
    }
    // An unrest episode or chokepoint opened from a link keeps the user's layer; mark just that one.
    const u = selection?.kind === 'unrest' && layer !== 'unrest' ? UNREST_BY_ID.get(selection.id) : undefined;
    if (u) out.push({ id: UNREST_MARKER_PREFIX + u.id, lonLat: u.location, color: UNREST_COLOR[u.intensity], radius: UNREST_RADIUS[u.intensity], label: `${u.name}: ${UNREST_KIND_LABEL[u.kind]}, ${INTENSITY_LABEL[u.intensity].toLowerCase()}`, shape: 'triangle' });
    const cp = selection?.kind === 'chokepoint' && layer !== 'chokepoints' ? CHOKEPOINT_BY_ID.get(selection.id) : undefined;
    if (cp) {
      const st = currentStatus(cp).status;
      out.push({ id: CHOKEPOINT_MARKER_PREFIX + cp.id, lonLat: cp.location, color: CHOKEPOINT_COLOR[st], radius: 7, label: `${cp.name}: ${CHOKEPOINT_STATUS_LABEL[st]}`, shape: 'diamond' });
    }
    return out;
  }, [mode, visible, viewMonth, layer, unseenIds, selection]);

  const selectedIso = selection?.kind === 'country' ? selection.iso : null;
  const selectedMarkerId = selection?.kind === 'conflict' ? selection.id : selection?.kind === 'chokepoint' ? CHOKEPOINT_MARKER_PREFIX + selection.id : selection?.kind === 'unrest' ? UNREST_MARKER_PREFIX + selection.id : null;

  const selectCountry = useCallback(
    (iso: string) => {
      update({ selection: { kind: 'country', iso } });
      setFocus({ kind: 'country', iso });
    },
    [update],
  );

  // A link that has to switch the map mode says so, with Undo (one Back step).
  const noteModeSwitch = useCallback(
    (to: 'blocs' | 'conflicts', selection: AppState['selection']) => {
      if (mode === to) return;
      setToast({ message: to === 'conflicts' ? 'Switched to Conflicts to show this war' : 'Switched to Blocs to show this bloc', key: selectionKey(selection), seq: arrival.seq, prev: { mode, bloc, vs, layer, selection: state.selection } });
    },
    [mode, bloc, vs, layer, state.selection, arrival.seq],
  );

  const selectConflict = useCallback(
    (id: string) => {
      const c = CONFLICT_BY_ID.get(id);
      // An unknown id (a stale star, say) would leave the app thinking a panel is open with nothing in it.
      if (!c) return;
      const next = { kind: 'conflict', id } as const;
      noteModeSwitch('conflicts', next);
      update({ mode: 'conflicts', selection: next });
      setFocus({ kind: 'point', lonLat: c.location, scale: 3.5 });
    },
    [update, noteModeSwitch],
  );

  const selectChokepoint = useCallback(
    (id: string) => {
      const cp = CHOKEPOINT_BY_ID.get(id);
      // Keep whatever layer the user chose; the selected chokepoint is marked on its own.
      update((s) => ({ layer: s.layer ?? 'chokepoints', selection: { kind: 'chokepoint', id } }));
      if (cp) setFocus({ kind: 'point', lonLat: cp.location, scale: 3 });
    },
    [update],
  );

  const selectUnrest = useCallback(
    (id: string) => {
      const u = UNREST_BY_ID.get(id);
      if (!u) return;
      update((s) => ({ layer: s.layer ?? 'unrest', selection: { kind: 'unrest', id } }));
      setFocus({ kind: 'point', lonLat: u.location, scale: 3.5 });
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
      if (b) setFocus({ kind: 'reset' });
    },
    [update],
  );

  const selectBloc = useCallback(
    (id: string) => {
      const next = { kind: 'bloc', id } as const;
      noteModeSwitch('blocs', next);
      update({ mode: 'blocs', bloc: id, vs: null, selection: next });
      setFocus({ kind: 'reset' });
    },
    [update, noteModeSwitch],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const closePanel = useCallback(() => {
    update({ selection: null });
    setFocus({ kind: 'restore' });
  }, [update]);

  useEscapeLayers({ brief, picking, panelOpen: selection !== null, onCancelPicking: () => setPicking(false), onClosePanel: closePanel });

  const onPick = useCallback(
    (hit: SearchHit) => {
      if (hit.kind === 'country') selectCountry(hit.id);
      else if (hit.kind === 'bloc') selectBloc(hit.id);
      else if (hit.kind === 'unrest') selectUnrest(hit.id);
      else if (hit.kind === 'chokepoint') selectChokepoint(hit.id);
      else if (hit.kind === 'pair') selectPair(hit.a, hit.b);
      else if (hit.kind === 'layer') update({ layer: hit.id });
      else if (hit.kind === 'action') {
        if (hit.id === 'brief') update({ brief: true, selection: null });
        else if (hit.id === 'changes') update({ selection: { kind: 'changes' } });
        else if (hit.id === 'watchlist') update({ selection: { kind: 'watchlist' } });
        else {
          update((s) => ({ mode: 'blocs', bloc: s.bloc ?? 'nato', vs: null, selection: { kind: 'bloc', id: s.bloc ?? 'nato' } }));
          setPicking(true);
        }
      } else selectConflict(hit.id);
    },
    [selectCountry, selectBloc, selectConflict, selectUnrest, selectChokepoint, selectPair, update],
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
      return displacementSummary(hover.iso);
    }
    if (layer === 'sanctions') {
      const s = sanctionsSummary(hover.iso);
      return s ? `Sanctions: ${s}` : 'No country-level sanctions regime';
    }
    if (layer === 'elections') return electionSummary(hover.iso) ?? 'No election on record';
    if (layer === 'nuclear') return nuclearSummary(hover.iso) ?? 'No nuclear role recorded';
    if (layer === 'acled') return acledSummary(hover.iso) ?? 'No ACLED events in the window';
    if (layer === 'acled-unrest') return acledUnrestSummary(hover.iso) ?? 'No ACLED protests or riots in the window';
    if (layer === 'ucdp') return ucdpSummary(hover.iso) ?? (ucdpYear() ? `No organised-violence deaths recorded in ${ucdpYear()}` : 'No data: UCDP unavailable in this build');
    if (layer === 'military') return militarySummary(hover.iso) ?? 'No foreign military presence recorded';
    if (layer === 'trade') return tradeSummary(hover.iso) ?? 'No WITS export data';
    if (layer === 'unrest') return unrestSummary(hover.iso) ?? 'No tracked unrest';
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
      out.push({ id: c.id, kind: 'conflict', title: c.name, eyebrow: CONFLICT_TYPE_LABEL[c.type], detail: c.history[0]?.status ?? '', color: INTENSITY_COLOR.high, conflict: c });
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
      // Wall displays pick up a newer edition at the next slide; brief=1 survives in the hash.
      if (edition.newer) return window.location.reload();
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
        setFocus({ kind: 'reset' });
      }
    },
    [update, edition.newer],
  );

  const startBrief = useCallback(() => {
    preBrief.current = { mode, bloc, vs, selection, layer, month, view };
    update({ brief: true, selection: null });
  }, [update, mode, bloc, vs, selection, layer, month, view]);

  const onBriefOpen = useCallback(
    (item: BriefItem) => {
      if (item.kind === 'conflict') update({ brief: false, mode: 'conflicts', selection: { kind: 'conflict', id: item.id } });
      else if (item.kind === 'country') update({ brief: false, selection: { kind: 'country', iso: item.id } });
      else if (item.kind === 'unrest') update({ brief: false, layer: 'unrest', selection: { kind: 'unrest', id: item.id } });
      else update({ brief: false, mode: 'blocs', bloc: item.id, selection: { kind: 'bloc', id: item.id } });
    },
    [update],
  );

  // Opens About and scrolls to the disputed-territories block when asked from a dossier.
  const openAbout = useCallback(
    (anchor?: string) => {
      update({ selection: { kind: 'about' } });
      if (anchor) requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' })));
    },
    [update],
  );

  // Slides rewrite the briefing's own history entry, so stepping back restores
  // the view the presenter started from; a briefing opened by link has nothing
  // behind it, so the remembered state (if any) is applied in place.
  const exitBrief = useCallback(() => {
    const snapshot = preBrief.current;
    preBrief.current = null;
    if (!back({ brief: false, ...snapshot })) setFocus(focusForSelection(snapshot?.selection ?? null) ?? { kind: 'restore' });
  }, [back]);

  // Out of a briefing onto a plain map: return focus to the button that started it.
  const briefWas = useRef(brief);
  useEffect(() => {
    const exited = briefWas.current && !brief;
    briefWas.current = brief;
    if (exited && !selection) briefBtnRef.current?.focus({ preventScroll: true });
  }, [brief, selection]);

  // One-tap PNG of the current map with the legend and a date stamp.
  const exportPng = useCallback(async () => {
    const root = stageRef.current;
    const svg = root?.querySelector<SVGSVGElement>('.map-root svg');
    if (exporting) return;
    if (!root || !svg) return setExportError('Map unavailable: nothing to export.');
    setExporting(true);
    setExportError(null);
    try {
      const legend = readLegend(root);
      const title = legend.title ?? (mode === 'conflicts' ? `ATLAS · Conflicts${viewMonth ? ' · ' + formatMonth(viewMonth) : ''}` : activeBloc ? `ATLAS · ${activeBloc.name}` : 'ATLAS · Bloc overview');
      const today = new Date().toISOString().slice(0, 10);
      const blob = await renderPng({
        svg,
        // Tokens are light-dark() pairs, which a canvas cannot parse; resolve them to the active theme's colour.
        background: resolveColor('--bg', '#04070d'),
        foreground: resolveColor('--fg', '#d9f1ff'),
        muted: resolveColor('--fg-muted', '#7fa3bd'),
        title,
        legendTitle: legend.title,
        legend: legend.rows,
        stamp: `${dataStamp()} · exported ${formatDate(today)} · atlas-geopolitic.vercel.app`,
      });
      downloadBlob(blob, `atlas-${layer ?? mode}-${today}.png`);
    } catch {
      setExportError('Export failed. Try again or reload.');
    } finally {
      setExporting(false);
    }
  }, [exporting, mode, viewMonth, activeBloc, layer]);

  useEffect(() => {
    if (!exportError) return;
    const id = setTimeout(() => setExportError(null), 5000);
    return () => clearTimeout(id);
  }, [exportError]);

  const conflictColor = useCallback((id: string) => {
    const c = CONFLICT_BY_ID.get(id);
    if (c) return INTENSITY_COLOR[c.intensity];
    const u = UNREST_BY_ID.get(id);
    return u ? UNREST_COLOR[u.intensity] : 'var(--fg-muted)';
  }, []);

  return (
    <div className="app" data-panel-open={selection !== null} data-mode={mode} data-layer={layer ?? undefined} data-view={view} data-brief={brief} data-embed={embed} data-stale={edition.stale || undefined} data-map-error={mapError ? true : undefined}>
      <header className="header">
        <h1 className="sr-only">ATLAS geopolitical map</h1>
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); update({ selection: null, bloc: null }); setFocus({ kind: 'reset' }); }}>
          <Logo />
          <span>
            <span className="word">ATLAS</span>
            <span className="tag">
              <span className="long">{PROMISE}</span>
              <span className="short">{PROMISE_SHORT}</span>
            </span>
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
        <HeaderReadouts open={selection?.kind === 'changes'} onOpenChanges={(since) => update({ selection: selection?.kind === 'changes' ? null : { kind: 'changes', since } })}>
          {edition.newer && (
            <button className="readout-btn edition-chip" onClick={() => window.location.reload()} title={`A newer edition (${formatDate(edition.newer)}) has shipped. Reload to load it; your view is kept in the link.`}>
              NEW EDITION ↻
            </button>
          )}
        </HeaderReadouts>
        <Search onPick={onPick} conflictColor={conflictColor} mode={mode} watchlist={watchlist.items} />
        <button
          className="icon-btn"
          aria-label="Latest changes"
          aria-pressed={selection?.kind === 'changes'}
          title="Latest changes"
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
          data-count={watchlist.items.filter(watchItemResolves).length || undefined}
          data-unsaved={!watchlist.persisted || undefined}
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
        {!embed && !brief && <ThisWeek onSelectConflict={selectConflict} onSelectUnrest={selectUnrest} onOpenChanges={() => update({ selection: { kind: 'changes' } })} onOpenAbout={() => openAbout()} />}
        {dropped.length > 0 && !embed && (
          <StaleLinkNotice
            dropped={dropped}
            onDismiss={dismissDropped}
            onSearch={(q) => {
              dismissDropped();
              window.dispatchEvent(new CustomEvent(SEARCH_PREFILL_EVENT, { detail: q }));
            }}
          />
        )}
        {toast && toast.key === selectionKey(selection) && toast.seq === arrival.seq && (
          <ModeToast
            message={toast.message}
            onDismiss={dismissToast}
            onUndo={() => {
              setToast(null);
              back(toast.prev);
            }}
          />
        )}
        <SinceLastVisit onSelectConflict={selectConflict} onSelectBloc={selectBloc} onSelectUnrest={selectUnrest} onOpenChanges={() => update({ selection: { kind: 'changes', since: true } })} />
        {/* Keyed on the view so switching back to the flat map recovers from a failed globe. */}
        <ErrorBoundary key={view} variant="map" onError={setMapError} autoReloadMs={brief ? 5000 : undefined}>
          <Suspense fallback={<MapSkeleton />}>
            {view === 'globe' ? (
              <GlobeMap
                fillFor={fillWithFocus}
                markers={markers}
                showMicrostates={mode === 'blocs'}
                selectedIso={selectedIso}
                selectedMarkerId={selectedMarkerId}
                focus={focus}
                insetRight={insetRight}
                rotation={rotation}
                onRotate={(r) => update({ rotation: r })}
                onCountryClick={selectCountry}
                onMarkerClick={onMarkerClick}
                onHover={onHover}
                zoomApiRef={zoomApi}
              />
            ) : (
              <WorldMap
                fillFor={fillWithFocus}
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
              if (!id) setFocus({ kind: 'reset' });
            }}
            onVs={(id) => {
              update({ vs: id, selection: id ? { kind: 'compare' } : bloc ? { kind: 'bloc', id: bloc } : null });
              setFocus({ kind: 'reset' });
            }}
          />
        )}

        {!mapError && <Legend mode={mode} bloc={bloc} vs={mode === 'blocs' ? vs : null} layer={layer} />}

        {mode === 'conflicts' && !mapError && <Timeline months={timelineMonths} value={month} onChange={(m) => update({ month: m })} snapshot={edition.stale ? edition.newest : null} />}

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
          <button
            className="icon-btn"
            aria-label={view === 'globe' ? 'Flat map' : 'Globe view'}
            aria-pressed={view === 'globe'}
            title={view === 'globe' ? 'Switch to the flat map' : 'Switch to the globe'}
            onClick={() => {
              update({ view: view === 'globe' ? 'flat' : 'globe' });
              setFocus({ kind: 'reset' });
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
          <button className="icon-btn" aria-label="Export PNG" title={mapError ? 'Map unavailable' : 'Export the map as a PNG'} disabled={Boolean(mapError)} data-busy={exporting} onClick={() => void exportPng()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3v12M7 10l5 5 5-5M4 17v3h16v-3" />
            </svg>
          </button>
          {!embed && (
            <button className="icon-btn" aria-label="Start briefing" title="Full-screen briefing" ref={briefBtnRef} onClick={startBrief}>
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

        {exportError && (
          <div className="toast" role="status">
            {exportError}
          </div>
        )}

        {brief && <Briefing items={briefItems} onShow={onBriefShow} onOpen={onBriefOpen} onExit={exitBrief} asOf={`DATA AS OF ${formatDate(edition.newest).toUpperCase()} · ${daysSince(edition.newest) === 0 ? 'TODAY' : `${daysSince(edition.newest)}D AGO`}`} />}

        <Ticker onSelectConflict={selectConflict} onSelectBloc={selectBloc} onSelectUnrest={selectUnrest} />

        {hover && (
          <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
            <div>{hover.label}</div>
            {hoverDetail && <div className="sub">{hoverDetail}</div>}
          </div>
        )}

        {selection && (
          <ErrorBoundary variant="panel" resetKey={panelKey(selection)}>
            <Suspense fallback={<PanelSkeleton />}>
              {panelSelection ? (
                <DetailPanel
                  selection={panelSelection}
                  month={viewMonth}
                  compare={compare}
                  onStopCompare={() => update({ vs: null, selection: bloc ? { kind: 'bloc', id: bloc } : null })}
                  onClose={closePanel}
                  backTo={previousPanel ? { label: selectionLabel(previousPanel), onBack: () => window.history.back() } : null}
                  onSelectCountry={selectCountry}
                  onSelectBloc={selectBloc}
                  onSelectConflict={selectConflict}
                  onHighlightBloc={(id) => {
                    update({ mode: 'blocs', bloc: id });
                    setFocus({ kind: 'reset' });
                  }}
                  onOpenChanges={() => update({ selection: { kind: 'changes' } })}
                  onSelectChokepoint={selectChokepoint}
                  onSelectUnrest={selectUnrest}
                  onSelectPair={selectPair}
                  onOpenAbout={openAbout}
                />
              ) : (
                <PanelSkeleton />
              )}
            </Suspense>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
