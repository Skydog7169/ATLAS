import raw from '../data/military.json';
import type { Source } from '../data/types';
import { countryName } from './countries';
import type { DossierExtra } from './dossier';
import { formatDate, formatMonth } from './labels';

export type PresenceKind = 'base' | 'deployment' | 'mission';

export interface Presence {
  host: string;
  operator: string;
  kind: PresenceKind;
  name: string;
  note: string;
  source: Source;
  ended?: string;
}

interface MilitaryFile {
  verified: string;
  sources: Source[];
  presence: Presence[];
}

export const MILITARY = raw as MilitaryFile;
/** Presences in force today; ended rows stay in the file for the record. */
export const PRESENCE_ACTIVE: Presence[] = MILITARY.presence.filter((p) => !p.ended);

export const PRESENCE_KIND_LABEL: Record<PresenceKind, string> = { base: 'Base', deployment: 'Deployment', mission: 'Peace operation' };

const ORG_NAME: Record<string, string> = { UN: 'United Nations', AU: 'African Union', EU: 'European Union', NATO: 'NATO' };

export function operatorName(code: string): string {
  return ORG_NAME[code] ?? countryName(code);
}

const byHost = new Map<string, Presence[]>();
const byOperator = new Map<string, Presence[]>();
for (const p of PRESENCE_ACTIVE) {
  byHost.set(p.host, [...(byHost.get(p.host) ?? []), p]);
  byOperator.set(p.operator, [...(byOperator.get(p.operator) ?? []), p]);
}

export function presencesIn(iso: string): Presence[] {
  return byHost.get(iso) ?? [];
}

export function presencesBy(iso: string): Presence[] {
  return byOperator.get(iso) ?? [];
}

/** Distinct foreign operators present in a country. */
export function operatorsIn(iso: string): string[] {
  return [...new Set(presencesIn(iso).map((p) => p.operator))];
}

export const MILITARY_BINS = [0, 1, 2, 3, 5] as const;
/** Steel-blue ramp, distinct from the cyan bloc overview. */
export const MILITARY_COLORS = ['var(--land)', '#2c3f6b', '#3b5aa0', '#5b84d6', '#9fc0ff'] as const;

export function militaryBin(count: number): number {
  let bin = 0;
  for (let i = 0; i < MILITARY_BINS.length; i++) if (count >= MILITARY_BINS[i]!) bin = i;
  return count <= 0 ? 0 : bin;
}

export function militaryBinLabel(i: number): string {
  const lo = MILITARY_BINS[i] ?? 0;
  const hi = MILITARY_BINS[i + 1];
  if (i === 0) return 'No foreign presence recorded';
  if (!hi) return `${lo}+ foreign operators`;
  return hi - lo === 1 ? `${lo} foreign operator${lo === 1 ? '' : 's'}` : `${lo}–${hi - 1} foreign operators`;
}

export function militaryColor(iso: string): string {
  return MILITARY_COLORS[militaryBin(operatorsIn(iso).length)] ?? 'var(--land)';
}

export function militarySummary(iso: string): string | null {
  const ops = operatorsIn(iso);
  const abroad = presencesBy(iso).length;
  if (!ops.length && !abroad) return null;
  const parts: string[] = [];
  if (ops.length) parts.push(`Hosts: ${ops.map(operatorName).join(', ')}`);
  if (abroad) parts.push(`Deploys abroad: ${new Set(presencesBy(iso).map((p) => p.host)).size} countries`);
  return parts.join(' · ');
}

export function militaryDossier(iso: string): DossierExtra | null {
  const hosted = presencesIn(iso);
  const abroad = presencesBy(iso);
  if (!hosted.length && !abroad.length) return null;
  const rows: DossierExtra['rows'] = [
    ...hosted.map((p) => ({ label: `${operatorName(p.operator)}: ${p.name}`, value: PRESENCE_KIND_LABEL[p.kind], href: p.source.url, note: p.note })),
    ...abroad.map((p) => ({ label: `In ${countryName(p.host)}: ${p.name}`, value: PRESENCE_KIND_LABEL[p.kind], href: p.source.url, note: p.note, countryIso: p.host })),
  ];
  const ended = MILITARY.presence.filter((p) => p.ended && (p.host === iso || p.operator === iso));
  return {
    id: 'military',
    title: `Military presence · ${hosted.length} hosted${abroad.length ? `, ${abroad.length} abroad` : ''}`,
    rows,
    footnote: `Curated, verified ${formatDate(MILITARY.verified)}.${ended.length ? ` Ended: ${ended.map((p) => `${operatorName(p.operator)} in ${countryName(p.host)} (${formatMonth(p.ended!)})`).join('; ')}.` : ''}`,
  };
}
