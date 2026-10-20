import { CONFLICTS } from '../data/conflicts';
import type { Conflict } from '../data/types';
import { assessedMonths, clampMonth, currentMonth, earliestMonth, monthRange, replayAt } from './history';
import { formatDate, formatMonth } from './labels';

// Replay covers conflict assessments only; bloc events go back years and would stretch the scrubber.
export const TIMELINE_MONTHS = monthRange(earliestMonth(CONFLICTS, []), currentMonth());

/** Months in which any conflict was newly assessed; the others only carry earlier assessments forward. */
export const ASSESSED_MONTHS = assessedMonths(CONFLICTS);

/** URL validator: the month replay should show for a requested `t`, or null for live. */
export function timelineMonth(month: string): string | null {
  return clampMonth(month, TIMELINE_MONTHS).month;
}

/** One-line notice when a link asked for a month outside the replay range, else null. */
export function clampNotice(requested: string | null, months: string[] = TIMELINE_MONTHS): string | null {
  if (!requested) return null;
  const { clamped } = clampMonth(requested, months);
  if (clamped === 'before') return `Replay starts ${formatMonth(months[0] ?? '')}. Showing ${formatMonth(months[0] ?? '')}, not ${formatMonth(requested)}.`;
  if (clamped === 'after') return `${formatMonth(requested)} is in the future. Showing the live map.`;
  return null;
}

/** Panel badge for a replayed conflict: says whether the month has its own assessment or carries an older one forward. */
export function replayBadge(conflict: Conflict, month: string): string {
  const r = replayAt(conflict, month);
  if (!r.entry) return r.untracked ? `Not yet tracked in ${formatMonth(month)}` : `Not active in ${formatMonth(month)}`;
  if (r.fresh) return `Assessed ${formatDate(r.entry.date)}`;
  return `Last assessed ${formatDate(r.entry.date)} · no assessment on record for ${formatMonth(month)}`;
}
