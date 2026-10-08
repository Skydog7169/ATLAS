import { BLOCS } from '../data/blocs';
import { CONFLICTS, CONFLICT_BY_ID } from '../data/conflicts';
import { countryName } from './countries';
import { allChanges, type ChangeItem } from './history';
import { CHANGE_LABEL } from './labels';
import { matchesWatchlist } from './watchlist';

/** Every dated assessment and membership change, newest first. Computed once; the data is static per build. */
export const CHANGES: readonly ChangeItem[] = allChanges(CONFLICTS, BLOCS, countryName, (k) => CHANGE_LABEL[k]);

/** Items that concern something on the watchlist. */
export function watchlistOnly(items: readonly ChangeItem[], keys: ReadonlySet<string>): ChangeItem[] {
  return items.filter((it) => matchesWatchlist(it, keys, CONFLICT_BY_ID));
}

/** The newest `n` items, optionally restricted to the watchlist. */
export function tickerItems(items: readonly ChangeItem[], keys: ReadonlySet<string> | null, n = 10): ChangeItem[] {
  const pool = keys ? watchlistOnly(items, keys) : [...items];
  return pool.slice(0, n);
}

/** Feed items about one country: assessments of conflicts on its territory and its own membership changes. */
export function changesForCountry(items: readonly ChangeItem[], iso: string): ChangeItem[] {
  return items.filter((it) => {
    if (it.kind === 'bloc') return it.iso === iso;
    const c = CONFLICT_BY_ID.get(it.id);
    return c ? c.countries.includes(iso) : false;
  });
}
