import type { Bloc, Conflict, ConflictInput, HistoryEntry, Intensity } from '../data/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Sorts history newest-first and mirrors the newest entry onto the record. */
export function withCurrent(input: ConflictInput): Conflict {
  const history = [...input.history].sort((a, b) => b.date.localeCompare(a.date));
  const current = history[0];
  if (!current) throw new Error(`Conflict ${input.id} has no history entries`);
  for (const h of history) if (!ISO_DATE.test(h.date)) throw new Error(`Conflict ${input.id}: bad date ${h.date}`);
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

export interface ChangeItem {
  date: string;
  kind: 'conflict' | 'bloc';
  id: string;
  title: string;
  detail: string;
  intensity?: Intensity;
  color?: string;
  iso?: string;
}

/** Flattens conflict assessments and bloc membership events into one feed, newest first. */
export function allChanges(conflicts: Conflict[], blocs: Bloc[], countryName: (iso: string) => string, changeLabel: (k: Bloc['changes'][number]['change']) => string): ChangeItem[] {
  const items: ChangeItem[] = [];
  for (const c of conflicts) {
    for (const h of c.history) items.push({ date: h.date, kind: 'conflict', id: c.id, title: c.name, detail: h.status, intensity: h.intensity });
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
