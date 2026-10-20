/**
 * First-visit detection for the front door. Read once when the module loads,
 * before any component has had the chance to write its own baseline (the
 * since-last-visit strip seeds its key on first render), so the answer is
 * stable for the whole page view.
 */
const VISIT_KEYS = ['atlas.lastVisit.v1', 'atlas.lastVisit.v2'];

/** 'open' while the This week card should show, 'dismissed' once closed. */
export const INTRO_KEY = 'atlas.intro.v1';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Whether to show the This week card. A visitor with no visit record is new:
 * the card opens and stays open across reloads until dismissed. Anyone who
 * visited before the card existed never sees it. Storage failures mean no card.
 */
export function introState(store: Store | null = storage()): 'open' | 'dismissed' {
  try {
    if (!store) return 'dismissed';
    const v = store.getItem(INTRO_KEY);
    if (v === 'open' || v === 'dismissed') return v;
    const returning = VISIT_KEYS.some((k) => store.getItem(k) !== null);
    const state = returning ? 'dismissed' : 'open';
    store.setItem(INTRO_KEY, state);
    return state;
  } catch {
    return 'dismissed';
  }
}

export function dismissIntro(store: Store | null = storage()): void {
  try {
    store?.setItem(INTRO_KEY, 'dismissed');
  } catch {
    /* blocked storage: the card simply comes back next time */
  }
}

/** Evaluated at import, ahead of the first render. */
export const INTRO_AT_LOAD = introState();
