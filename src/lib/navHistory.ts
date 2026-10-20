import type { AppState, Selection } from './urlState';

export interface HistoryMode {
  kind: 'push' | 'replace';
  /** Gesture the write belongs to; consecutive writes with the same key share one entry. */
  key: string | null;
}

/** Writes of the same gesture closer together than this share one history entry. */
export const GESTURE_GAP_MS = 1000;

/** Identity of a selection, ignoring object identity: two renders of the same panel are equal. */
export function selectionKey(s: Selection): string {
  if (!s) return '';
  if (s.kind === 'country') return 'country:' + s.iso;
  if (s.kind === 'pair') return `pair:${s.a},${s.b ?? ''}`;
  if (s.kind === 'changes') return s.since ? 'changes:since' : 'changes';
  if ('id' in s) return `${s.kind}:${s.id}`;
  return s.kind;
}

/**
 * Whether a state change gets its own Back step. Navigation (what is open,
 * which mode, bloc, comparison, layer, projection, briefing) pushes; dragging
 * the globe rewrites the current entry; a month scrub pushes once and then
 * rewrites that entry until the gesture pauses. Briefing slides rewrite the
 * briefing's own entry so exiting is one step.
 */
export function historyMode(before: AppState, after: AppState, last: { key: string | null; at: number }, now: number): HistoryMode {
  if (before.brief && after.brief) return { kind: 'replace', key: null };
  const navigated =
    before.mode !== after.mode ||
    before.bloc !== after.bloc ||
    before.vs !== after.vs ||
    before.layer !== after.layer ||
    before.view !== after.view ||
    before.brief !== after.brief ||
    selectionKey(before.selection) !== selectionKey(after.selection);
  if (navigated) return { kind: 'push', key: null };
  if (before.month !== after.month) {
    const sameGesture = last.key === 'month' && now - last.at < GESTURE_GAP_MS;
    return { kind: sameGesture ? 'replace' : 'push', key: 'month' };
  }
  return { kind: 'replace', key: null };
}
