import type { Intensity } from '../data/types';
import type { ChangeItem, Delta } from './history';
import { severity } from './history';
import { INTENSITY_COLOR } from './labels';
import { UNREST_COLOR } from './unrest';

/** Short level names for tags, where the kind word already says what is being measured. */
export const LEVEL: Record<Intensity, string> = { high: 'High', medium: 'Medium', low: 'Low', latent: 'Latent' };

/** Unrest items use the violet ramp, conflicts the conflict palette, membership events their bloc colour. */
export function itemColor(it: Pick<ChangeItem, 'kind' | 'intensity' | 'color'>): string | undefined {
  if (!it.intensity) return it.color;
  return it.kind === 'unrest' ? UNREST_COLOR[it.intensity] : INTENSITY_COLOR[it.intensity];
}

/** 'Conflict · High', 'Unrest · High' or 'Membership'. */
export function kindTag(it: Pick<ChangeItem, 'kind' | 'intensity'>): string {
  if (!it.intensity) return 'Membership';
  return `${it.kind === 'unrest' ? 'Unrest' : 'Conflict'} · ${LEVEL[it.intensity]}`;
}

const lower = (i: Intensity) => LEVEL[i].toLowerCase();

/** The worded change: '▲ Escalated · low → medium', '▼ Eased · high → latent', 'New', 'No change'; empty for membership events. */
export function deltaTag(it: Pick<ChangeItem, 'delta' | 'prev' | 'intensity'>): string {
  const step = it.prev && it.intensity ? ` · ${lower(it.prev)} → ${lower(it.intensity)}` : '';
  switch (it.delta) {
    case 'new':
      return 'New';
    case 'up':
      return `▲ Escalated${step}`;
    case 'down':
      return `▼ Eased${step}`;
    case 'same':
      return 'No change';
    default:
      return '';
  }
}

/** One-word form for tight spaces such as the ticker. */
export function deltaWord(delta: Delta): string {
  return delta === 'new' ? 'New' : delta === 'up' ? '▲ Escalated' : delta === 'down' ? '▼ Eased' : '';
}

export interface ChangeGroup {
  delta: Delta;
  title: string;
  items: ChangeItem[];
}

const GROUPS: Array<{ delta: Delta; title: string }> = [
  { delta: 'new', title: 'New' },
  { delta: 'up', title: 'Escalated' },
  { delta: 'down', title: 'Eased' },
  { delta: 'membership', title: 'Membership' },
  { delta: 'same', title: 'Re-assessed, no change' },
];

/** Splits a feed into New / Escalated / Eased / Membership / Re-assessed, most severe first within each; empty groups are dropped. */
export function groupChanges(items: readonly ChangeItem[]): ChangeGroup[] {
  return GROUPS.map((g) => ({ ...g, items: items.filter((it) => it.delta === g.delta).sort((a, b) => severity(b) - severity(a) || b.date.localeCompare(a.date) || a.title.localeCompare(b.title)) })).filter((g) => g.items.length > 0);
}

/** 'Oct 19' for a YYYY-MM-DD date. */
export function shortDay(iso: string): string {
  return new Date(iso.slice(0, 10) + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
