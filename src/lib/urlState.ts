export type Mode = 'blocs' | 'conflicts';

export type Selection =
  | { kind: 'country'; iso: string }
  | { kind: 'bloc'; id: string }
  | { kind: 'conflict'; id: string }
  | { kind: 'changes' }
  | { kind: 'compare' }
  | { kind: 'about' }
  | { kind: 'watchlist' }
  | { kind: 'chokepoint'; id: string }
  | { kind: 'pair'; a: string; b: string | null }
  | { kind: 'ask' }
  | null;

export interface AppState {
  mode: Mode;
  /** In blocs mode: the single bloc being highlighted, or null for the overview. */
  bloc: string | null;
  /** In blocs mode: a second bloc to compare against `bloc`. */
  vs: string | null;
  selection: Selection;
  /** Conflicts mode: YYYY-MM being replayed, or null for the live view. */
  month: string | null;
  /** Optional data overlay drawn instead of the mode's fill. */
  layer: Layer;
  /** Flat Natural Earth map or an orthographic globe. */
  view: View;
  /** Globe centre as [longitude, latitude], whole degrees. */
  rotation: [number, number];
  /** Full-screen briefing mode: chrome hidden, items auto-cycling. */
  brief: boolean;
  /** Chrome-less view for iframes. */
  embed: boolean;
}

export type View = 'flat' | 'globe';
export const DEFAULT_ROTATION: [number, number] = [15, 20];

export const LAYERS = ['displacement', 'sanctions', 'elections', 'nuclear', 'acled', 'military', 'trade', 'chokepoints'] as const;
export type Layer = (typeof LAYERS)[number] | null;

export const DEFAULT_STATE: AppState = { mode: 'blocs', bloc: null, vs: null, selection: null, month: null, layer: null, view: 'flat', rotation: DEFAULT_ROTATION, brief: false, embed: false };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Encodes state in the hash so links are shareable without a server. */
export function serialize(state: AppState): string {
  const p = new URLSearchParams();
  p.set('mode', state.mode);
  if (state.bloc) p.set('bloc', state.bloc);
  if (state.bloc && state.vs) p.set('vs', state.vs);
  if (state.month) p.set('t', state.month);
  if (state.layer) p.set('layer', state.layer);
  if (state.view === 'globe') {
    p.set('view', 'globe');
    if (state.rotation[0] !== DEFAULT_ROTATION[0] || state.rotation[1] !== DEFAULT_ROTATION[1]) p.set('rot', `${state.rotation[0]},${state.rotation[1]}`);
  }
  if (state.brief) p.set('brief', '1');
  if (state.embed) p.set('embed', '1');
  if (state.selection) {
    if (state.selection.kind === 'country') p.set('country', state.selection.iso);
    else if (state.selection.kind === 'changes') p.set('changes', '1');
    else if (state.selection.kind === 'compare') p.set('compare', '1');
    else if (state.selection.kind === 'about') p.set('about', '1');
    else if (state.selection.kind === 'watchlist') p.set('watchlist', '1');
    else if (state.selection.kind === 'chokepoint') p.set('chokepoint', state.selection.id);
    else if (state.selection.kind === 'pair') p.set('pair', state.selection.b ? `${state.selection.a},${state.selection.b}` : state.selection.a);
    else if (state.selection.kind === 'ask') p.set('ask', '1');
    else p.set(state.selection.kind, state.selection.id);
  }
  return '#' + p.toString();
}

export function parse(hash: string, isValid: { bloc: (id: string) => boolean; conflict: (id: string) => boolean; country: (iso: string) => boolean; chokepoint?: (id: string) => boolean }): AppState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const mode: Mode = p.get('mode') === 'conflicts' ? 'conflicts' : 'blocs';
  const blocParam = p.get('bloc');
  const bloc = blocParam && isValid.bloc(blocParam) ? blocParam : null;
  const vsParam = p.get('vs');
  const vs = bloc && vsParam && vsParam !== bloc && isValid.bloc(vsParam) ? vsParam : null;

  const t = p.get('t');
  const month = t && MONTH.test(t) ? t : null;
  const layerParam = p.get('layer');
  const layer: Layer = (LAYERS as readonly string[]).includes(layerParam ?? '') ? (layerParam as Layer) : null;

  let selection: Selection = null;
  const country = p.get('country');
  const conflict = p.get('conflict');
  const selBloc = p.get('selbloc');
  const chokepoint = p.get('chokepoint');
  const pair = (p.get('pair') ?? '').toUpperCase().split(',').filter(Boolean);
  if (p.get('about') === '1') selection = { kind: 'about' };
  else if (p.get('ask') === '1') selection = { kind: 'ask' };
  else if (pair[0] && isValid.country(pair[0]) && (!pair[1] || (isValid.country(pair[1]) && pair[1] !== pair[0]))) selection = { kind: 'pair', a: pair[0], b: pair[1] ?? null };
  else if (chokepoint && isValid.chokepoint?.(chokepoint)) selection = { kind: 'chokepoint', id: chokepoint };
  else if (p.get('watchlist') === '1') selection = { kind: 'watchlist' };
  else if (p.get('changes') === '1') selection = { kind: 'changes' };
  else if (vs && p.get('compare') === '1') selection = { kind: 'compare' };
  else if (country && isValid.country(country.toUpperCase())) selection = { kind: 'country', iso: country.toUpperCase() };
  else if (conflict && isValid.conflict(conflict)) selection = { kind: 'conflict', id: conflict };
  else if (selBloc && isValid.bloc(selBloc)) selection = { kind: 'bloc', id: selBloc };
  else if (bloc && vs && !country && !conflict) selection = { kind: 'compare' };
  else if (bloc && !country && !conflict) selection = { kind: 'bloc', id: bloc };

  const view: View = p.get('view') === 'globe' ? 'globe' : 'flat';
  const rotation = parseRotation(p.get('rot'));
  return { mode, bloc, vs, selection, month, layer, view, rotation, brief: p.get('brief') === '1', embed: p.get('embed') === '1' };
}

export function parseRotation(raw: string | null): [number, number] {
  if (!raw) return DEFAULT_ROTATION;
  const [lon, lat] = raw.split(',').map(Number);
  if (lon === undefined || lat === undefined || !Number.isFinite(lon) || !Number.isFinite(lat)) return DEFAULT_ROTATION;
  return [Math.round(((((lon + 180) % 360) + 360) % 360) - 180), Math.round(Math.max(-89, Math.min(89, lat)))];
}
