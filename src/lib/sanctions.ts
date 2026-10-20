import raw from '../data/sanctions.generated.json';
import type { DossierExtra } from './dossier';
import { formatDate } from './labels';
import { ramp } from './palette';

export type SanctionsAuthority = 'UN' | 'US' | 'EU';

export interface SanctionsRegime {
  authority: SanctionsAuthority;
  name: string;
  url: string;
}

export interface SanctionsRow {
  iso: string;
  /** Regimes that target the country. */
  regimes: SanctionsRegime[];
  /** Regimes filed under the country that protect it and are aimed at others (Russia over Crimea, separatists in Transnistria). */
  concerns?: Array<SanctionsRegime & { aimedAt: string }>;
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

/** Bins by regime count. Gold ramp from palette.ts: distinct from the red conflict scale, the violet displacement ramp and the cyan bloc scale. */
export const SANCTIONS_BINS = [0, 1, 2, 3, 5] as const;
export const SANCTIONS_COLORS = ramp('sanctions');

export function sanctionsBin(count: number): number {
  let bin = 0;
  for (let i = 0; i < SANCTIONS_BINS.length; i++) if (count >= SANCTIONS_BINS[i]!) bin = i;
  return count <= 0 ? 0 : bin;
}

export function sanctionsColor(iso: string): string {
  return SANCTIONS_COLORS[sanctionsBin(SANCTIONS_BY_ISO.get(iso)?.regimes.length ?? 0)] ?? 'var(--land)';
}

/**
 * Comprehensive embargoes: OFAC prohibits virtually all trade and dealings
 * with these countries, which a regime count understates (Cuba has one
 * programme). Drawn hatched over the count colour. Curated; see
 * https://ofac.treasury.gov/faqs/topic/1631 (comprehensive country programmes).
 */
export const COMPREHENSIVE_EMBARGOES: ReadonlySet<string> = new Set(['CUB', 'IRN', 'PRK']);

export function sanctionsFill(iso: string): { fill: string; hatch?: string } {
  const fill = sanctionsColor(iso);
  return COMPREHENSIVE_EMBARGOES.has(iso) ? { fill, hatch: SANCTIONS_COLORS[SANCTIONS_COLORS.length - 1] } : { fill };
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
  if (!row || row.regimes.length === 0) return null;
  const counts = new Map<SanctionsAuthority, number>();
  for (const r of row.regimes) counts.set(r.authority, (counts.get(r.authority) ?? 0) + 1);
  return (['UN', 'US', 'EU'] as const)
    .filter((a) => counts.has(a))
    .map((a) => (counts.get(a)! > 1 ? `${a}×${counts.get(a)}` : a))
    .join(' · ') + (COMPREHENSIVE_EMBARGOES.has(iso) ? ' · comprehensive US embargo' : '');
}

export function sanctionsDossier(iso: string): DossierExtra | null {
  const row = SANCTIONS_BY_ISO.get(iso);
  return {
    id: 'sanctions',
    title: `Sanctions · ${row?.regimes.length ?? 0}`,
    rows: (row?.regimes ?? []).map((r) => ({ label: r.name, value: r.authority, href: r.url })),
    empty: 'No UN, US or EU regime targets this country.',
    secondary: row?.concerns?.length
      ? {
          title: `Regimes concerning this country (aimed at others) · ${row.concerns.length}`,
          rows: row.concerns.map((r) => ({ label: r.name, value: r.authority, href: r.url, note: r.aimedAt })),
        }
      : undefined,
    footnote: `OFAC, EU Sanctions Map and UN Security Council regimes, fetched ${formatDate(SANCTIONS.fetchedAt)}.`,
  };
}
