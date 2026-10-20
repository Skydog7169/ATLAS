import type { Bloc, BlocMember } from '../data/types';
import { countryName } from './countries';

/**
 * Dependent territories drawn as their own polygons, and what they inherit
 * from the state that is sovereign over them. Security alliances inherit
 * only where the treaty area covers the territory: NATO's Article 6 reaches
 * Greenland and the Faroes but not Puerto Rico, the Falklands or the Pacific.
 * The EU, trade and elections never inherit (Greenland and the Faroes are
 * outside the EU). The sovereign's nuclear deterrent covers all of them.
 */
export interface Territory {
  sovereign: string;
  /** "Autonomous territory of Denmark". */
  label: string;
  /** Bloc ids whose full membership the territory shares. */
  blocs: string[];
  /** Covered by the sovereign's nuclear deterrent or umbrella. */
  nuclear: boolean;
}

export const SOVEREIGN: Readonly<Record<string, Territory>> = {
  GRL: { sovereign: 'DNK', label: 'Autonomous territory of Denmark', blocs: ['nato'], nuclear: true },
  FRO: { sovereign: 'DNK', label: 'Autonomous territory of Denmark', blocs: ['nato'], nuclear: true },
  PRI: { sovereign: 'USA', label: 'Unincorporated territory of the United States', blocs: [], nuclear: true },
  GUM: { sovereign: 'USA', label: 'Unincorporated territory of the United States', blocs: [], nuclear: true },
  VIR: { sovereign: 'USA', label: 'Unincorporated territory of the United States', blocs: [], nuclear: true },
  ASM: { sovereign: 'USA', label: 'Unincorporated territory of the United States', blocs: [], nuclear: true },
  MNP: { sovereign: 'USA', label: 'Commonwealth in union with the United States', blocs: [], nuclear: true },
  NCL: { sovereign: 'FRA', label: 'Special collectivity of France', blocs: [], nuclear: true },
  ATF: { sovereign: 'FRA', label: 'Overseas territory of France', blocs: [], nuclear: true },
  PYF: { sovereign: 'FRA', label: 'Overseas collectivity of France', blocs: [], nuclear: true },
  FLK: { sovereign: 'GBR', label: 'British Overseas Territory', blocs: [], nuclear: true },
  BMU: { sovereign: 'GBR', label: 'British Overseas Territory', blocs: [], nuclear: true },
};

/**
 * The membership a polygon shows for a bloc: its own if it has one,
 * otherwise its sovereign's full membership where the territory inherits it.
 */
export function memberFor(bloc: Bloc, iso: string): BlocMember | undefined {
  const own = bloc.members.find((m) => m.iso === iso);
  if (own) return own;
  const t = SOVEREIGN[iso];
  if (!t || !t.blocs.includes(bloc.id)) return undefined;
  const m = bloc.members.find((x) => x.iso === t.sovereign && x.status === 'member');
  return m ? { iso, status: 'member', note: `Covered via ${countryName(t.sovereign)}'s membership` } : undefined;
}

/** Dossier and tooltip line: "Autonomous territory of Denmark · covered via Denmark's NATO membership". */
export function territoryLine(iso: string, blocs: readonly Bloc[]): string | null {
  const t = SOVEREIGN[iso];
  if (!t) return null;
  const via = blocs.filter((b) => t.blocs.includes(b.id) && memberFor(b, iso)).map((b) => b.shortName);
  return [t.label, via.length ? `covered via ${countryName(t.sovereign)}'s ${via.join(' and ')} membership` : null].filter(Boolean).join(' · ');
}
