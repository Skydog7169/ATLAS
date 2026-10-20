import raw from '../data/leaders.generated.json';
import type { DossierExtra } from './dossier';
import { formatDate } from './labels';

export type OfficeRole = 'state' | 'government' | 'both';
/** Wikipedia's colour key: green cells administer the executive constitutionally, blue cells run it de facto. */
export type OfficePower = 'executive' | 'de-facto';

export interface Officeholder {
  name: string;
  /** English Wikipedia article title with underscores. */
  wiki?: string;
  /** Position within a collective body ("Vice President", "Serb member"). */
  role?: string;
  /** Designated or elected but not yet in office. */
  incoming?: boolean;
  /** YYYY-MM-DD the person took this office, from Wikidata. */
  since?: string;
  party?: string;
}

export interface Office {
  role: OfficeRole;
  title: string;
  power?: OfficePower;
  /** Acting, interim, transitional, or a representative of the holder. */
  acting?: boolean;
  vacant?: boolean;
  /** A council or presidency rather than one person. */
  collective?: boolean;
  people: Officeholder[];
}

export interface LeadersRow {
  iso: string;
  offices: Office[];
}

interface LeadersFile {
  source: { name: string; url: string };
  enrichment: { name: string; url: string };
  fetchedAt: string;
  rows: LeadersRow[];
}

export const LEADERS = raw as LeadersFile;
export const LEADERS_BY_ISO: ReadonlyMap<string, LeadersRow> = new Map(LEADERS.rows.map((r) => [r.iso, r]));

export const ROLE_LABEL: Record<OfficeRole, string> = { state: 'Head of state', government: 'Head of government', both: 'Head of state and government' };

export function wikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title).replace(/%2F/g, '/')}`;
}

/**
 * The office that holds power: a de facto ruler outranks the constitutional
 * executive (a party general secretary over a premier, an acting president
 * over a captured one), which outranks a ceremonial head. Incoming holders
 * never count.
 */
export function powerOffice(iso: string): { office: Office; person: Officeholder | null } | null {
  const row = LEADERS_BY_ISO.get(iso);
  if (!row?.offices.length) return null;
  const office = row.offices.find((o) => o.power === 'de-facto') ?? row.offices.find((o) => o.power === 'executive') ?? row.offices[0]!;
  const person = office.collective ? null : (office.people.find((p) => !p.incoming) ?? null);
  return { office, person };
}

/** Whole years between a YYYY-MM-DD date and now; fractional for under a year. */
export function yearsSince(date: string, now: Date = new Date()): number {
  const [y, m = 1, d = 1] = date.split('-').map(Number) as [number, number?, number?];
  return (now.getTime() - Date.UTC(y, (m ?? 1) - 1, d ?? 1)) / (365.25 * 86400000);
}

export function tenureLabel(years: number): string {
  if (years < 1) {
    const months = Math.max(0, Math.floor(years * 12));
    return months <= 1 ? 'under 2 months' : `${months} months`;
  }
  const whole = Math.floor(years);
  return whole === 1 ? '1 year' : `${whole} years`;
}

/** Upper bounds (exclusive) in years; bin 0 is "no date", the last bin is open-ended. */
export const TENURE_BINS = [2, 5, 10, 20] as const;
/** Magenta ramp, brightest for the longest in power: distinct from every other layer's hue. */
export const TENURE_COLORS = ['var(--land)', '#3d1838', '#6e2463', '#a8368f', '#e052bd', '#ff9be6'] as const;

export function tenureBin(years: number | null): number {
  if (years === null || years < 0) return 0;
  for (let i = 0; i < TENURE_BINS.length; i++) if (years < TENURE_BINS[i]!) return i + 1;
  return TENURE_BINS.length + 1;
}

export function tenureBinLabel(i: number): string {
  if (i === 0) return 'No start date or collective rule';
  const hi = TENURE_BINS[i - 1];
  const lo = TENURE_BINS[i - 2];
  if (hi === undefined) return `${TENURE_BINS.at(-1)}+ years`;
  return lo === undefined ? `Under ${hi} years` : `${lo}–${hi} years`;
}

export function tenureYears(iso: string, now: Date = new Date()): number | null {
  const since = powerOffice(iso)?.person?.since;
  return since ? yearsSince(since, now) : null;
}

export function leaderColor(iso: string, now: Date = new Date()): string {
  return TENURE_COLORS[tenureBin(tenureYears(iso, now))] ?? 'var(--land)';
}

/** Tooltip line: "President Vladimir Putin · since 7 May 2012 (14 years)". */
export function leaderSummary(iso: string, now: Date = new Date()): string | null {
  const p = powerOffice(iso);
  if (!p) return null;
  if (!p.person) return p.office.vacant ? `${p.office.title}: vacant` : `${p.office.title} (collective)`;
  const since = p.person.since ? ` · since ${formatDate(p.person.since)} (${tenureLabel(yearsSince(p.person.since, now))})` : '';
  return `${p.office.title} ${p.person.name}${since}`;
}

function personLine(o: Office, p: Officeholder, now: Date): string {
  const bits = [p.party, p.role, p.since ? `since ${formatDate(p.since)} · ${tenureLabel(yearsSince(p.since, now))}` : null, p.incoming ? 'incoming' : null];
  return bits.filter(Boolean).join(' · ') || (o.acting ? 'acting' : '');
}

export function leadersDossier(iso: string, now: Date = new Date()): DossierExtra | null {
  const row = LEADERS_BY_ISO.get(iso);
  if (!row) return null;
  const top = powerOffice(iso)?.office;
  const rows: DossierExtra['rows'] = [];
  for (const o of row.offices) {
    const marker = o === top ? 'holds power' : o.power === 'executive' ? 'constitutional executive' : o.power === 'de-facto' ? 'de facto executive' : '';
    const value = [ROLE_LABEL[o.role], marker].filter(Boolean).join(' · ');
    if (!o.people.length) {
      rows.push({ label: o.vacant ? `${o.title}: vacant` : o.title, value, note: o.collective ? 'Collective body' : undefined });
      continue;
    }
    // A council lists its members as one row each under the body's title.
    for (const p of o.people) {
      rows.push({
        label: o.collective ? `${o.title}: ${p.name}` : `${o.title} ${p.name}`,
        value,
        href: p.wiki ? wikiUrl(p.wiki) : undefined,
        note: personLine(o, p, now) || undefined,
      });
    }
  }
  return {
    id: 'leaders',
    title: 'Government',
    rows,
    footnote: `Officeholders and executive marking: ${LEADERS.source.name.replace(/^Wikipedia: /, 'Wikipedia, ')}; start dates and parties from Wikidata; fetched ${formatDate(LEADERS.fetchedAt)}.`,
  };
}

/** Every named officeholder, for search: "Putin" finds Russia. */
export function leaderIndex(): Array<{ iso: string; name: string; title: string }> {
  const out: Array<{ iso: string; name: string; title: string }> = [];
  for (const r of LEADERS.rows) for (const o of r.offices) if (!o.collective) for (const p of o.people) out.push({ iso: r.iso, name: p.name, title: o.title });
  return out;
}
