import { BLOCS, BLOC_BY_ID } from '../data/blocs';
import { CONFLICTS, CONFLICT_BY_ID } from '../data/conflicts';
import { UNREST, UNREST_BY_ID } from '../data/unrest';
import { COUNTRY_BY_ISO, countryName } from './countries';
import { allChanges, severity, type ChangeItem, type Delta } from './history';
import { CHANGE_LABEL } from './labels';
import { matchesWatchlist, type WatchItem } from './watchlist';

/** Every dated assessment and membership change, newest first. Computed once; the data is static per build. */
export const CHANGES: readonly ChangeItem[] = allChanges(CONFLICTS, BLOCS, countryName, (k) => CHANGE_LABEL[k], UNREST);

/** Items that concern something on the watchlist. */
export function watchlistOnly(items: readonly ChangeItem[], keys: ReadonlySet<string>): ChangeItem[] {
  return items.filter((it) => matchesWatchlist(it, keys, CONFLICT_BY_ID, UNREST_BY_ID));
}

/** Signal first: new episodes and escalations, then easings and membership events, then same-level re-assessments. */
const DELTA_RANK: Record<Delta, number> = { new: 0, up: 0, down: 1, membership: 1, same: 2 };

/** Orders items by signal, then severity, then recency, then title. */
export function bySignal(a: ChangeItem, b: ChangeItem): number {
  return DELTA_RANK[a.delta] - DELTA_RANK[b.delta] || severity(b) - severity(a) || b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
}

export const TICKER_WINDOW_DAYS = 7;

/**
 * Up to `n` items for the ticker, optionally restricted to the watchlist. Items
 * from the last week before the newest one are ranked by signal (new and
 * escalated first, same-level re-assessments last); any slots left over go to
 * older items, newest first.
 */
export function tickerItems(items: readonly ChangeItem[], keys: ReadonlySet<string> | null, n = 10, days = TICKER_WINDOW_DAYS): ChangeItem[] {
  const pool = keys ? watchlistOnly(items, keys) : [...items];
  const newest = pool[0]?.date;
  if (!newest) return [];
  const cutoff = new Date(Date.parse(newest + 'T00:00:00Z') - days * 86400000).toISOString().slice(0, 10);
  const recent = pool.filter((it) => it.date >= cutoff).sort(bySignal);
  return [...recent, ...pool.filter((it) => it.date < cutoff)].slice(0, n);
}

/** Whether a starred id still names something in the data (ids can be renamed or removed by an update). */
export function watchItemResolves(item: WatchItem): boolean {
  if (item.kind === 'country') return COUNTRY_BY_ISO.has(item.id);
  if (item.kind === 'bloc') return BLOC_BY_ID.has(item.id);
  if (item.kind === 'conflict') return CONFLICT_BY_ID.has(item.id);
  return UNREST_BY_ID.has(item.id);
}

/** Feed items that concern one starred item, newest first. */
export function changesForWatchItem(items: readonly ChangeItem[], item: WatchItem): ChangeItem[] {
  return watchlistOnly(items, new Set([`${item.kind}:${item.id}`]));
}

/** Feed items about one country: assessments of conflicts on its territory and its own membership changes. */
export function changesForCountry(items: readonly ChangeItem[], iso: string): ChangeItem[] {
  return items.filter((it) => {
    if (it.kind === 'bloc') return it.iso === iso;
    const c = it.kind === 'unrest' ? UNREST_BY_ID.get(it.id) : CONFLICT_BY_ID.get(it.id);
    return c ? c.countries.includes(iso) : false;
  });
}
