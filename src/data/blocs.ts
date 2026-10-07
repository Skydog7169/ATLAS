import raw from './blocs.json';
import type { Bloc, BlocMember } from './types';

/** Alliances and organisations, loaded from blocs.json (edited by the research script). */
export const BLOCS: Bloc[] = (raw as Bloc[]).map((b) => ({
  ...b,
  changes: [...b.changes].sort((a, c) => c.date.localeCompare(a.date)),
}));

export const BLOC_BY_ID: ReadonlyMap<string, Bloc> = new Map(BLOCS.map((b) => [b.id, b]));

/** Blocs a country belongs to (any status), in display order. */
export function blocsForCountry(iso: string): Array<{ bloc: Bloc; membership: BlocMember }> {
  const out: Array<{ bloc: Bloc; membership: BlocMember }> = [];
  for (const bloc of BLOCS) {
    const membership = bloc.members.find((x) => x.iso === iso);
    if (membership) out.push({ bloc, membership });
  }
  return out;
}
