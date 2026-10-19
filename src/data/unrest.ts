import raw from './unrest.json';
import type { Unrest, UnrestInput } from './types';
import { withCurrent } from '../lib/history';

/**
 * Civil unrest: protest movements, riot waves, uprisings, coups, mutinies
 * and crackdowns that are not armed conflicts. Same dated-history model as
 * conflicts, so the weekly research pass can reassess each entry.
 */
const UNREST_INPUTS = raw as UnrestInput[];

export const UNREST: Unrest[] = UNREST_INPUTS.map(withCurrent);

export const UNREST_BY_ID: ReadonlyMap<string, Unrest> = new Map(UNREST.map((u) => [u.id, u]));

export function unrestForCountry(iso: string): Unrest[] {
  return UNREST.filter((u) => u.countries.includes(iso));
}
