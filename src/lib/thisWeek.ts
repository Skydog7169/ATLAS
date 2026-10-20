import { CONFLICTS } from '../data/conflicts';
import { UNREST } from '../data/unrest';
import type { HistoryEntry, Intensity } from '../data/types';
import { DATA_ASOF } from './frontdoor';

/**
 * Thin adapter for the This week card. It derives each assessment's change
 * against the previous entry of the same conflict or episode. When the
 * change/delta model (ChangeItem.delta in history.ts) lands, `weekItems`
 * should read from CHANGES and filter on it.delta instead: the card only
 * depends on the WeekItem shape below.
 */
export type WeekDelta = 'new' | 'up' | 'down' | 'same';

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

function deltaOf(prev: Intensity | null, cur: Intensity): WeekDelta {
  if (prev === null) return 'new';
  return RANK[cur] > RANK[prev] ? 'up' : RANK[cur] < RANK[prev] ? 'down' : 'same';
}

function items(kind: WeekItem['kind'], list: ReadonlyArray<{ id: string; name: string; history: HistoryEntry[] }>): WeekItem[] {
  const out: WeekItem[] = [];
  for (const r of list) {
    const oldestFirst = [...r.history].sort((a, b) => a.date.localeCompare(b.date));
    let prev: Intensity | null = null;
    for (const h of oldestFirst) {
      out.push({ kind, id: r.id, title: r.name, date: h.date, intensity: h.intensity, prev, delta: deltaOf(prev, h.intensity), detail: h.status });
      prev = h.intensity;
    }
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

export function weekSummary(asOf: string = DATA_ASOF, n = 3, pool: WeekItem[] = [...items('conflict', CONFLICTS), ...items('unrest', UNREST)]): WeekSummary {
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
