import type { SearchKind } from './search';

export const RECENT_KEY = 'atlas.recent.v1';
const MAX = 5;

export interface RecentPick {
  kind: SearchKind;
  id: string;
}

function isPick(x: unknown): x is RecentPick {
  if (!x || typeof x !== 'object') return false;
  const { kind, id } = x as Record<string, unknown>;
  return typeof kind === 'string' && typeof id === 'string' && id.length > 0 && id.length < 64;
}

/** Last few search picks, newest first; empty when storage is blocked or holds junk. */
export function readRecent(): RecentPick[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter(isPick).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(pick: RecentPick): RecentPick[] {
  const next = [pick, ...readRecent().filter((p) => !(p.kind === pick.kind && p.id === pick.id))].slice(0, MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: recents just aren't remembered */
  }
  return next;
}
