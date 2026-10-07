import raw from './conflicts.json';
import type { Conflict, ConflictInput } from './types';
import { withCurrent } from '../lib/history';

/**
 * Significant armed conflicts and flashpoints, loaded from conflicts.json so
 * the weekly research script can append assessments without touching code.
 * Each has a `history` of dated, sourced status entries, newest first; the
 * newest entry is surfaced as `intensity`, `status`, `sources` and `updated`.
 */
const CONFLICT_INPUTS = raw as ConflictInput[];

export const CONFLICTS: Conflict[] = CONFLICT_INPUTS.map(withCurrent);

export const CONFLICT_BY_ID: ReadonlyMap<string, Conflict> = new Map(CONFLICTS.map((c) => [c.id, c]));

export function conflictsForCountry(iso: string): Conflict[] {
  return CONFLICTS.filter((c) => c.countries.includes(iso));
}

export const INTENSITY_ORDER: Record<Conflict['intensity'], number> = { high: 3, medium: 2, low: 1, latent: 0 };
