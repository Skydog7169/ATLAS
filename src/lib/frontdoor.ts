import { BLOCS } from '../data/blocs';
import { CONFLICTS } from '../data/conflicts';
import { UNREST } from '../data/unrest';
import { CHANGES } from './feed';
import { formatDate } from './labels';

/** The promise line under the wordmark; the short form survives on phones. */
export const PROMISE = 'Who’s allied, who’s fighting, what changed. Every claim sourced and dated.';
export const PROMISE_SHORT = 'Alliances · wars · unrest';

export const COUNTS = { conflicts: CONFLICTS.length, unrest: UNREST.length, blocs: BLOCS.length } as const;

/**
 * Date the data last changed: the newest dated assessment (conflict or
 * unrest) or bloc membership event. Exact to the day, unlike the per-record
 * `updated` months on blocs.
 */
export const DATA_ASOF: string = CHANGES[0]?.date ?? '';

/** Stamp used on PNG exports and wherever the data date is printed in full. */
export function dataStamp(): string {
  return DATA_ASOF ? `Data updated ${formatDate(DATA_ASOF)}` : 'Data date unknown';
}
