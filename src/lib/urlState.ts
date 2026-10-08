export type Mode = 'blocs' | 'conflicts';

export type Selection =
  | { kind: 'country'; iso: string }
  | { kind: 'bloc'; id: string }
  | { kind: 'conflict'; id: string }
  | { kind: 'changes' }
  | { kind: 'compare' }
  | { kind: 'about' }
  | { kind: 'watchlist' }
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
}

export type Layer = 'displacement' | null;

export const DEFAULT_STATE: AppState = { mode: 'blocs', bloc: null, vs: null, selection: null, month: null, layer: null };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Encodes state in the hash so links are shareable without a server. */
export function serialize(state: AppState): string {
  const p = new URLSearchParams();
  p.set('mode', state.mode);
  if (state.bloc) p.set('bloc', state.bloc);
  if (state.bloc && state.vs) p.set('vs', state.vs);
  if (state.month) p.set('t', state.month);
  if (state.layer) p.set('layer', state.layer);
  if (state.selection) {
    if (state.selection.kind === 'country') p.set('country', state.selection.iso);
    else if (state.selection.kind === 'changes') p.set('changes', '1');
    else if (state.selection.kind === 'compare') p.set('compare', '1');
    else if (state.selection.kind === 'about') p.set('about', '1');
    else if (state.selection.kind === 'watchlist') p.set('watchlist', '1');
    else p.set(state.selection.kind, state.selection.id);
  }
  return '#' + p.toString();
}

export function parse(hash: string, isValid: { bloc: (id: string) => boolean; conflict: (id: string) => boolean; country: (iso: string) => boolean }): AppState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const mode: Mode = p.get('mode') === 'conflicts' ? 'conflicts' : 'blocs';
  const blocParam = p.get('bloc');
  const bloc = blocParam && isValid.bloc(blocParam) ? blocParam : null;
  const vsParam = p.get('vs');
  const vs = bloc && vsParam && vsParam !== bloc && isValid.bloc(vsParam) ? vsParam : null;

  const t = p.get('t');
  const month = t && MONTH.test(t) ? t : null;
  const layer: Layer = p.get('layer') === 'displacement' ? 'displacement' : null;

  let selection: Selection = null;
  const country = p.get('country');
  const conflict = p.get('conflict');
  const selBloc = p.get('selbloc');
  if (p.get('about') === '1') selection = { kind: 'about' };
  else if (p.get('watchlist') === '1') selection = { kind: 'watchlist' };
  else if (p.get('changes') === '1') selection = { kind: 'changes' };
  else if (vs && p.get('compare') === '1') selection = { kind: 'compare' };
  else if (country && isValid.country(country.toUpperCase())) selection = { kind: 'country', iso: country.toUpperCase() };
  else if (conflict && isValid.conflict(conflict)) selection = { kind: 'conflict', id: conflict };
  else if (selBloc && isValid.bloc(selBloc)) selection = { kind: 'bloc', id: selBloc };
  else if (bloc && vs && !country && !conflict) selection = { kind: 'compare' };
  else if (bloc && !country && !conflict) selection = { kind: 'bloc', id: bloc };

  return { mode, bloc, vs, selection, month, layer };
}
