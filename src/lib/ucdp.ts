import raw from '../data/ucdp.generated.json';
import type { DossierExtra } from './dossier';
import { formatDate } from './labels';

export interface UcdpRow {
  iso: string;
  stateBased: number;
  nonState: number;
  oneSided: number;
  events: number;
}

interface UcdpFile {
  source: { name: string; url: string };
  /** False when the build ran without a UCDP token; the layer is then hidden. */
  available: boolean;
  reason?: string;
  fetchedAt: string;
  version: string;
  from: string | null;
  to: string | null;
  rows: UcdpRow[];
}

export const UCDP = raw as UcdpFile;
export const UCDP_BY_ISO: ReadonlyMap<string, UcdpRow> = new Map(UCDP.rows.map((r) => [r.iso, r]));

/** Lower bounds of each bin: best-estimate deaths in the year. */
export const UCDP_BINS = [0, 1, 25, 100, 1000, 10000] as const;
/** Wine-to-rose ramp, darker than the conflict reds so the two are not confused. */
export const UCDP_COLORS = ['var(--land)', '#4a1b26', '#7d2437', '#b33a4e', '#e86a78', '#ffc4c0'] as const;

export const UCDP_TYPE_LABEL: Record<'stateBased' | 'nonState' | 'oneSided', string> = {
  stateBased: 'State-based conflict',
  nonState: 'Non-state conflict',
  oneSided: 'One-sided violence',
};

export function ucdpTotal(row: UcdpRow): number {
  return row.stateBased + row.nonState + row.oneSided;
}

export function ucdpBin(deaths: number): number {
  let bin = 0;
  for (let i = 0; i < UCDP_BINS.length; i++) if (deaths >= UCDP_BINS[i]!) bin = i;
  return deaths <= 0 ? 0 : bin;
}

export function ucdpBinLabel(i: number): string {
  const lo = UCDP_BINS[i] ?? 0;
  const hi = UCDP_BINS[i + 1];
  if (i === 0) return 'No recorded deaths';
  return hi ? `${lo}–${(hi - 1).toLocaleString()} deaths` : `${lo.toLocaleString()}+ deaths`;
}

export function ucdpColor(iso: string): string {
  const row = UCDP_BY_ISO.get(iso);
  return UCDP_COLORS[ucdpBin(row ? ucdpTotal(row) : 0)] ?? 'var(--land)';
}

export function ucdpYear(): string {
  return UCDP.from ? UCDP.from.slice(0, 4) : '';
}

export function ucdpSummary(iso: string): string | null {
  const row = UCDP_BY_ISO.get(iso);
  if (!row) return null;
  return `${ucdpTotal(row).toLocaleString()} deaths in ${ucdpYear()}: ${row.stateBased.toLocaleString()} state-based · ${row.nonState.toLocaleString()} non-state · ${row.oneSided.toLocaleString()} one-sided`;
}

export function ucdpNote(): string {
  return UCDP.available && UCDP.from ? `Best-estimate deaths in organised violence during ${ucdpYear()} (GED ${UCDP.version}), fetched ${formatDate(UCDP.fetchedAt)}.` : 'UCDP layer unavailable: token not configured.';
}

/** Dossier section: deaths by UCDP violence type. Null until the build has a token. */
export function ucdpDossier(iso: string): DossierExtra | null {
  const row = UCDP_BY_ISO.get(iso);
  if (!UCDP.available || !row) return null;
  const keys = (['stateBased', 'nonState', 'oneSided'] as const).filter((k) => row[k] > 0).sort((a, b) => row[b] - row[a]);
  return {
    id: 'ucdp',
    title: `Organised violence ${ucdpYear()} · ${ucdpTotal(row).toLocaleString()} deaths`,
    rows: keys.map((k) => ({ label: UCDP_TYPE_LABEL[k], value: row[k].toLocaleString(), href: UCDP.source.url })),
    footnote: `${ucdpNote()} ${row.events.toLocaleString()} events.`,
  };
}
