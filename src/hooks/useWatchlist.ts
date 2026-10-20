import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { WATCHLIST_KEY, WATCH_ONLY_KEY, hasItem, readWatchOnly, readWatchlist, toggleItem, watchKeys, writeWatchOnly, writeWatchlist, type WatchItem } from '../lib/watchlist';

/**
 * One in-memory copy of the watchlist shared by every component, seeded from
 * localStorage and written back on each change. A module-level store (rather
 * than context) keeps the star buttons, ticker and feed in sync without
 * threading props through the app. Other tabs' writes arrive as storage
 * events and are merged in, and each toggle applies to a fresh read, so two
 * open tabs no longer overwrite each other's stars.
 */
interface Store {
  items: WatchItem[];
  /** Whether the ticker and changes feed are filtered to the watchlist. */
  only: boolean;
  /** False once a write has failed (storage blocked or full): stars then last only as long as this tab. */
  persisted: boolean;
}

let store: Store = { items: readWatchlist(), only: readWatchOnly(), persisted: true };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return store;
}

export function setWatchlist(items: WatchItem[]) {
  const persisted = writeWatchlist(items);
  store = { ...store, items, persisted };
  emit();
}

/** Toggles one star against the latest stored list (when storage works), so a stale tab merges rather than clobbers. */
export function toggleWatch(item: WatchItem) {
  setWatchlist(toggleItem(store.persisted ? readWatchlist() : store.items, item));
}

export function setWatchOnly(only: boolean) {
  store = { ...store, only };
  writeWatchOnly(only);
  emit();
}

/** Re-reads storage; used by tests after they reset localStorage. */
export function reloadWatchlist() {
  store = { items: readWatchlist(), only: readWatchOnly(), persisted: true };
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === WATCHLIST_KEY || e.key === WATCH_ONLY_KEY) {
      store = { ...store, items: readWatchlist(), only: readWatchOnly() };
      emit();
    }
  });
}

export function useWatchlist() {
  const { items, only, persisted } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const keys = useMemo(() => watchKeys(items), [items]);
  const has = useCallback((item: WatchItem) => hasItem(items, item), [items]);
  /** Keys to filter by, or null when the filter is off. */
  const filter = only ? keys : null;
  return useMemo(() => ({ items, keys, only, filter, persisted, toggle: toggleWatch, has, setOnly: setWatchOnly }), [items, keys, only, filter, persisted, has]);
}
