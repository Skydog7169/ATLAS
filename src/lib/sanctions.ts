import raw from '../data/sanctions.generated.json';
import type { DossierExtra } from './dossier';
import { formatDate } from './labels';

export type SanctionsAuthority = 'UN' | 'US' | 'EU';

export interface SanctionsRegime {
  authority: SanctionsAuthority;
  name: string;
  url: string;
}

export interface SanctionsRow {
  iso: string;
  regimes: SanctionsRegime[];
}

interface SanctionsFile {
  sources: Array<{ name: string; url: string }>;
  fetchedAt: string;
  unmapped: string[];
  unReview: string[];
  rows: SanctionsRow[];
}

export const SANCTIONS = raw as SanctionsFile;
export const SANCTIONS_BY_ISO: ReadonlyMap<string, SanctionsRow> = new Map(SANCTIONS.rows.map((r) => [r.iso, r]));

export const AUTHORITY_LABEL: Record<SanctionsAuthority, string> = { UN: 'UN Security Council', US: 'United States (OFAC)', EU: 'European Union' };

/** Bins by regime count. Amber ramp: distinct from the red conflict scale, the violet displacement ramp and the cyan bloc scale. */
export const SANCTIONS_BINS = [0, 1, 2, 3, 5] as const;
export const SANCTIONS_COLORS = ['var(--land)', '#4a3a12', '#8a6a1a', '#c99a1f', '#ffd166'] as const;

export function sanctionsBin(count: number): number {
  let bin = 0;
  for (let i = 0; i < SANCTIONS_BINS.length; i++) if (count >= SANCTIONS_BINS[i]!) bin = i;
  return count <= 0 ? 0 : bin;
}

export function sanctionsColor(iso: string): string {
  return SANCTIONS_COLORS[sanctionsBin(SANCTIONS_BY_ISO.get(iso)?.regimes.length ?? 0)] ?? 'var(--land)';
}

export function sanctionsBinLabel(i: number): string {
  const lo = SANCTIONS_BINS[i] ?? 0;
  const hi = SANCTIONS_BINS[i + 1];
  if (i === 0) return 'No country regime';
  if (!hi) return `${lo}+ regimes`;
  return hi - lo === 1 ? `${lo} regime${lo === 1 ? '' : 's'}` : `${lo}–${hi - 1} regimes`;
}

/** Short tooltip line: "UN · US · EU×3". */
export function sanctionsSummary(iso: string): string | null {
  const row = SANCTIONS_BY_ISO.get(iso);
  if (!row) return null;
  const counts = new Map<SanctionsAuthority, number>();
  for (const r of row.regimes) counts.set(r.authority, (counts.get(r.authority) ?? 0) + 1);
  return (['UN', 'US', 'EU'] as const)
    .filter((a) => counts.has(a))
    .map((a) => (counts.get(a)! > 1 ? `${a}×${counts.get(a)}` : a))
    .join(' · ');
}

export function sanctionsDossier(iso: string): DossierExtra | null {
  const row = SANCTIONS_BY_ISO.get(iso);
  return {
    id: 'sanctions',
    title: `Sanctions · ${row?.regimes.length ?? 0}`,
    rows: (row?.regimes ?? []).map((r) => ({ label: r.name, value: r.authority, href: r.url })),
    empty: 'No UN, US or EU regime targets this country.',
    footnote: `OFAC, EU Sanctions Map and UN Security Council regimes, fetched ${formatDate(SANCTIONS.fetchedAt)}.`,
  };
}
