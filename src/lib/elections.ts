import raw from '../data/elections.json';
import { NO_DATA_FILL, ramp } from './palette';
import type { DossierExtra } from './dossier';
import { formatDate, formatMonth } from './labels';

export type ElectionType = 'general' | 'legislative' | 'presidential';

export interface ElectionRow {
  iso: string;
  /** YYYY, YYYY-MM or YYYY-MM-DD; null when nothing is scheduled. */
  date: string | null;
  type: ElectionType;
  qualifiers?: Array<'indirect' | 'non-competitive'>;
  deadline?: boolean;
  note?: string;
  sources: Array<{ name: string; url: string }>;
  verified: string;
}

interface ElectionsFile {
  source: { name: string; url: string };
  rows: ElectionRow[];
}

export const ELECTIONS = raw as ElectionsFile;
export const ELECTIONS_BY_ISO: ReadonlyMap<string, ElectionRow> = new Map(ELECTIONS.rows.map((r) => [r.iso, r]));

export const ELECTION_TYPE_LABEL: Record<ElectionType, string> = { general: 'General election', legislative: 'Legislative election', presidential: 'Presidential election' };

/** Newest `verified` date across rows: the dataset's effective fetch date. */
export const ELECTIONS_VERIFIED = ELECTIONS.rows.map((r) => r.verified).sort().at(-1) ?? '';

/** Whole months from `now` to the election (its first day when only a month or year is known). Negative when passed. */
export function monthsUntil(date: string, now: Date = new Date()): number {
  const [y, m = 1, d = 1] = date.split('-').map(Number) as [number, number?, number?];
  const target = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  const from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((target - from) / (30.4375 * 86400000));
}

/** Upper bounds (exclusive) of each bin in months; the last bin is open-ended, and null-date countries sit in bin 0. */
export const ELECTION_BINS = [3, 6, 12, 24] as const;
/** Green ramp, brightest for the soonest. Bin 0 is "no date". */
export const ELECTION_COLORS = ramp('elections');

export function electionBin(months: number | null): number {
  if (months === null || months < 0) return 0;
  for (let i = 0; i < ELECTION_BINS.length; i++) if (months < ELECTION_BINS[i]!) return ELECTION_BINS.length - i;
  return 1;
}

export function electionBinLabel(i: number): string {
  if (i === 0) return 'No date set';
  const idx = ELECTION_BINS.length - i;
  const hi = ELECTION_BINS[idx]!;
  const lo = ELECTION_BINS[idx - 1];
  // The open-ended bin starts at the previous bound: everything 12 months or more away.
  if (i === 1) return `${ELECTION_BINS[ELECTION_BINS.length - 2]}+ months away`;
  return lo === undefined ? `Within ${hi} months` : `${lo}–${hi} months`;
}

export function electionColor(iso: string, now: Date = new Date()): string {
  const row = ELECTIONS_BY_ISO.get(iso);
  if (!row) return NO_DATA_FILL;
  const months = row.date ? monthsUntil(row.date, now) : null;
  return ELECTION_COLORS[electionBin(months)] ?? 'var(--land)';
}

/** "20 Dec 2026", "Jul 2031" or "2027", with "by" when the date is a deadline. */
export function formatElectionDate(row: ElectionRow): string {
  if (!row.date) return 'No date set';
  const text = row.date.length === 10 ? formatDate(row.date) : row.date.length === 7 ? formatMonth(row.date) : row.date;
  return row.deadline ? `by ${text}` : text;
}

/** "Legislative election (indirect, non-competitive)". */
export function electionTypeLabel(row: ElectionRow): string {
  return ELECTION_TYPE_LABEL[row.type] + (row.qualifiers?.length ? ` (${row.qualifiers.join(', ')})` : '');
}

/**
 * Whole months to a partial date, measured to the end of its period when
 * asking whether it has passed: "2026" is not passed until 2027.
 */
export function monthsUntilForLabel(date: string, now: Date = new Date()): number {
  const months = monthsUntil(date, now);
  if (months >= 0 || date.length === 10) return months;
  const [y, m] = date.split('-').map(Number) as [number, number?];
  const end = m ? Date.UTC(y, m, 1) : Date.UTC(y + 1, 0, 1);
  return end > now.getTime() ? 0 : months;
}

export function monthsLabel(months: number): string {
  if (months < 0) return 'passed';
  if (months === 0) return 'this month';
  return months === 1 ? 'in 1 month' : `in ${months} months`;
}

export function electionSummary(iso: string, now: Date = new Date()): string | null {
  const row = ELECTIONS_BY_ISO.get(iso);
  if (!row) return null;
  if (!row.date) return `${electionTypeLabel(row)}: ${row.note ?? 'no date set'}`;
  return `${electionTypeLabel(row)} ${formatElectionDate(row)} (${monthsLabel(monthsUntilForLabel(row.date, now))})`;
}

export function electionsDossier(iso: string, now: Date = new Date()): DossierExtra | null {
  const row = ELECTIONS_BY_ISO.get(iso);
  const rows: DossierExtra['rows'] = [];
  if (row) {
    const first = row.sources[0];
    const value = row.date ? `${formatElectionDate(row)} · ${monthsLabel(monthsUntilForLabel(row.date, now))}` : 'No date set';
    // A note that only repeats the value ('No date set') is dropped.
    rows.push({ label: electionTypeLabel(row), value, href: first?.url, note: row.note && row.note !== value ? row.note : undefined });
  }
  return {
    id: 'elections',
    title: 'Next national election',
    rows,
    empty: 'No election on record for this territory.',
    footnote: row ? `Verified ${formatDate(row.verified)}. ${row.sources.map((s) => s.name).join('; ')}.` : undefined,
  };
}
