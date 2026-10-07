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
}

export type ConflictType =
  | 'interstate'
  | 'civil-war'
  | 'insurgency'
  | 'asymmetric'
  | 'criminal-violence'
  | 'flashpoint';

export type Intensity = 'high' | 'medium' | 'low' | 'latent';

export interface Conflict {
  id: string;
  name: string;
  type: ConflictType;
  intensity: Intensity;
  /** Year the current phase began. */
  since: number;
  /** [longitude, latitude] of the marker. */
  location: [number, number];
  /** States whose territory or forces are directly involved. */
  countries: Iso3[];
  parties: string[];
  summary: string;
  status: string;
  sources: Source[];
  /** Month the entry was last verified, YYYY-MM. */
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
