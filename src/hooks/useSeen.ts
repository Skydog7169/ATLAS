import { useMemo, useSyncExternalStore } from 'react';
import { CHANGES } from '../lib/feed';
import { VISIT_KEY, loadVisit, markAllRead, unseenItems, type Visit } from '../lib/lastVisit';

/**
 * The visitor's seen-set, shared by the since-last-visit strip, the changes
 * panel, the watchlist and the header readout, so Mark read in any of them
 * clears all of them. Loaded lazily so tests can seed storage first.
 */
let visit: Visit | null = null;
const listeners = new Set<() => void>();

function getVisit(): Visit {
  if (!visit) visit = loadVisit(CHANGES);
  return visit;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markRead() {
  visit = markAllRead(CHANGES);
  for (const l of listeners) l();
}

/** Re-reads storage; used by tests after they reset localStorage. */
export function reloadSeen() {
  visit = null;
  for (const l of listeners) l();
}

// Mark read in another tab clears this one too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === VISIT_KEY) reloadSeen();
  });
}

export function useSeen() {
  const v = useSyncExternalStore(subscribe, getVisit, getVisit);
  const unseen = useMemo(() => unseenItems(CHANGES, v), [v]);
  const unseenKeys = useMemo(() => new Set(unseen.map((it) => it.key)), [unseen]);
  return { since: v.at.slice(0, 10), unseen, unseenKeys, markRead };
}
