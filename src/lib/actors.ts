import { CONFLICTS } from '../data/conflicts';
import type { Actor, Backer, Conflict, SupportKind } from '../data/types';
import { countryName } from './countries';
import type { DossierExtra } from './dossier';
import { INTENSITY_LABEL, formatMonth } from './labels';

export const SUPPORT_LABEL: Record<SupportKind, string> = {
  troops: 'Troops',
  arms: 'Arms',
  funding: 'Funding',
  political: 'Political backing',
  basing: 'Basing or territory',
  intelligence: 'Intelligence',
};

export const PEACE_KIND_LABEL = {
  ceasefire: 'Ceasefire',
  agreement: 'Agreement',
  talks: 'Talks',
  roadmap: 'Roadmap',
  mediation: 'Mediation',
  collapse: 'Setback',
} as const;

/** Sides in declaration order, each with its actors; mediators last. */
export function sides(conflict: Conflict): Array<{ side: string; actors: Actor[] }> {
  const out: Array<{ side: string; actors: Actor[] }> = [];
  for (const a of conflict.actors ?? []) {
    let s = out.find((x) => x.side === a.side);
    if (!s) out.push((s = { side: a.side, actors: [] }));
    s.actors.push(a);
  }
  return out.sort((a, b) => Number(/mediator/i.test(a.side)) - Number(/mediator/i.test(b.side)));
}

export interface Sponsorship {
  conflict: Conflict;
  actor: Actor;
  backer: Backer;
}

/**
 * Conflicts in which a country backs a party on someone else's territory:
 * the backer is a state, and it is not the conflict's primary territory.
 */
export function sponsorsAbroad(iso: string): Sponsorship[] {
  const out: Sponsorship[] = [];
  for (const conflict of CONFLICTS) {
    if (conflict.countries[0] === iso) continue;
    for (const actor of conflict.actors ?? []) {
      for (const backer of actor.backers ?? []) if (backer.iso === iso) out.push({ conflict, actor, backer });
    }
  }
  return out.sort((a, b) => a.conflict.name.localeCompare(b.conflict.name));
}

/** All states that back any party in a conflict, with what they provide. */
export function backersOf(conflict: Conflict): Array<{ iso: string; name: string; support: SupportKind[]; actors: string[] }> {
  const map = new Map<string, { iso: string; name: string; support: Set<SupportKind>; actors: Set<string> }>();
  for (const actor of conflict.actors ?? []) {
    for (const b of actor.backers ?? []) {
      if (!b.iso) continue;
      const cur = map.get(b.iso) ?? { iso: b.iso, name: countryName(b.iso), support: new Set<SupportKind>(), actors: new Set<string>() };
      cur.support.add(b.support);
      cur.actors.add(actor.name);
      map.set(b.iso, cur);
    }
  }
  return [...map.values()].map((x) => ({ iso: x.iso, name: x.name, support: [...x.support], actors: [...x.actors] }));
}

export function sponsorshipDossier(iso: string): DossierExtra | null {
  const rows = sponsorsAbroad(iso);
  if (!rows.length) return null;
  return {
    id: 'sponsorship',
    title: `Backs parties abroad · ${rows.length}`,
    rows: rows.map((r) => ({ label: r.conflict.name, value: INTENSITY_LABEL[r.conflict.intensity], note: `${SUPPORT_LABEL[r.backer.support]} for ${r.actor.name}`, conflictId: r.conflict.id })),
    footnote: `Actor lists reviewed ${formatMonth(rows[0]!.conflict.actorsUpdated ?? rows[0]!.conflict.updated.slice(0, 7))}.`,
  };
}
