import type { Conflict } from '../data/types';
import type { ChangeItem } from './history';

export type WatchKind = 'country' | 'bloc' | 'conflict';

export interface WatchItem {
  kind: WatchKind;
  id: string;
}

export const WATCHLIST_KEY = 'atlas.watchlist.v1';
export const WATCH_ONLY_KEY = 'atlas.watchlist.only.v1';

export function watchKey(item: WatchItem): string {
  return `${item.kind}:${item.id}`;
}

function isWatchItem(x: unknown): x is WatchItem {
  if (!x || typeof x !== 'object') return false;
  const { kind, id } = x as Record<string, unknown>;
  return (kind === 'country' || kind === 'bloc' || kind === 'conflict') && typeof id === 'string' && id.length > 0 && id.length < 64;
}

/**
 * Reads the stored watchlist. localStorage can be absent (SSR), blocked
 * (private windows, embedded frames) or hold junk, so every failure yields
 * an empty list rather than an exception.
 */
export function readWatchlist(storage: Pick<Storage, 'getItem'> | null = defaultStorage()): WatchItem[] {
  try {
    const raw = storage?.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: WatchItem[] = [];
    for (const x of parsed) {
      if (!isWatchItem(x)) continue;
      const key = watchKey(x);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: x.kind, id: x.id });
    }
    return out;
  } catch {
    return [];
  }
}

/** Persists the list; returns false when storage refused (quota, privacy mode). */
export function writeWatchlist(items: WatchItem[], storage: Pick<Storage, 'setItem'> | null = defaultStorage()): boolean {
  try {
    storage?.setItem(WATCHLIST_KEY, JSON.stringify(items));
    return storage !== null;
  } catch {
    return false;
  }
}

export function readWatchOnly(storage: Pick<Storage, 'getItem'> | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(WATCH_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeWatchOnly(only: boolean, storage: Pick<Storage, 'setItem'> | null = defaultStorage()): boolean {
  try {
    storage?.setItem(WATCH_ONLY_KEY, only ? '1' : '0');
    return storage !== null;
  } catch {
    return false;
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function toggleItem(items: WatchItem[], item: WatchItem): WatchItem[] {
  const key = watchKey(item);
  return items.some((x) => watchKey(x) === key) ? items.filter((x) => watchKey(x) !== key) : [...items, item];
}

export function hasItem(items: WatchItem[], item: WatchItem): boolean {
  const key = watchKey(item);
  return items.some((x) => watchKey(x) === key);
}

/**
 * Whether a feed item concerns something on the watchlist. A conflict
 * assessment matches a starred conflict or any starred country on its
 * territory; a membership change matches the starred bloc or the country
 * whose membership changed.
 */
export function matchesWatchlist(item: ChangeItem, keys: ReadonlySet<string>, conflictById: ReadonlyMap<string, Conflict>): boolean {
  if (keys.size === 0) return false;
  if (item.kind === 'conflict') {
    if (keys.has(`conflict:${item.id}`)) return true;
    const c = conflictById.get(item.id);
    return c ? c.countries.some((iso) => keys.has(`country:${iso}`)) : false;
  }
  if (keys.has(`bloc:${item.id}`)) return true;
  return Boolean(item.iso && keys.has(`country:${item.iso}`));
}

export function watchKeys(items: WatchItem[]): Set<string> {
  return new Set(items.map(watchKey));
}
