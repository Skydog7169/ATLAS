import { blocsForCountry } from '../data/blocs';
import { INTENSITY_ORDER, conflictsForCountry } from '../data/conflicts';
import type { Bloc, BlocMember, Conflict, CountryRecord } from '../data/types';
import { COUNTRY_BY_ISO } from './countries';
import { DISPLACEMENT_BY_ISO, type DisplacementRow } from './displacement';
import { CHANGES, changesForCountry } from './feed';
import type { ChangeItem } from './history';
import { WORLDBANK_BY_ISO, type WorldBankRow } from './worldbank';
import { sanctionsDossier } from './sanctions';
import { electionsDossier } from './elections';
import { nuclearDossier } from './nuclear';
import { sponsorshipDossier } from './actors';
import { militaryDossier } from './military';
import { tradeDossier } from './trade';
import { unrestDossier } from './unrest';
import { acledDossier } from './acled';
import { ucdpDossier } from './ucdp';
import { leadersDossier } from './leaders';

export type DossierSectionId = 'profile' | 'leaders' | 'memberships' | 'conflicts' | 'unrest' | 'acled' | 'ucdp' | 'sponsorship' | 'military' | 'displacement' | 'figures' | 'trade' | 'changes' | 'sanctions' | 'elections' | 'nuclear';

/**
 * A section contributed by a later dataset (sanctions, elections). Each row is
 * a label, a value and an optional link, so new data lands in the dossier
 * without touching the panel component.
 */
export interface DossierExtra {
  id: Extract<DossierSectionId, 'leaders' | 'sanctions' | 'elections' | 'nuclear' | 'sponsorship' | 'military' | 'trade' | 'unrest' | 'acled' | 'ucdp'>;
  title: string;
  /** A row links out (`href`), into a conflict panel (`conflictId`), an unrest panel (`unrestId`) or a country dossier (`countryIso`). */
  rows: Array<{ label: string; value: string; href?: string; note?: string; conflictId?: string; unrestId?: string; countryIso?: string }>;
  /** Shown when `rows` is empty. */
  empty?: string;
  /** Source and fetch date shown under the section. */
  footnote?: string;
}

export type DossierProvider = (iso: string) => DossierExtra | null;

/**
 * Datasets register a provider here, in display order. A provider returns
 * null to skip the section (nuclear status only exists for a few countries)
 * or an extra with no rows to show its `empty` text.
 */
export const DOSSIER_PROVIDERS: DossierProvider[] = [unrestDossier, acledDossier, ucdpDossier, sponsorshipDossier, militaryDossier, sanctionsDossier, electionsDossier, nuclearDossier, tradeDossier];

export interface CountryDossier {
  country: CountryRecord;
  memberships: Array<{ bloc: Bloc; membership: BlocMember }>;
  /** Conflicts on its territory or with its forces involved, most intense first. */
  conflicts: Conflict[];
  /** Who heads the state and the government, shown first; null for territories the leaders list does not cover. */
  government: DossierExtra | null;
  displacement: DisplacementRow | null;
  figures: WorldBankRow | null;
  /** Newest feed items about this country. */
  changes: ChangeItem[];
  extras: DossierExtra[];
  /** Sections the panel renders, in order. Always at least the six core sections. */
  sections: DossierSectionId[];
}

export const CHANGES_SHOWN = 8;

export function countryDossier(iso: string, feed: readonly ChangeItem[] = CHANGES): CountryDossier | null {
  const country = COUNTRY_BY_ISO.get(iso);
  if (!country) return null;
  const memberships = blocsForCountry(iso);
  const conflicts = conflictsForCountry(iso).sort((a, b) => INTENSITY_ORDER[b.intensity] - INTENSITY_ORDER[a.intensity] || a.name.localeCompare(b.name));
  const extras: DossierExtra[] = [];
  for (const provide of DOSSIER_PROVIDERS) {
    const extra = provide(iso);
    if (extra) extras.push(extra);
  }
  const government = leadersDossier(iso);
  const sections: DossierSectionId[] = ['profile', ...(government ? ['leaders' as const] : []), 'memberships', 'conflicts', ...extras.map((e) => e.id), 'displacement', 'figures', 'changes'];
  return {
    country,
    memberships,
    conflicts,
    government,
    displacement: DISPLACEMENT_BY_ISO.get(iso) ?? null,
    figures: WORLDBANK_BY_ISO.get(iso) ?? null,
    changes: changesForCountry(feed, iso).slice(0, CHANGES_SHOWN),
    extras,
    sections,
  };
}

/** Human line for the profile section: "Republic of X · Capital: Y · UN member". */
export function profileLine(c: CountryRecord): string {
  const parts = [c.official];
  if (c.capital) parts.push(`Capital: ${c.capital}`);
  parts.push(c.unMember ? 'UN member' : c.independent ? 'Not a UN member' : 'Territory');
  return parts.join(' · ');
}
