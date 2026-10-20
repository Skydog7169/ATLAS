import type { Bloc, Conflict, HistoryEntry, Intensity, Source, Unrest } from '../data/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Sorts history newest-first and mirrors the newest entry onto the record. */
export function withCurrent<T extends { id: string; history: HistoryEntry[] }>(input: T): T & { intensity: Intensity; status: string; sources: Source[]; updated: string } {
  const history = [...input.history].sort((a, b) => b.date.localeCompare(a.date));
  const current = history[0];
  if (!current) throw new Error(`${input.id} has no history entries`);
  for (const h of history) if (!ISO_DATE.test(h.date)) throw new Error(`${input.id}: bad date ${h.date}`);
  return { ...input, history, intensity: current.intensity, status: current.status, sources: current.sources, updated: current.date };
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function currentMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** The assessment in force at the end of `month` (YYYY-MM), or null if the conflict had no entry yet. */
export function entryAt(conflict: Conflict, month: string): HistoryEntry | null {
  const cutoff = month + '-99';
  return conflict.history.find((h) => h.date <= cutoff) ?? null;
}

/** Inclusive list of YYYY-MM keys from `from` to `to`. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 600) break;
  }
  return out;
}

export function earliestMonth(conflicts: Conflict[], blocs: Bloc[]): string {
  let min = '9999-99';
  for (const c of conflicts) for (const h of c.history) if (h.date < min) min = h.date;
  for (const b of blocs) for (const ch of b.changes) if (ch.date < min) min = ch.date;
  return monthKey(min);
}

/** How an assessment compares with the one before it. Membership changes are always events. */
export type Delta = 'new' | 'up' | 'down' | 'same' | 'membership';

export interface ChangeItem {
  date: string;
  kind: 'conflict' | 'bloc' | 'unrest';
  id: string;
  title: string;
  detail: string;
  intensity?: Intensity;
  color?: string;
  iso?: string;
  /** The intensity of the previous assessment of the same conflict or episode; null for its first entry. */
  prev?: Intensity | null;
  delta: Delta;
  /** Stable identity, the same scheme as the ids in public/feed.json: `${kind}:${id}:${date}` (blocs add iso and change). */
  key: string;
}

/** Severity rank, highest first: high 3 … latent 0. */
const RANK: Record<Intensity, number> = { high: 3, medium: 2, low: 1, latent: 0 };

/** Compares two intensities: 'up' when `cur` is more severe than `prev`. */
export function deltaOf(prev: Intensity | null, cur: Intensity): Delta {
  if (prev === null) return 'new';
  return RANK[cur] > RANK[prev] ? 'up' : RANK[cur] < RANK[prev] ? 'down' : 'same';
}

/** Severity of an item for ordering: intensity rank, with membership events below every assessment. */
export function severity(it: Pick<ChangeItem, 'intensity'>): number {
  return it.intensity ? RANK[it.intensity] : -1;
}

/** Assessment items for one conflict or episode, each compared with the entry before it. */
function assessments(kind: 'conflict' | 'unrest', r: { id: string; name: string; history: HistoryEntry[] }): ChangeItem[] {
  const oldestFirst = [...r.history].sort((a, b) => a.date.localeCompare(b.date));
  let prev: Intensity | null = null;
  return oldestFirst.map((h) => {
    const item: ChangeItem = { date: h.date, kind, id: r.id, title: r.name, detail: h.status, intensity: h.intensity, prev, delta: deltaOf(prev, h.intensity), key: `${kind}:${r.id}:${h.date}` };
    prev = h.intensity;
    return item;
  });
}

/**
 * Flattens conflict and unrest assessments and bloc membership events into one
 * feed, newest first. Same-day items lead with the most severe, so the panel,
 * ticker and RSS open on the item that matters rather than the alphabet.
 */
export function allChanges(conflicts: Conflict[], blocs: Bloc[], countryName: (iso: string) => string, changeLabel: (k: Bloc['changes'][number]['change']) => string, unrest: Unrest[] = []): ChangeItem[] {
  const items: ChangeItem[] = [];
  for (const c of conflicts) items.push(...assessments('conflict', c));
  for (const u of unrest) items.push(...assessments('unrest', u));
  for (const b of blocs) {
    for (const ch of b.changes) {
      items.push({
        date: ch.date,
        kind: 'bloc',
        id: b.id,
        title: `${b.shortName}: ${countryName(ch.iso)}`,
        detail: `${changeLabel(ch.change)}${ch.note ? `. ${ch.note}` : ''}`,
        color: b.color,
        iso: ch.iso,
        delta: 'membership',
        key: `bloc:${b.id}:${ch.iso}:${ch.date}:${ch.change}`,
      });
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || severity(b) - severity(a) || a.title.localeCompare(b.title));
}

export function changesSince(items: ChangeItem[], days: number, now: Date = new Date()): ChangeItem[] {
  const cutoff = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  return items.filter((i) => i.date >= cutoff);
}
