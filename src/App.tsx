import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BLOCS, BLOC_BY_ID, blocsForCountry } from './data/blocs';
import { CONFLICTS, CONFLICT_BY_ID, INTENSITY_ORDER, conflictsForCountry } from './data/conflicts';
import type { Intensity } from './data/types';
import { useAppState } from './hooks/useAppState';
import { replayAt } from './lib/history';
import { ASSESSED_MONTHS, TIMELINE_MONTHS } from './lib/timeline';
import Timeline from './components/Timeline';
import { DISPLACEMENT_BY_ISO, displacementColor, formatPeople } from './lib/displacement';
import { sanctionsColor, sanctionsSummary } from './lib/sanctions';
import { electionColor, electionSummary } from './lib/elections';
import { nuclearColor, nuclearSummary } from './lib/nuclear';
import { ACLED, acledColor, acledSummary, acledUnrestColor, acledUnrestSummary } from './lib/acled';
import { UCDP, ucdpColor, ucdpSummary, ucdpYear } from './lib/ucdp';
import { UNREST, UNREST_BY_ID } from './data/unrest';
import { UNREST_COLOR, UNREST_MARKER_PREFIX, UNREST_RADIUS, UNREST_KIND_LABEL, unrestColor, unrestSummary } from './lib/unrest';
import { militaryColor, militarySummary } from './lib/military';
import { tradeColor, tradeSummary } from './lib/trade';
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
import { formatMonth } from './lib/labels';
import type { CountryFill, Focus, MapMarker } from './components/WorldMap';
import Briefing, { type BriefItem } from './components/Briefing';
import { COUNTRY_BY_ISO } from './lib/countries';
import { downloadBlob, exportMeta, readLegend, renderPng } from './lib/exportPng';
import { serialize } from './lib/urlState';
import { EmbedContext, type EmbedContextValue } from './lib/embedContext';
import { useGestureHint } from './hooks/useGestureHint';
import { useReplayNotice } from './hooks/useReplayNotice';
import ReplayBanner from './components/ReplayBanner';
import EmbedBadge from './components/EmbedBadge';
import EmbedDialog from './components/EmbedDialog';
import GestureHint from './components/GestureHint';

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

/**
 * Conflicts with the assessment in force for the view month (live = newest).
 * In replay, `stale` marks an assessment carried forward from an earlier month.
 */
function conflictsAt(month: string | null): Array<{ conflict: (typeof CONFLICTS)[number]; intensity: Intensity; stale: boolean }> {
  const out: Array<{ conflict: (typeof CONFLICTS)[number]; intensity: Intensity; stale: boolean }> = [];
  for (const c of CONFLICTS) {
    if (!month) {
      const entry = c.history[0];
      if (entry) out.push({ conflict: c, intensity: entry.intensity, stale: false });
      continue;
    }
    const r = replayAt(c, month);
    if (r.entry) out.push({ conflict: c, intensity: r.entry.intensity, stale: !r.fresh });
  }
  return out;
}

