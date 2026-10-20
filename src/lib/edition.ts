import { BLOCS } from '../data/blocs';
import { CONFLICTS } from '../data/conflicts';
import { UNREST } from '../data/unrest';

/**
 * Every deploy rebuilds public/feed.json from the same data the bundle carries,
 * with item ids of the form kind:id:date. A feed id this bundle does not know
 * means a newer edition has shipped since the tab loaded. Ids rather than the
 * first item are compared so ties in sort order can never look like an update.
 */
export const BUNDLED_IDS: ReadonlySet<string> = new Set([
  ...CONFLICTS.flatMap((c) => c.history.map((h) => `conflict:${c.id}:${h.date}`)),
  ...UNREST.flatMap((u) => u.history.map((h) => `unrest:${u.id}:${h.date}`)),
  ...BLOCS.flatMap((b) => b.changes.map((ch) => `bloc:${b.id}:${ch.iso}:${ch.date}:${ch.change}`)),
]);

/** Newest dated change in this bundle (YYYY-MM-DD). */
export const BUNDLED_NEWEST: string = [...CONFLICTS.flatMap((c) => c.history.map((h) => h.date)), ...UNREST.flatMap((u) => u.history.map((h) => h.date))].sort().at(-1) ?? '';

/** Weekly research cadence plus slack: older than this, the data is a snapshot, not live. */
export const STALE_AFTER_DAYS = 8;

export interface FeedItem {
  id?: unknown;
  date_published?: unknown;
}

/** The newest date among feed items this bundle lacks, or null when the feed holds nothing new. */
export function newerEdition(items: readonly FeedItem[], known: ReadonlySet<string> = BUNDLED_IDS): string | null {
  let newest: string | null = null;
  for (const it of items) {
    if (typeof it.id !== 'string' || known.has(it.id)) continue;
    const date = typeof it.date_published === 'string' ? it.date_published.slice(0, 10) : (it.id.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '');
    if (!newest || date > newest) newest = date;
  }
  return newest;
}

/** Whole days between a YYYY-MM-DD date and now (UTC). */
export function daysSince(date: string, now: Date = new Date()): number {
  const t = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

export function isStale(newest: string = BUNDLED_NEWEST, now: Date = new Date()): boolean {
  return Boolean(newest) && daysSince(newest, now) > STALE_AFTER_DAYS;
}
