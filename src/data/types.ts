/** ISO 3166-1 alpha-3 code, e.g. "FRA". Kosovo uses the UN/World Bank "UNK". */
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
  | 'invited';

export interface BlocMember {
  iso: Iso3;
  status: MembershipStatus;
  note?: string;
}

export type BlocChangeKind = 'joined' | 'left' | 'suspended' | 'reinstated' | 'frozen' | 'invited' | 'founded';

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
}

export type ActorType = 'state' | 'armed-group' | 'coalition' | 'international';

export type SupportKind = 'troops' | 'arms' | 'funding' | 'political' | 'basing' | 'intelligence';

/** An outside sponsor of an actor: a state (with ISO code) or a named organisation. */
export interface Backer {
  name: string;
  iso?: Iso3;
  support: SupportKind;
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
  name: string;
  type: ConflictType;
  /** Year the current phase began. */
  since: number;
  /** [longitude, latitude] of the marker. */
  location: [number, number];
  /** States whose territory or forces are directly involved. */
  countries: Iso3[];
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

export interface CountryRecord {
  cca3: Iso3;
  cca2: string;
  ccn3: string | null;
  name: string;
  official: string;
  capital: string | null;
  region: string;
  subregion: string | null;
  latlng: [number, number];
  area: number;
  independent: boolean;
  unMember: boolean;
}
