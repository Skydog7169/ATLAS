import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BLOC_BY_ID } from '../data/blocs';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { COUNTRY_BY_ISO } from '../lib/countries';
import { CHOKEPOINT_BY_ID } from '../lib/chokepoints';
import { UNREST_BY_ID } from '../data/unrest';
import { timelineMonth } from '../lib/timeline';
import { isLayerAvailable } from '../lib/layerOptions';
import { DEFAULT_STATE, parseHash, serialize, type AppState, type DroppedId, type Selection } from '../lib/urlState';
import { historyMode, type HistoryMode } from '../lib/navHistory';

const validators = {
  bloc: (id: string) => BLOC_BY_ID.has(id),
  conflict: (id: string) => CONFLICT_BY_ID.has(id),
  country: (iso: string) => COUNTRY_BY_ISO.has(iso),
  chokepoint: (id: string) => CHOKEPOINT_BY_ID.has(id),
  unrest: (id: string) => UNREST_BY_ID.has(id),
  month: timelineMonth,
  layer: isLayerAvailable,
};

function read(): { state: AppState; dropped: DroppedId[] } {
  if (typeof window === 'undefined') return { state: DEFAULT_STATE, dropped: [] };
  return parseHash(window.location.hash, validators);
}

/** Position of the current entry among the ones this tab's ATLAS created; 0 when there's nothing of ours to go back to. */
function entryIndex(): number {
  const s = window.history.state as { atlas?: number } | null;
  return typeof s?.atlas === 'number' ? s.atlas : 0;
}

export interface UpdateOptions {
  /** Force a history entry ('push') or rewrite the current one ('replace'); by default navigation pushes and scrubbing replaces. */
  history?: HistoryMode['kind'];
}

/**
 * App state mirrored into the URL hash so every view is a shareable link.
 * Navigation (selection, mode, bloc, compare, layer, view, briefing) pushes a
 * history entry so Back steps back through it; rotation and the month scrub
 * rewrite the current entry, committing one entry per gesture.
 */
export function useAppState() {
  const [initial] = useState(read);
  const [state, setState] = useState<AppState>(initial.state);
  const [dropped, setDropped] = useState<DroppedId[]>(initial.dropped);
  /**
   * The latest state read from the URL: the landing hash (seq 0), then every
   * Back, Forward or hand-edited hash. The camera and the panel trail follow it.
   */
  const [arrival, setArrival] = useState<{ seq: number; selection: Selection }>({ seq: 0, selection: initial.state.selection });
  const fromHash = useRef(false);
  const pending = useRef<HistoryMode | null>(null);
  const prev = useRef(state);
  const lastWrite = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });

  useEffect(() => {
    // Tag the landing entry so Back-within-ATLAS can be told apart from leaving it.
    if (typeof window.history.state?.atlas !== 'number') window.history.replaceState({ ...window.history.state, atlas: 0 }, '');
    const onHash = () => {
      const next = read();
      fromHash.current = true;
      setState(next.state);
      setDropped(next.dropped);
      setArrival((a) => ({ seq: a.seq + 1, selection: next.state.selection }));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    const next = serialize(state);
    const forced = pending.current;
    pending.current = null;
    if (fromHash.current) {
      // The URL is already where we are; at most normalise it in place.
      fromHash.current = false;
      if (window.location.hash !== next) window.history.replaceState(window.history.state, '', next);
      return;
    }
    if (window.location.hash === next) return;
    const now = performance.now();
    const mode = forced ?? historyMode(before, state, lastWrite.current, now);
    lastWrite.current = { key: mode.key, at: now };
    if (mode.kind === 'push') window.history.pushState({ atlas: entryIndex() + 1 }, '', next);
    else window.history.replaceState(window.history.state, '', next);
  }, [state]);

  const update = useCallback((patch: Partial<AppState> | ((s: AppState) => Partial<AppState>), opts?: UpdateOptions) => {
    if (opts?.history) pending.current = { kind: opts.history, key: null };
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);

  /**
   * Step back one ATLAS entry, or apply `fallback` in place when the current
   * entry is the first one of ours. Returns true when it went through history
   * (the state then arrives with the hashchange).
   */
  const back = useCallback(
    (fallback: Partial<AppState>) => {
      if (entryIndex() > 0) {
        window.history.back();
        return true;
      }
      update(fallback, { history: 'replace' });
      return false;
    },
    [update],
  );

  const dismissDropped = useCallback(() => setDropped([]), []);

  return useMemo(() => ({ state, update, back, arrival, dropped, dismissDropped }), [state, update, back, arrival, dropped, dismissDropped]);
}
