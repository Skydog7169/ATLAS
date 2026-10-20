import { INTENSITY_ORDER } from '../data/conflicts';
import type { Conflict, ConflictInput, Intensity, Iso3 } from '../data/types';

/** States on whose territory a conflict is fought; `countries` when the entry names no theatre. */
export function theatreOf(c: Pick<ConflictInput, 'countries' | 'theatre'>): Iso3[] {
  return c.theatre ?? c.countries;
}

/** Parties to a conflict that fight it outside their own territory. */
export function partiesAbroad(c: Pick<ConflictInput, 'countries' | 'theatre'>): Iso3[] {
  const home = new Set(theatreOf(c));
  return c.countries.filter((iso) => !home.has(iso));
}

export function isTheatre(c: Pick<ConflictInput, 'countries' | 'theatre'>, iso: Iso3): boolean {
  return theatreOf(c).includes(iso);
}

export interface ConflictFillMaps {
  /** Most intense conflict fought on each country's territory. */
  home: Map<Iso3, Intensity>;
  /** Most intense conflict each country is party to abroad, for countries with no conflict at home. */
  abroad: Map<Iso3, Intensity>;
}

function raise(map: Map<Iso3, Intensity>, iso: Iso3, intensity: Intensity) {
  const cur = map.get(iso);
  if (!cur || INTENSITY_ORDER[intensity] > INTENSITY_ORDER[cur]) map.set(iso, intensity);
}

/**
 * Splits the Conflicts-mode tint into the two things it can mean: fighting on
 * a country's own soil (filled) and a country's forces fighting elsewhere
 * (outlined). A country with any conflict at home is filled by that alone.
 */
export function conflictFillMaps(visible: ReadonlyArray<{ conflict: Pick<Conflict, 'countries' | 'theatre'>; intensity: Intensity }>): ConflictFillMaps {
  const home = new Map<Iso3, Intensity>();
  const abroad = new Map<Iso3, Intensity>();
  for (const { conflict, intensity } of visible) {
    for (const iso of theatreOf(conflict)) raise(home, iso, intensity);
    for (const iso of partiesAbroad(conflict)) raise(abroad, iso, intensity);
  }
  for (const iso of home.keys()) abroad.delete(iso);
  return { home, abroad };
}
