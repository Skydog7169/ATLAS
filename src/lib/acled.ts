import raw from '../data/acled.generated.json';
import { formatDate } from './labels';
import type { DossierExtra } from './dossier';

export interface AcledByType {
  battles: number;
  explosions: number;
  civilians: number;
  protests: number;
  riots: number;
  strategic: number;
}

export interface AcledRow {
  iso: string;
  events: number;
  fatalities: number;
  /** Counts per ACLED event type; absent in files built before the split. */
  byType?: AcledByType;
}

export const ACLED_TYPE_LABEL: Record<keyof AcledByType, string> = {
  battles: 'Battles',
  explosions: 'Explosions and remote violence',
  civilians: 'Violence against civilians',
  protests: 'Protests',
  riots: 'Riots',
  strategic: 'Strategic developments',
};

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

/** Amber ramp for the protests-and-riots view, distinct from the teal political-violence ramp. */
export const ACLED_UNREST_COLORS = ['var(--land)', '#4a3a12', '#8a6a1a', '#c9a227', '#ffd166', '#fff1b8'] as const;

/** Protests plus riots in the window; zero when the file predates the per-type split. */
export function acledUnrestEvents(iso: string): number {
  const t = ACLED_BY_ISO.get(iso)?.byType;
  return t ? t.protests + t.riots : 0;
}

export function acledUnrestColor(iso: string): string {
  return ACLED_UNREST_COLORS[acledBin(acledUnrestEvents(iso))] ?? 'var(--land)';
}

export function acledUnrestSummary(iso: string): string | null {
  const t = ACLED_BY_ISO.get(iso)?.byType;
  if (!t) return null;
  return `${t.protests} protests · ${t.riots} riots in ${ACLED.days} days`;
}

/** Dossier section: events by type over the window. Null until the build has credentials. */
export function acledDossier(iso: string): DossierExtra | null {
  const row = ACLED_BY_ISO.get(iso);
  if (!ACLED.available || !row?.byType) return null;
  const t = row.byType;
  const keys = (Object.keys(ACLED_TYPE_LABEL) as Array<keyof AcledByType>).filter((k) => t[k] > 0).sort((a, b) => t[b] - t[a]);
  return {
    id: 'acled',
    title: `Recorded events · ${row.events}`,
    rows: keys.map((k) => ({ label: ACLED_TYPE_LABEL[k], value: String(t[k]) })),
    footnote: `${acledNote()} ${row.fatalities} reported fatalities.`,
  };
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
