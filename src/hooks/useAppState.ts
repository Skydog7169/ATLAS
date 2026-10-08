import { useCallback, useEffect, useMemo, useState } from 'react';
import { BLOC_BY_ID } from '../data/blocs';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { COUNTRY_BY_ISO } from '../lib/countries';
import { CHOKEPOINT_BY_ID } from '../lib/chokepoints';
import { DEFAULT_STATE, parse, serialize, type AppState } from '../lib/urlState';

const validators = {
  bloc: (id: string) => BLOC_BY_ID.has(id),
  conflict: (id: string) => CONFLICT_BY_ID.has(id),
  country: (iso: string) => COUNTRY_BY_ISO.has(iso),
  chokepoint: (id: string) => CHOKEPOINT_BY_ID.has(id),
};

function read(): AppState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  return parse(window.location.hash, validators);
}

/** App state mirrored into the URL hash so every view is a shareable link. */
export function useAppState() {
  const [state, setState] = useState<AppState>(read);

  useEffect(() => {
    const onHash = () => setState(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const next = serialize(state);
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [state]);

  const update = useCallback((patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);

  return useMemo(() => ({ state, update }), [state, update]);
}
