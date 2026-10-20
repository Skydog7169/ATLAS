/**
 * ISO 3166-1 alpha-3 code, e.g. "FRA". Kosovo uses the user-assigned "UNK"
 * (the World Bank uses XKX, and UNHCR uses UNK for "unknown origin"; the
 * build scripts map or drop those).
 */
export type Iso3 = string;

export interface Source {
  name: string;
  url: string;
}

export type BlocCategory = 'security' | 'economic' | 'political' | 'regional';

export type MembershipStatus =
  | 'member'
  | 'suspended'
  | 'frozen'
  | 'partner'
  | 'observer'
  | 'invited'
  /** Accession candidate (EU); not a member, never counted or summed. */
  | 'candidate';

export interface BlocMember {
  iso: Iso3;
  status: MembershipStatus;
  note?: string;
  /** Year the membership (or partner status) began; drives the trend charts. */
  since?: number;
}

/** A past membership spell, for the trend charts. */
export interface FormerMember {
  iso: Iso3;
  since: number;
  until: number;
}

export type BlocChangeKind = 'joined' | 'left' | 'suspended' | 'reinstated' | 'frozen' | 'invited' | 'founded' | 'candidate';

/** One dated membership event, used for the changes feed and the bloc panel. */
export interface BlocChange {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  iso: Iso3;
  change: BlocChangeKind;
  note?: string;
  source?: Source;
}

export interface Bloc {
  id: string;
  name: string;
  shortName: string;
  category: BlocCategory;
  /** Categorical color used for this bloc's members on the map. */
  color: string;
  founded: number;
  headquarters?: string;
  description: string;
  members: BlocMember[];
  sources: Source[];
  /** Month the membership list was last verified, YYYY-MM. */
  updated: string;
  /** Membership events, newest first. */
  changes: BlocChange[];
  former?: FormerMember[];
}

export type ConflictType =
  | 'interstate'
  | 'civil-war'
  | 'insurgency'
  | 'asymmetric'
  | 'criminal-violence'
  | 'flashpoint';

export type Intensity = 'high' | 'medium' | 'low' | 'latent';

export type Confidence = 'high' | 'medium' | 'low';

/** A dated, sourced assessment of a conflict's state. */
export interface HistoryEntry {
  /** ISO date the assessment was verified, YYYY-MM-DD. */
  date: string;
  intensity: Intensity;
  status: string;
  sources: Source[];
  confidence?: Confidence;
  /** Who wrote the text: the research pass ('ai', the default for older entries) or an editor by hand. */
  drafted?: 'ai' | 'editor';
}

export type ActorType = 'state' | 'armed-group' | 'coalition' | 'international';

export type SupportKind = 'troops' | 'arms' | 'funding' | 'political' | 'basing' | 'intelligence';

/** An outside sponsor of an actor: a state (with ISO code) or a named organisation. */
export interface Backer {
  name: string;
  iso?: Iso3;
  support: SupportKind;
  /** Unset means documented; 'reported' and 'alleged' are hedged wherever the backer is shown. */
  basis?: 'documented' | 'reported' | 'alleged';
  source?: Source;
}

/** A party to a conflict, grouped by `side` for the who-backs-whom diagram. */
export interface Actor {
  id: string;
  name: string;
  type: ActorType;
  /** Label shared by actors on the same side; mediators use a 'Mediators' side. */
  side: string;
  iso?: Iso3;
  backers?: Backer[];
}

export type PeaceEventKind = 'ceasefire' | 'agreement' | 'talks' | 'roadmap' | 'mediation' | 'collapse';

/** One dated step in a conflict's peace process, newest first. */
export interface PeaceEvent {
  /** YYYY-MM-DD or YYYY-MM. */
  date: string;
  kind: PeaceEventKind;
  summary: string;
  sources: Source[];
}

/** What the data file declares. The exported Conflict adds the derived current fields. */
export interface ConflictInput {
  id: string;
  /** '<Place>: <conflict noun> (<main armed actor if needed>)', e.g. 'Somalia: insurgency (al-Shabaab)'. */
  name: string;
  /** Earlier names, kept as search aliases. */
  aliases?: string[];
  type: ConflictType;
  /** Year the current phase began. */
  since: number;
  /** [longitude, latitude] of the marker. */
  location: [number, number];
  /** States whose territory or forces are directly involved. */
  countries: Iso3[];
  /**
   * The subset of `countries` on whose territory the fighting takes place.
   * Defaults to `countries` when absent; empty for maritime flashpoints.
   * The map tints theatre states and outlines the rest as parties abroad.
   */
  theatre?: Iso3[];
  parties: string[];
  summary: string;
  /** Structured parties with their outside backers. */
  actors?: Actor[];
  actorsSources?: Source[];
  /** Month the actor list was last reviewed, YYYY-MM. */
  actorsUpdated?: string;
  /** Peace-process events, newest first; maintained by the weekly pass. */
  peace?: PeaceEvent[];
  /** Assessments, newest first. Must have at least one entry. */
  history: HistoryEntry[];
  /** ISO date the entry was last re-checked without a material change, YYYY-MM-DD. */
  lastChecked?: string;
}

export interface Conflict extends ConflictInput {
  /** Mirrors the newest history entry. */
  intensity: Intensity;
  status: string;
  sources: Source[];
  /** ISO date of the newest history entry, YYYY-MM-DD. */
  updated: string;
}

export type UnrestKind = 'protests' | 'riots' | 'uprising' | 'coup' | 'mutiny' | 'crackdown';

/** A curated civil-unrest episode; mirrors unrest.json, validated by UnrestInputSchema. */
export interface UnrestInput {
  id: string;
  name: string;
  kind: UnrestKind;
  /** YYYY-MM the episode began. */
  since: string;
  location: [number, number];
  countries: Iso3[];
  parties: string[];
  trigger: string;
  summary: string;
  history: HistoryEntry[];
  lastChecked?: string;
}

export interface Unrest extends UnrestInput {
  intensity: Intensity;
  status: string;
  sources: Source[];
  updated: string;
}

export interface CountryRecord {
  cca3: Iso3;
  cca2: string;
  ccn3: string | null;
  name: string;
  official: string;
  /** Latin-script alternative spellings from world-countries ("UAE", "Burma"), used by search. */
  alt: string[];
  capital: string | null;
  region: string;
  subregion: string | null;
  latlng: [number, number];
  area: number;
  independent: boolean;
  unMember: boolean;
}
