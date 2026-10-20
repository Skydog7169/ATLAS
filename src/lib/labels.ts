import type { BlocCategory, BlocChangeKind, Confidence, ConflictType, Intensity, MembershipStatus } from '../data/types';

export const CONFLICT_TYPE_LABEL: Record<ConflictType, string> = {
  interstate: 'Interstate',
  'civil-war': 'Civil war',
  insurgency: 'Insurgency',
  asymmetric: 'State vs. armed group',
  'criminal-violence': 'Criminal violence',
  flashpoint: 'Flashpoint',
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  high: 'High intensity',
  medium: 'Medium intensity',
  low: 'Low intensity',
  latent: 'Latent (standoff or ceasefire)',
};

/** What each conflict intensity step means; the research pass uses the same scale. */
export const INTENSITY_DEF: Record<Intensity, string> = {
  high: 'Large-scale, sustained combat',
  medium: 'Regular deadly fighting',
  low: 'Sporadic violence',
  latent: 'Ceasefire or armed standoff; little or no fighting',
};

/** Unrest uses the same four steps for scale of mobilisation and lethality of the response, so it gets its own words. */
export const UNREST_INTENSITY_LABEL: Record<Intensity, string> = {
  high: 'High intensity',
  medium: 'Medium intensity',
  low: 'Low intensity',
  latent: 'Subsided',
};

export const UNREST_INTENSITY_DEF: Record<Intensity, string> = {
  high: 'Nationwide mass mobilisation with lethal force, or the government’s survival in question',
  medium: 'Sustained or recurring protests or riots with violence, or a coup consolidating',
  low: 'Sporadic, localised or largely peaceful',
  latent: 'Suppressed or dormant but unresolved',
};

export const CONFIDENCE_DEF: Record<Confidence, string> = {
  high: 'Corroborated by two or more independent outlets',
  medium: 'A single strong source, or reports that conflict',
  low: 'Thin or contested reporting',
};

/** Sequential scale: colour carries intensity, so shape and label repeat it for colour-blind users. */
export const INTENSITY_COLOR: Record<Intensity, string> = {
  high: '#ff3b3b',
  medium: '#ff9a2e',
  low: '#ffd84a',
  latent: '#6f8aa6',
};

export const INTENSITY_RADIUS: Record<Intensity, number> = { high: 9, medium: 7, low: 5.5, latent: 4.5 };

export const STATUS_LABEL: Record<MembershipStatus, string> = {
  member: 'Member',
  suspended: 'Suspended',
  frozen: 'Participation frozen',
  partner: 'Partner / associate',
  observer: 'Observer',
  invited: 'Invited',
};

export const CATEGORY_LABEL: Record<BlocCategory, string> = {
  security: 'Security',
  economic: 'Economic',
  political: 'Political',
  regional: 'Regional',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 2026". Fixed en-GB style so the date reads the same in every browser locale and matches the prose. */
export function formatMonth(yyyyMm: string): string {
  const [y, mo] = yyyyMm.split('-').map(Number);
  if (!y || !mo || mo > 12) return yyyyMm;
  return `${MONTHS[mo - 1]} ${y}`;
}

/** "19 Oct 2026"; a YYYY-MM value falls back to the month. */
export function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatMonth(iso);
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

/** "19 Oct": the header readout, where the year is implied. */
export function formatDayMonth(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatMonth(iso);
  const [, mo, d] = iso.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[mo - 1]}`;
}

/** Whole days from `date` (YYYY-MM-DD or YYYY-MM) to `today`. */
export function ageInDays(date: string, today: string = new Date().toISOString().slice(0, 10)): number {
  const from = Date.parse((date.length === 7 ? date + '-01' : date.slice(0, 10)) + 'T00:00:00Z');
  const to = Date.parse(today + 'T00:00:00Z');
  return Number.isNaN(from) || Number.isNaN(to) ? 0 : Math.max(0, Math.round((to - from) / 86400000));
}

/** "today", "1 day ago", "12 days ago", "3 months ago". */
export function relativeAge(date: string, today?: string): string {
  const days = ageInDays(date, today);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

/** Entries older than this many days get a "May be out of date" chip; chokepoints move faster. */
export const STALE_DAYS = { assessment: 14, chokepoint: 7 } as const;

export function isStale(date: string, kind: keyof typeof STALE_DAYS, today?: string): boolean {
  return ageInDays(date, today) > STALE_DAYS[kind];
}

/**
 * The four freshness verbs used everywhere: text changed, re-checked with no
 * change, pulled from an API, maintained by hand.
 */
export const FRESHNESS = {
  updated: (date: string) => `Updated ${formatDate(date)}`,
  checked: (date: string) => `Checked ${formatDate(date)}, no change`,
  fetched: (date: string) => `Data fetched ${formatDate(date)}`,
  curated: (date: string) => `Curated ${formatDate(date)}`,
} as const;

export const CHANGE_LABEL: Record<BlocChangeKind, string> = {
  joined: 'Joined',
  left: 'Left',
  suspended: 'Suspended',
  reinstated: 'Reinstated',
  frozen: 'Froze participation',
  invited: 'Invited',
  founded: 'Founding member',
};
