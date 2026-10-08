import type { ChangeItem } from './history';

export const LAST_VISIT_KEY = 'atlas.lastVisit.v1';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** ISO date (YYYY-MM-DD) the visitor last marked the feed as read, or null on a first visit or when storage is unavailable. */
export function readLastVisit(store: Pick<Storage, 'getItem'> | null = storage()): string | null {
  try {
    const v = store?.getItem(LAST_VISIT_KEY);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeLastVisit(date: string, store: Pick<Storage, 'setItem'> | null = storage()): boolean {
  try {
    store?.setItem(LAST_VISIT_KEY, date);
    return store !== null;
  } catch {
    return false;
  }
}

/** Items dated after the last visit. A first-time visitor has nothing "new" (they have seen nothing, so everything is background). */
export function changesSinceVisit(items: readonly ChangeItem[], lastVisit: string | null): ChangeItem[] {
  if (!lastVisit) return [];
  return items.filter((it) => it.date > lastVisit);
}
