import type { BlocCategory, ConflictType, Intensity, MembershipStatus } from '../data/types';

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
  latent: 'Latent / ceasefire',
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

export function formatMonth(yyyyMm: string): string {
  const [y, mo] = yyyyMm.split('-').map(Number);
  if (!y || !mo) return yyyyMm;
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
