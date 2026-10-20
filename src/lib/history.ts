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

/** True when the conflict has an assessment dated inside `month`, not one carried forward from earlier. */
export function assessedIn(conflict: Conflict, month: string): boolean {
  return conflict.history.some((h) => monthKey(h.date) === month);
}

/** Months (YYYY-MM) in which at least one conflict received a new assessment. */
export function assessedMonths(conflicts: Conflict[]): Set<string> {
  const out = new Set<string>();
  for (const c of conflicts) for (const h of c.history) out.add(monthKey(h.date));
  return out;
}

export interface ReplayEntry {
  /** The assessment in force at the end of the month, or null if none was on record yet. */
  entry: HistoryEntry | null;
  /** The entry is dated inside the month rather than carried forward. */
  fresh: boolean;
  /** No entry yet, but the conflict's current phase had already begun: shown as "not yet tracked". */
  untracked: boolean;
}

/** What replay can honestly say about a conflict at `month`. */
export function replayAt(conflict: Conflict, month: string): ReplayEntry {
  const entry = entryAt(conflict, month);
  if (entry) return { entry, fresh: monthKey(entry.date) === month, untracked: false };
  return { entry: null, fresh: false, untracked: conflict.since <= Number(month.slice(0, 4)) };
}

/**
 * Where a requested replay month lands on a timeline whose last stop is live:
 * before the first stop snaps to it, the last stop or later is live (null).
 */
export function clampMonth(month: string, months: string[]): { month: string | null; clamped: 'before' | 'after' | null } {
  const first = months[0];
  const last = months.at(-1);
  if (!first || !last) return { month: null, clamped: null };
  if (month < first) return { month: first, clamped: 'before' };
  if (month >= last) return { month: null, clamped: month > last ? 'after' : null };
  return { month, clamped: null };
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

export interface ChangeItem {
  date: string;
  kind: 'conflict' | 'bloc' | 'unrest';
  id: string;
  title: string;
  detail: string;
  intensity?: Intensity;
  color?: string;
  iso?: string;
}

/** Flattens conflict and unrest assessments and bloc membership events into one feed, newest first. */
export function allChanges(conflicts: Conflict[], blocs: Bloc[], countryName: (iso: string) => string, changeLabel: (k: Bloc['changes'][number]['change']) => string, unrest: Unrest[] = []): ChangeItem[] {
  const items: ChangeItem[] = [];
  for (const c of conflicts) {
    for (const h of c.history) items.push({ date: h.date, kind: 'conflict', id: c.id, title: c.name, detail: h.status, intensity: h.intensity });
  }
  for (const u of unrest) {
    for (const h of u.history) items.push({ date: h.date, kind: 'unrest', id: u.id, title: u.name, detail: h.status, intensity: h.intensity });
  }
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
      });
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export function changesSince(items: ChangeItem[], days: number, now: Date = new Date()): ChangeItem[] {
  const cutoff = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  return items.filter((i) => i.date >= cutoff);
}
