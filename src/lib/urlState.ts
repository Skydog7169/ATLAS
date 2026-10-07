export type Mode = 'blocs' | 'conflicts';

export type Selection =
  | { kind: 'country'; iso: string }
  | { kind: 'bloc'; id: string }
  | { kind: 'conflict'; id: string }
  | null;

export interface AppState {
  mode: Mode;
  /** In blocs mode: the single bloc being highlighted, or null for the overview. */
  bloc: string | null;
  selection: Selection;
}

export const DEFAULT_STATE: AppState = { mode: 'blocs', bloc: null, selection: null };

/** Encodes state in the hash so links are shareable without a server. */
export function serialize(state: AppState): string {
  const p = new URLSearchParams();
  p.set('mode', state.mode);
  if (state.bloc) p.set('bloc', state.bloc);
  if (state.selection) {
    if (state.selection.kind === 'country') p.set('country', state.selection.iso);
    else p.set(state.selection.kind, state.selection.id);
  }
  return '#' + p.toString();
}

export function parse(hash: string, isValid: { bloc: (id: string) => boolean; conflict: (id: string) => boolean; country: (iso: string) => boolean }): AppState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const mode: Mode = p.get('mode') === 'conflicts' ? 'conflicts' : 'blocs';
  const blocParam = p.get('bloc');
  const bloc = blocParam && isValid.bloc(blocParam) ? blocParam : null;

  let selection: Selection = null;
  const country = p.get('country');
  const conflict = p.get('conflict');
  const selBloc = p.get('selbloc');
  if (country && isValid.country(country.toUpperCase())) selection = { kind: 'country', iso: country.toUpperCase() };
  else if (conflict && isValid.conflict(conflict)) selection = { kind: 'conflict', id: conflict };
  else if (selBloc && isValid.bloc(selBloc)) selection = { kind: 'bloc', id: selBloc };
  else if (bloc && !country && !conflict) selection = { kind: 'bloc', id: bloc };

  return { mode, bloc, selection };
}
