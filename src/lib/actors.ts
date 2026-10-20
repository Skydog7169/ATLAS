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

/** Hedge for a backer whose support is not documented: 'reportedly', 'alleged', or nothing. */
export function basisWord(b: Pick<Backer, 'basis'>): string {
  return b.basis === 'reported' ? 'reportedly' : b.basis === 'alleged' ? 'alleged' : '';
}

/** "Arms (reportedly)" style label for a backer's support. */
export function supportLabel(b: Pick<Backer, 'support' | 'basis'>): string {
  const w = basisWord(b);
  return w ? `${SUPPORT_LABEL[b.support]} (${w})` : SUPPORT_LABEL[b.support];
}

/** Mediators sit on a 'Mediators' side; they broker talks rather than back a party. */
export function isMediator(a: Pick<Actor, 'side'>): boolean {
  return /mediator/i.test(a.side);
}

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
      if (isMediator(actor)) continue;
      for (const backer of actor.backers ?? []) if (backer.iso === iso) out.push({ conflict, actor, backer });
    }
  }
  return out.sort((a, b) => a.conflict.name.localeCompare(b.conflict.name));
}

/** All states that back any party in a conflict, with what they provide. */
export function backersOf(conflict: Conflict): Array<{ iso: string; name: string; support: SupportKind[]; actors: string[] }> {
  const map = new Map<string, { iso: string; name: string; support: Set<SupportKind>; actors: Set<string> }>();
  for (const actor of conflict.actors ?? []) {
    if (isMediator(actor)) continue;
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
    rows: rows.map((r) => ({ label: r.conflict.name, value: INTENSITY_LABEL[r.conflict.intensity], note: `${supportLabel(r.backer)} for ${r.actor.name}`, conflictId: r.conflict.id })),
    footnote: `Actor lists reviewed ${formatMonth(rows[0]!.conflict.actorsUpdated ?? rows[0]!.conflict.updated.slice(0, 7))}.`,
  };
}

/** Conflicts in which a country is a mediator, either as the mediating actor or as a sponsor of the mediation. */
export function mediatesIn(iso: string): Conflict[] {
  return CONFLICTS.filter((c) => (c.actors ?? []).some((a) => isMediator(a) && (a.iso === iso || (a.backers ?? []).some((b) => b.iso === iso)))).sort((a, b) => a.name.localeCompare(b.name));
}

/** Names of the mediators in a conflict, for the panel's "Mediators:" line. */
export function mediatorNames(conflict: Conflict): string[] {
  const out: string[] = [];
  for (const a of conflict.actors ?? []) {
    if (!isMediator(a)) continue;
    const names = (a.backers ?? []).filter((b) => b.iso).map((b) => countryName(b.iso!));
    out.push(...(names.length ? names : [a.name.replace(/\s*\(mediators?\)\s*$/i, '')]));
  }
  return [...new Set(out)];
}

export function mediationDossier(iso: string): DossierExtra | null {
  const list = mediatesIn(iso);
  if (!list.length) return null;
  return {
    id: 'mediation',
    title: `Mediating · ${list.length}`,
    rows: list.map((c) => ({ label: c.name, value: INTENSITY_LABEL[c.intensity], note: 'Mediator or sponsor of talks', conflictId: c.id })),
  };
}
