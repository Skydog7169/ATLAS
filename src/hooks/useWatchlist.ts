import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { hasItem, readWatchOnly, readWatchlist, toggleItem, watchKeys, writeWatchOnly, writeWatchlist, type WatchItem } from '../lib/watchlist';

/**
 * One in-memory copy of the watchlist shared by every component, seeded from
 * localStorage and written back on each change. A module-level store (rather
 * than context) keeps the star buttons, ticker and feed in sync without
 * threading props through the app.
 */
interface Store {
  items: WatchItem[];
  /** Whether the ticker and changes feed are filtered to the watchlist. */
  only: boolean;
}

let store: Store = { items: readWatchlist(), only: readWatchOnly() };
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
  store = { ...store, items };
  writeWatchlist(items);
  emit();
}

export function setWatchOnly(only: boolean) {
  store = { ...store, only };
  writeWatchOnly(only);
  emit();
}

/** Re-reads storage; used by tests after they reset localStorage. */
export function reloadWatchlist() {
  store = { items: readWatchlist(), only: readWatchOnly() };
  emit();
}

export function useWatchlist() {
  const { items, only } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const keys = useMemo(() => watchKeys(items), [items]);
  const toggle = useCallback((item: WatchItem) => setWatchlist(toggleItem(store.items, item)), []);
  const has = useCallback((item: WatchItem) => hasItem(items, item), [items]);
  /** Keys to filter by, or null when the filter is off. */
  const filter = only ? keys : null;
  return useMemo(() => ({ items, keys, only, filter, toggle, has, setOnly: setWatchOnly }), [items, keys, only, filter, toggle, has]);
}
