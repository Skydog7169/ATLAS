import { BLOC_BY_ID } from '../data/blocs';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { UNREST_BY_ID } from '../data/unrest';
import { CHOKEPOINT_BY_ID } from './chokepoints';
import { countryName } from './countries';
import { formatMonth } from './labels';
import { DEFAULT_STATE, serialize, type AppState, type Layer } from './urlState';

/** One piece of what the map is showing, with the patch that removes just that piece. */
export interface MapStateSegment {
  key: 'mode' | 'bloc' | 'vs' | 'layer' | 'month' | 'focus' | 'view';
  label: string;
  /** Absent for the mode, which can be switched but not cleared. */
  clear?: Partial<AppState>;
  /** Accessible name for the clear button. */
  clearLabel?: string;
}

/** The thing the panel is about, when it is something on the map. */
function focusName(s: AppState['selection']): string | null {
  if (!s) return null;
  switch (s.kind) {
    case 'country':
      return countryName(s.iso);
    case 'conflict':
      return CONFLICT_BY_ID.get(s.id)?.name ?? null;
    case 'chokepoint':
      return CHOKEPOINT_BY_ID.get(s.id)?.name ?? null;
    case 'unrest':
      return UNREST_BY_ID.get(s.id)?.name ?? null;
    case 'pair':
      return s.b ? `${countryName(s.a)} ↔ ${countryName(s.b)}` : countryName(s.a);
    default:
      // Bloc and compare panels are already named by their segments; the rest are not map state.
      return null;
  }
}

/**
 * Everything that decides the map's colours and framing, left to right:
 * mode › bloc › compare › overlay › replay month › focus › globe. A layer
 * replaces the bloc fill, so bloc segments are marked as hidden under it.
 */
export function mapStateSegments(state: AppState, layerLabel: (l: Exclude<Layer, null>) => string): MapStateSegment[] {
  const out: MapStateSegment[] = [{ key: 'mode', label: state.mode === 'conflicts' ? 'Conflicts' : 'Blocs' }];
  const hidden = state.layer ? ' (hidden)' : '';
  if (state.mode === 'blocs' && state.bloc) {
    const name = BLOC_BY_ID.get(state.bloc)?.shortName ?? state.bloc;
    out.push({ key: 'bloc', label: `Bloc: ${name}${hidden}`, clear: { bloc: null, vs: null, selection: state.selection?.kind === 'bloc' || state.selection?.kind === 'compare' ? null : state.selection }, clearLabel: `Clear bloc ${name}` });
    if (state.vs) {
      const vs = BLOC_BY_ID.get(state.vs)?.shortName ?? state.vs;
      out.push({ key: 'vs', label: `vs ${vs}${hidden}`, clear: { vs: null, selection: state.selection?.kind === 'compare' ? { kind: 'bloc', id: state.bloc } : state.selection }, clearLabel: `Stop comparing with ${vs}` });
    }
  }
  if (state.layer) {
    const name = layerLabel(state.layer);
    out.push({ key: 'layer', label: `Overlay: ${name}`, clear: { layer: null }, clearLabel: `Clear ${name} overlay` });
  }
  if (state.mode === 'conflicts' && state.month) {
    out.push({ key: 'month', label: `Replay ${formatMonth(state.month)}`, clear: { month: null }, clearLabel: 'Return to live' });
  }
  const focus = focusName(state.selection);
  if (focus) out.push({ key: 'focus', label: `Focus: ${focus}`, clear: { selection: null }, clearLabel: `Clear focus: ${focus}` });
  if (state.view === 'globe') out.push({ key: 'view', label: 'Globe', clear: { view: 'flat' }, clearLabel: 'Leave globe view' });
  return out;
}

/** The default map, keeping only how it is drawn (flat or globe) and whether it is embedded. */
export function resetState(state: AppState): AppState {
  return { ...DEFAULT_STATE, view: state.view, rotation: state.rotation, embed: state.embed };
}

/** True when nothing but the view and embed flag differs from the default map. */
export function isDefaultMap(state: AppState): boolean {
  return serialize(resetState(state)) === serialize({ ...state, brief: false });
}

/** A data layer repaints every country, so bloc chips can't be showing their bloc. */
export function blocsSuppressed(state: Pick<AppState, 'mode' | 'layer'>): boolean {
  return state.mode === 'blocs' && state.layer !== null;
}

/** The full-app link for a state, independent of the hash the page happens to have. */
export function shareUrl(state: AppState, origin: string, pathname = '/'): string {
  return origin + pathname + serialize({ ...state, embed: false, brief: false });
}

/** A paste-ready iframe for the map-only (embed) version of a state. */
export function embedCode(state: AppState, origin: string, pathname = '/'): string {
  const src = origin + pathname + serialize({ ...state, embed: true, brief: false });
  return `<iframe src="${src.replace(/&/g, '&amp;')}" width="100%" height="480" title="ATLAS map" loading="lazy" style="border:0"></iframe>`;
}
