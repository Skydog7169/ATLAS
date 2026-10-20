import { INTENSITY_ORDER } from '../data/conflicts';
import { UNREST, unrestForCountry } from '../data/unrest';
import type { Intensity, UnrestKind } from '../data/types';
import type { DossierExtra } from './dossier';
import { INTENSITY_LABEL, formatDate, formatMonth } from './labels';
import { unrestFillColor } from './palette';

export const UNREST_KIND_LABEL: Record<UnrestKind, string> = {
  protests: 'Protest movement',
  riots: 'Riots',
  uprising: 'Uprising',
  coup: 'Coup',
  mutiny: 'Mutiny',
  crackdown: 'Crackdown',
};

/** Violet ramp, kept apart from the conflict reds and the bloc cyans. */
export const UNREST_COLOR: Record<Intensity, string> = {
  high: '#e04fff',
  medium: '#b06cff',
  low: '#8c8cff',
  latent: '#6f6a9a',
};

export const UNREST_RADIUS: Record<Intensity, number> = { high: 8, medium: 6.5, low: 5, latent: 4.5 };

/** Marker ids on the map are prefixed so clicks can be told apart from conflict markers. */
export const UNREST_MARKER_PREFIX = 'unrest:';

/** Newest `updated` across entries; shown in the legend. */
export const UNREST_VERIFIED = UNREST.map((u) => u.updated).sort().at(-1) ?? '';

export function maxUnrestIntensity(iso: string): Intensity | null {
  let best: Intensity | null = null;
  for (const u of unrestForCountry(iso)) if (!best || INTENSITY_ORDER[u.intensity] > INTENSITY_ORDER[best]) best = u.intensity;
  return best;
}

/** Country tint: a lightness ramp of one violet (palette.ts), so intensity reads without hue. */
export function unrestColor(iso: string): string {
  const i = maxUnrestIntensity(iso);
  return i ? unrestFillColor(i) : 'var(--land)';
}

export function unrestSummary(iso: string): string | null {
  const list = unrestForCountry(iso).sort((a, b) => INTENSITY_ORDER[b.intensity] - INTENSITY_ORDER[a.intensity]);
  return list.length ? list.map((u) => `${u.name} (${INTENSITY_LABEL[u.intensity].toLowerCase()})`).join(' · ') : null;
}

/** Dossier section: unrest episodes on the country's territory, most intense first. */
export function unrestDossier(iso: string): DossierExtra | null {
  const list = unrestForCountry(iso).sort((a, b) => INTENSITY_ORDER[b.intensity] - INTENSITY_ORDER[a.intensity] || a.name.localeCompare(b.name));
  if (!list.length) return null;
  return {
    id: 'unrest',
    title: 'Civil unrest',
    rows: list.map((u) => ({
      label: u.name,
      value: UNREST_KIND_LABEL[u.kind],
      intensity: u.intensity,
      note: `Since ${formatMonth(u.since)} · assessed ${formatDate(u.updated)}`,
      unrestId: u.id,
    })),
    footnote: `Curated, reassessed weekly; newest assessment ${formatDate(UNREST_VERIFIED)}.`,
  };
}
