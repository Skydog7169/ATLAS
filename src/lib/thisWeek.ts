import type { Intensity } from '../data/types';
import { CHANGES } from './feed';
import { DATA_ASOF } from './frontdoor';
import type { ChangeItem, Delta } from './history';

/**
 * The This week card's view of the change feed: conflict and unrest
 * assessments with their delta against the previous entry (history.ts), so the
 * card, the ticker and Latest changes count New / Escalated / Eased the same way.
 */
export type WeekDelta = Exclude<Delta, 'membership'>;

export interface WeekItem {
  kind: 'conflict' | 'unrest';
  id: string;
  title: string;
  date: string;
  intensity: Intensity;
  prev: Intensity | null;
  delta: WeekDelta;
  detail: string;
}

const RANK: Record<Intensity, number> = { high: 3, medium: 2, low: 1, latent: 0 };

/** Assessment items from the shared change feed. */
export function weekItems(feed: readonly ChangeItem[] = CHANGES): WeekItem[] {
  const out: WeekItem[] = [];
  for (const it of feed) {
    if (it.kind === 'bloc' || !it.intensity || it.delta === 'membership') continue;
    out.push({ kind: it.kind, id: it.id, title: it.title, date: it.date, intensity: it.intensity, prev: it.prev ?? null, delta: it.delta, detail: it.detail });
  }
  return out;
}

export const WEEK_DAYS = 7;

function daysBefore(iso: string, days: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') - days * 86400000).toISOString().slice(0, 10);
}

/** Intensity × recency: a high-intensity item from today outranks a medium one from last week. */
export function weekScore(it: WeekItem, asOf: string): number {
  const age = (Date.parse(asOf + 'T00:00:00Z') - Date.parse(it.date + 'T00:00:00Z')) / 86400000;
  return (RANK[it.intensity] + 1) * Math.max(0.1, 1 - age / (WEEK_DAYS + 1)) + (it.delta === 'same' ? 0 : 3);
}

export interface WeekSummary {
  /** Inclusive window start and end (the newest data date, not the visitor's clock). */
  from: string;
  to: string;
  counts: Record<'new' | 'up' | 'down', number>;
  /** Top items: changes in level first, then same-level updates, each by intensity × recency. */
  top: WeekItem[];
}

export function weekSummary(asOf: string = DATA_ASOF, n = 3, pool: WeekItem[] = weekItems()): WeekSummary {
  const from = daysBefore(asOf, WEEK_DAYS - 1);
  // One row per conflict or episode: its newest entry in the window.
  const newest = new Map<string, WeekItem>();
  for (const it of pool) {
    if (it.date < from || it.date > asOf) continue;
    const key = it.kind + ':' + it.id;
    const cur = newest.get(key);
    if (!cur || it.date > cur.date) newest.set(key, it);
  }
  const week = [...newest.values()];
  const counts = { new: 0, up: 0, down: 0 };
  for (const it of week) if (it.delta !== 'same') counts[it.delta] += 1;
  const top = week.sort((a, b) => weekScore(b, asOf) - weekScore(a, asOf) || a.title.localeCompare(b.title)).slice(0, n);
  return { from, to: asOf, counts, top };
}
