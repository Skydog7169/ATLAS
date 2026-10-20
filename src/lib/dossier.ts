import { BLOC_BY_ID, blocsForCountry } from '../data/blocs';
import { INTENSITY_ORDER, conflictsForCountry } from '../data/conflicts';
import type { Bloc, BlocMember, Conflict, CountryRecord, Intensity } from '../data/types';
import { COUNTRY_BY_ISO } from './countries';
import { DISPLACEMENT_BY_ISO, type DisplacementRow } from './displacement';
import { CHANGES, changesForCountry } from './feed';
import type { ChangeItem } from './history';
import { WORLDBANK_BY_ISO, type WorldBankRow } from './worldbank';
import { sanctionsDossier } from './sanctions';
import { electionsDossier } from './elections';
import { nuclearDossier } from './nuclear';
import { mediationDossier, sponsorshipDossier } from './actors';
import { militaryDossier } from './military';
import { tradeDossier } from './trade';
import { unrestDossier } from './unrest';
import { acledDossier } from './acled';
import { ucdpDossier } from './ucdp';
import { isTheatre } from './theatre';

export type DossierSectionId = 'profile' | 'memberships' | 'conflicts' | 'unrest' | 'acled' | 'ucdp' | 'sponsorship' | 'mediation' | 'military' | 'displacement' | 'figures' | 'trade' | 'changes' | 'sanctions' | 'elections' | 'nuclear';

/**
 * A section contributed by a later dataset (sanctions, elections). Each row is
 * a label, a value and an optional link, so new data lands in the dossier
 * without touching the panel component.
 */
export interface DossierExtra {
  id: Extract<DossierSectionId, 'sanctions' | 'elections' | 'nuclear' | 'sponsorship' | 'mediation' | 'military' | 'trade' | 'unrest' | 'acled' | 'ucdp'>;
  title: string;
  /** A row links out (`href`), into a conflict panel (`conflictId`), an unrest panel (`unrestId`) or a country dossier (`countryIso`). */
  rows: Array<{ label: string; value: string; href?: string; note?: string; conflictId?: string; unrestId?: string; countryIso?: string; intensity?: Intensity; share?: number }>;
  /** Shown when `rows` is empty. */
  empty?: string;
  /** A second, titled list under the first (sanctions regimes filed under a country but aimed at others). */
  secondary?: { title: string; rows: DossierExtra['rows'] };
  /** Source and fetch date shown under the section. */
  footnote?: string;
}

export type DossierProvider = (iso: string) => DossierExtra | null;

/**
 * Datasets register a provider here, in display order. A provider returns
 * null to skip the section (nuclear status only exists for a few countries)
 * or an extra with no rows to show its `empty` text.
 */
export const DOSSIER_PROVIDERS: DossierProvider[] = [unrestDossier, acledDossier, ucdpDossier, sponsorshipDossier, mediationDossier, militaryDossier, sanctionsDossier, electionsDossier, nuclearDossier, tradeDossier];

export interface CountryDossier {
  country: CountryRecord;
  memberships: Array<{ bloc: Bloc; membership: BlocMember }>;
  /** Conflicts on its territory or with its forces involved, most intense first. */
  conflicts: Conflict[];
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
  // Latest changes sit right after conflicts: the newest developments come before the background datasets.
  const sections: DossierSectionId[] = ['profile', 'memberships', 'conflicts', 'changes', ...extras.map((e) => e.id), 'displacement', 'figures'];
  return {
    country,
    memberships,
    conflicts,
    displacement: DISPLACEMENT_BY_ISO.get(iso) ?? null,
    figures: WORLDBANK_BY_ISO.get(iso) ?? null,
    changes: changesForCountry(feed, iso).slice(0, CHANGES_SHOWN),
    extras,
    sections,
  };
}

/**
 * Curated wording for entities whose name, capital or status is itself in
 * dispute. The world-countries dataset encodes one side's view (Taiwan and
 * Palestine as "territories", Western Sahara under the SADR's name, Jerusalem
 * as Israel's capital without qualification); these overrides state the
 * status neutrally. About > Disputed territories explains the rule.
 */
export const DISPUTED: Readonly<Record<string, { official?: string; capital?: string; status?: string }>> = {
  TWN: { status: 'Self-governing; claimed by the PRC; not a UN member' },
  PSE: { capital: 'Administrative seat: Ramallah (claims East Jerusalem)', status: 'UN non-member observer state' },
  UNK: { status: 'Partially recognised; not a UN member' },
  ESH: { official: 'Western Sahara', capital: 'Largest city: El Aaiún (Laayoune)', status: 'Non-self-governing territory (UN list); claimed by Morocco and the SADR' },
  ISR: { capital: 'Capital: Jerusalem (status disputed; most embassies in Tel Aviv)' },
};

export function isDisputed(iso: string): boolean {
  return iso in DISPUTED;
}

/**
 * Dossier intensity badges: the most intense conflict fought on the country's
 * soil, and separately the most intense one its forces join abroad, so the US
 * and Ukraine never share an unqualified 'High' badge. `conflicts` is sorted
 * most intense first.
 */
export function conflictBadges(iso: string, conflicts: readonly Conflict[]): Array<{ label: string; intensity: Conflict['intensity'] }> {
  const out: Array<{ label: string; intensity: Conflict['intensity'] }> = [];
  const home = conflicts.find((c) => isTheatre(c, iso));
  const abroad = conflicts.find((c) => !isTheatre(c, iso));
  if (home) out.push({ label: 'Conflict at home', intensity: home.intensity });
  if (abroad) out.push({ label: 'Party abroad', intensity: abroad.intensity });
  return out;
}

/** Headline blocs readers check first; the dossier names those a country has no listed tie to (a candidacy or partnership is shown as its own row). */
export const HEADLINE_BLOCS = ['nato', 'eu', 'brics', 'sco', 'g7'];

export function notMemberOf(iso: string): string[] {
  return HEADLINE_BLOCS.map((id) => BLOC_BY_ID.get(id))
    .filter((b): b is Bloc => !!b && !b.members.some((m) => m.iso === iso))
    .map((b) => b.shortName);
}

/** Human line for the profile section: "Republic of X · Capital: Y · UN member". */
export function profileLine(c: CountryRecord): string {
  const o = DISPUTED[c.cca3];
  const official = o?.official ?? c.official;
  const parts = official && official !== c.name ? [official] : [];
  if (o?.capital) parts.push(o.capital);
  else if (c.capital) parts.push(`Capital: ${c.capital}`);
  parts.push(o?.status ?? (c.unMember ? 'UN member' : c.independent ? 'Not a UN member' : 'Territory'));
  return parts.join(' · ');
}
