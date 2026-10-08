import raw from '../data/acled.generated.json';
import { formatDate } from './labels';

export interface AcledRow {
  iso: string;
  events: number;
  fatalities: number;
}

interface AcledFile {
  source: { name: string; url: string };
  /** False when the build ran without ACLED credentials; the layer is then hidden. */
  available: boolean;
  reason?: string;
  fetchedAt: string;
  days: number;
  from: string | null;
  to: string | null;
  rows: AcledRow[];
}

export const ACLED = raw as AcledFile;
export const ACLED_BY_ISO: ReadonlyMap<string, AcledRow> = new Map(ACLED.rows.map((r) => [r.iso, r]));

/** Lower bounds of each bin: political-violence events in the window. */
export const ACLED_BINS = [0, 1, 10, 50, 200, 1000] as const;
/** Teal-to-white ramp, kept apart from the conflict reds and the bloc cyans. */
export const ACLED_COLORS = ['var(--land)', '#1d4a45', '#1f7a6a', '#2bb09a', '#6fe3c9', '#dffcf4'] as const;

export function acledBin(events: number): number {
  let bin = 0;
  for (let i = 0; i < ACLED_BINS.length; i++) if (events >= ACLED_BINS[i]!) bin = i;
  return events <= 0 ? 0 : bin;
}

export function acledColor(iso: string): string {
  return ACLED_COLORS[acledBin(ACLED_BY_ISO.get(iso)?.events ?? 0)] ?? 'var(--land)';
}

export function acledBinLabel(i: number): string {
  const lo = ACLED_BINS[i] ?? 0;
  const hi = ACLED_BINS[i + 1];
  if (i === 0) return 'No recorded events';
  return hi ? `${lo}–${hi - 1} events` : `${lo}+ events`;
}

export function acledSummary(iso: string): string | null {
  const row = ACLED_BY_ISO.get(iso);
  if (!row) return null;
  return `${row.events} events · ${row.fatalities} reported fatalities in ${ACLED.days} days`;
}

export function acledNote(): string {
  return ACLED.available && ACLED.from && ACLED.to ? `Political violence events ${formatDate(ACLED.from)} to ${formatDate(ACLED.to)}, fetched ${formatDate(ACLED.fetchedAt)}.` : 'ACLED layer unavailable: credentials not configured.';
}
