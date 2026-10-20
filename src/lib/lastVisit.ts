import type { ChangeItem } from './history';

/** Legacy: the YYYY-MM-DD the visitor last pressed Mark read. Read once to migrate, then removed. */
export const LAST_VISIT_KEY = 'atlas.lastVisit.v1';
/** `{ at, seen }`: when the visitor last caught up, and the keys of every item they had seen then. */
export const VISIT_KEY = 'atlas.lastVisit.v2';

export interface Visit {
  /** ISO timestamp of the last Mark read (or first visit); only used for the 'Since …' label. */
  at: string;
  /** ChangeItem keys the visitor has seen. Anything else in the feed is unseen. */
  seen: ReadonlySet<string>;
}

type Store = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

function parseV2(raw: string | null | undefined): Visit | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const { at, seen } = v as Record<string, unknown>;
    if (typeof at !== 'string' || !ISO_DAY.test(at) || !Array.isArray(seen)) return null;
    return { at, seen: new Set(seen.filter((k): k is string => typeof k === 'string')) };
  } catch {
    return null;
  }
}

export function writeVisit(visit: Visit, store: Pick<Storage, 'setItem'> | null = storage()): boolean {
  try {
    store?.setItem(VISIT_KEY, JSON.stringify({ at: visit.at, seen: [...visit.seen] }));
    return store !== null;
  } catch {
    return false;
  }
}

/**
 * The visitor's baseline. Read from v2; else migrated from a v1 date (items
 * dated on or after it count as unseen once, so nothing merged late that day
 * is lost); else, on a first visit, every current item is seeded as seen so a
 * newcomer is not told that the whole archive is new. Seen keys that are no
 * longer in the feed are pruned. Storage failures never throw.
 */
export function loadVisit(items: readonly ChangeItem[], now: Date = new Date(), store: Store | null = storage()): Visit {
  const current = new Set(items.map((it) => it.key));
  let raw: string | null = null;
  let legacy: string | null = null;
  try {
    raw = store?.getItem(VISIT_KEY) ?? null;
    legacy = store?.getItem(LAST_VISIT_KEY) ?? null;
  } catch {
    /* blocked storage: behave as a first visit */
  }
  const v2 = parseV2(raw);
  if (v2) {
    const seen = new Set([...v2.seen].filter((k) => current.has(k)));
    return { at: v2.at, seen };
  }
  if (legacy && /^\d{4}-\d{2}-\d{2}$/.test(legacy)) {
    const visit: Visit = { at: legacy, seen: new Set(items.filter((it) => it.date < legacy).map((it) => it.key)) };
    if (writeVisit(visit, store)) {
      try {
        store?.removeItem?.(LAST_VISIT_KEY);
      } catch {
        /* keep the legacy key; v2 wins on the next read anyway */
      }
    }
    return visit;
  }
  const visit: Visit = { at: now.toISOString(), seen: current };
  writeVisit(visit, store);
  return visit;
}

/** Marks every current item seen and stamps the time. */
export function markAllRead(items: readonly ChangeItem[], now: Date = new Date(), store: Pick<Storage, 'setItem'> | null = storage()): Visit {
  const visit: Visit = { at: now.toISOString(), seen: new Set(items.map((it) => it.key)) };
  writeVisit(visit, store);
  return visit;
}

/** Items the visitor has not seen yet, in feed order. Immune to merge lag, time zones and back-dated entries. */
export function unseenItems(items: readonly ChangeItem[], visit: Visit): ChangeItem[] {
  return items.filter((it) => !visit.seen.has(it.key));
}