/** Replay: conflicts already under way at `month` but with no assessment yet, drawn as outlines rather than left out. */
function untrackedAt(month: string | null): Array<(typeof CONFLICTS)[number]> {
  return month ? CONFLICTS.filter((c) => replayAt(c, month).untracked) : [];
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
  const { mode, bloc, vs, selection, month, layer, view, rotation, brief, embed, embedOpts } = state;
  const [gestureHint, showGestureHint] = useGestureHint();
  const [replayNotice, dismissReplayNotice] = useReplayNotice();
  const [embedding, setEmbedding] = useState(false);
  const [exporting, setExporting] = useState(false);
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
  const untracked = useMemo(() => untrackedAt(viewMonth), [viewMonth]);
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
      if (layer === 'acled-unrest') return { fill: acledUnrestColor(iso) };
      if (layer === 'ucdp') return { fill: ucdpColor(iso) };
      if (layer === 'military') return { fill: militaryColor(iso) };
      if (layer === 'trade') return { fill: tradeColor(iso) };
      if (layer === 'unrest') return { fill: unrestColor(iso) };
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
      for (const c of untracked) {
        out.push({ id: c.id, lonLat: c.location, color: 'var(--fg-muted)', radius: INTENSITY_RADIUS.latent, label: `${c.name}: not yet tracked in ${formatMonth(viewMonth ?? '')}`, ghost: true });
      }
      for (const { conflict: c, intensity, stale } of [...visible].sort((a, b) => INTENSITY_ORDER[a.intensity] - INTENSITY_ORDER[b.intensity])) {
        const label = stale && viewMonth ? `${c.name}: ${INTENSITY_LABEL[intensity].toLowerCase()} at the last assessment, none on record for ${formatMonth(viewMonth)}` : c.name;
        out.push({ id: c.id, lonLat: c.location, color: INTENSITY_COLOR[intensity], radius: INTENSITY_RADIUS[intensity], label, pulse: intensity === 'high' && viewMonth === null, stale });
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
  }, [mode, visible, untracked, viewMonth, layer]);

  const selectedIso = selection?.kind === 'country' ? selection.iso : null;
  const selectedMarkerId = selection?.kind === 'conflict' ? selection.id : selection?.kind === 'chokepoint' ? CHOKEPOINT_MARKER_PREFIX + selection.id : selection?.kind === 'unrest' ? UNREST_MARKER_PREFIX + selection.id : null;

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
    if (layer === 'acled-unrest') return acledUnrestSummary(hover.iso) ?? 'No ACLED protests or riots in the window';
    if (layer === 'ucdp') return ucdpSummary(hover.iso) ?? `No organised-violence deaths recorded in ${ucdpYear()}`;
    if (layer === 'military') return militarySummary(hover.iso) ?? 'No foreign military presence recorded';
    if (layer === 'trade') return tradeSummary(hover.iso) ?? 'No WITS export data';
    if (layer === 'unrest') return unrestSummary(hover.iso) ?? 'No tracked unrest';
    if (mode === 'conflicts') {
      const list = conflictsForCountry(hover.iso).sort((a, b) => INTENSITY_ORDER[b.intensity] - INTENSITY_ORDER[a.intensity]);
      return list.length ? list.map((c) => c.name).join(' · ') : null;
    }
    const list = blocsForCountry(hover.iso).filter((x) => x.membership.status === 'member');
    return list.length ? list.map((x) => x.bloc.shortName).join(' · ') : 'No tracked bloc memberships';
  }, [hover, mode, layer]);

  // Briefing cycles the live high-intensity conflicts first, then whatever is starred.
  const briefItems = useMemo<BriefItem[]>(() => {
    const out: BriefItem[] = [];
    const seen = new Set<string>();
    for (const c of CONFLICTS) {
      if (c.history[0]?.intensity !== 'high') continue;
      seen.add('conflict:' + c.id);
      out.push({ id: c.id, kind: 'conflict', title: c.name, eyebrow: 'High intensity', detail: c.history[0]?.status ?? '', color: INTENSITY_COLOR.high, conflict: c });
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
        setFocus({ kind: 'reset' });
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
      const today = new Date().toISOString().slice(0, 10);
      const meta = exportMeta({
        mode,
        layer,
        layerLabel: LAYER_OPTIONS.find((o) => o.id === layer)?.label ?? null,
        month: viewMonth,
        bloc: activeBloc?.shortName ?? null,
        vs: mode === 'blocs' && activeBloc ? (vsBloc?.shortName ?? null) : null,
        dataAsof: DATA_ASOF,
        today,
      });
      const blob = await renderPng({
        svg,
        background: css.getPropertyValue('--bg').trim() || '#04070d',
        foreground: css.getPropertyValue('--fg').trim() || '#d9f1ff',
        muted: css.getPropertyValue('--fg-muted').trim() || '#7fa3bd',
        title: meta.title,
        legendTitle: legend.title,
        legend: legend.rows,
        stamp: meta.stamp,
      });
      downloadBlob(blob, meta.filename);
    } finally {
      setExporting(false);
    }
  }, [exporting, mode, viewMonth, activeBloc, vsBloc, layer]);

  // Embeds may pin a theme for the host page; the full app keeps the reader's toggle.
  useEffect(() => {
    if (!embed || embedOpts.theme === 'auto') return;
    document.documentElement.setAttribute('data-theme', embedOpts.theme);
  }, [embed, embedOpts.theme]);

  const embedContext = useMemo<EmbedContextValue>(
    () => ({
      shareUrl: () => new URL(serialize({ ...state, embed: false }), window.location.href).href,
      onEmbed: embed ? undefined : () => setEmbedding(true),
    }),
    [embed, state],
  );

  // What the current view shows, for the embed iframe's accessible title.
  const viewTitle = useMemo(() => {
    if (selection?.kind === 'conflict') return CONFLICT_BY_ID.get(selection.id)?.name ?? 'Conflicts';
    if (selection?.kind === 'country') return COUNTRY_BY_ISO.get(selection.iso)?.name ?? 'Country';
    if (selection?.kind === 'unrest') return UNREST_BY_ID.get(selection.id)?.name ?? 'Civil unrest';
    if (selection?.kind === 'chokepoint') return CHOKEPOINT_BY_ID.get(selection.id)?.name ?? 'Chokepoints';
    const layerLabel = LAYER_OPTIONS.find((o) => o.id === layer)?.label;
    if (layerLabel) return layerLabel;
    if (mode === 'conflicts') return 'Conflict intensity';
    if (compare) return `${compare.a.shortName} vs ${compare.b.shortName}`;
    return activeBloc?.name ?? 'Bloc memberships';
  }, [selection, layer, mode, compare, activeBloc]);

  const openHref = serialize({ ...state, embed: false });

  const conflictColor = useCallback((id: string) => {
    const c = CONFLICT_BY_ID.get(id);
    if (c) return INTENSITY_COLOR[c.intensity];
    const u = UNREST_BY_ID.get(id);
    return u ? UNREST_COLOR[u.intensity] : 'var(--fg-muted)';
  }, []);

  return (
    <EmbedContext.Provider value={embedContext}>
    <div className="app" data-panel-open={selection !== null} data-mode={mode} data-layer={layer ?? undefined} data-view={view} data-brief={brief} data-embed={embed} data-interactive={embed ? embedOpts.interactive : undefined} data-replay={viewMonth !== null}>
      <header className="header">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); update({ selection: null, bloc: null, month: null }); setFocus({ kind: 'reset' }); }}>
          <Logo />
          <span>
            <span className="word">ATLAS</span>
            <span className="tag">GEOPOLITICAL AWARENESS</span>
          </span>
        </a>
        <div className="segmented" role="group" aria-label="Map mode">
          <button aria-pressed={mode === 'blocs'} onClick={() => update({ mode: 'blocs', month: null, selection: selection?.kind === 'conflict' ? null : selection })}>
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
        {/* First in DOM order so the first Tab into an embed announces what it is and when it is from. */}
        {embed && <EmbedBadge href={openHref} logo={<Logo />} month={viewMonth} dataAsof={DATA_ASOF} />}
        <SinceLastVisit onSelectConflict={selectConflict} onSelectBloc={selectBloc} onSelectUnrest={selectUnrest} onOpenChanges={() => update({ selection: { kind: 'changes' } })} />
        <ErrorBoundary>
          <Suspense fallback={<MapSkeleton />}>
            {view === 'globe' ? (
              <GlobeMap
                fillFor={fillFor}
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
                gestures={!embed ? 'all' : embedOpts.interactive ? 'cooperative' : 'none'}
                onGestureBlocked={showGestureHint}
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

        {!(embed && embedOpts.legend === 'off') && <Legend mode={mode} bloc={bloc} vs={mode === 'blocs' ? vs : null} overviewSteps={OVERVIEW_STEPS} layer={layer} month={viewMonth} embed={embed} />}

        {mode === 'conflicts' && <Timeline months={TIMELINE_MONTHS} assessed={ASSESSED_MONTHS} value={month} onChange={(m) => update({ month: m })} />}

        {!embed && !brief && <ReplayBanner month={viewMonth} notice={mode === 'conflicts' ? replayNotice : null} onLive={() => update({ month: null })} onDismissNotice={dismissReplayNotice} />}

        <GestureHint kind={gestureHint} />

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
          <button className="icon-btn" aria-label="Export PNG" title="Export the map as a PNG" data-busy={exporting} onClick={() => void exportPng()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3v12M7 10l5 5 5-5M4 17v3h16v-3" />
            </svg>
          </button>
          {!embed && (
            <button className="icon-btn" aria-label="Embed this view" title="Embed this view in another site" onClick={() => setEmbedding(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
              </svg>
            </button>
          )}
          {!embed && (
            <button className="icon-btn" aria-label="Start briefing" title="Full-screen briefing" onClick={() => update({ brief: true, selection: null })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
            </button>
          )}
        </div>


        {brief && <Briefing items={briefItems} onShow={onBriefShow} onOpen={onBriefOpen} onExit={exitBrief} />}

        <Ticker onSelectConflict={selectConflict} onSelectBloc={selectBloc} onSelectUnrest={selectUnrest} />

        {hover && (
          <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
            <div>{hover.label}</div>
            {hoverDetail && <div className="sub">{hoverDetail}</div>}
          </div>
        )}

        {embedding && <EmbedDialog state={state} title={viewTitle} onClose={() => setEmbedding(false)} />}

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
              onSelectUnrest={selectUnrest}
              onSelectPair={selectPair}
            />
          </ErrorBoundary>
        )}
      </main>
    </div>
    </EmbedContext.Provider>
  );
}
