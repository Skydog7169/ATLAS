import { useState } from 'react';
import { selectionKey } from '../lib/navHistory';
import type { Selection } from '../lib/urlState';

type Panel = Exclude<Selection, null>;

interface Trail {
  current: Selection;
  seq: number;
  /** Panels hopped through to reach `current`, oldest first. */
  stack: Panel[];
}

/** Pure step of the trail; exported for tests. */
export function nextTrail(trail: Trail, selection: Selection, hashSeq: number): Trail {
  const key = selectionKey(selection);
  const fromHash = trail.seq !== hashSeq;
  const same = selectionKey(trail.current) === key;
  let stack = trail.stack;
  if (!selection) stack = [];
  else if (fromHash) {
    const top = stack.at(-1);
    if (top && selectionKey(top) === key) stack = stack.slice(0, -1);
    else if (!same) stack = [];
  } else if (!same && trail.current) stack = [...stack, trail.current];
  return { current: selection, seq: hashSeq, stack };
}

/**
 * The panel this session hopped from to reach the open one, for the
 * "‹ Ukraine" back chip. Each hop is a pushed history entry, so the chip is
 * history.back(); when the URL then lands on the top of the trail it is
 * popped. Any other hash-driven change (Forward, an edited hash) or closing
 * the panel starts a fresh trail.
 */
export function usePanelTrail(selection: Selection, hashSeq: number): Panel | null {
  const [trail, setTrail] = useState<Trail>({ current: selection, seq: hashSeq, stack: [] });
  if (selectionKey(trail.current) !== selectionKey(selection) || trail.seq !== hashSeq) {
    // Adjusting state during render: React re-renders before committing.
    const next = nextTrail(trail, selection, hashSeq);
    setTrail(next);
    return next.stack.at(-1) ?? null;
  }
  return trail.stack.at(-1) ?? null;
}
