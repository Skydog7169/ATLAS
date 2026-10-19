import { BLOCS } from '../data/blocs';
import { CONFLICTS } from '../data/conflicts';
import type { Bloc, BlocMember, Conflict } from '../data/types';
import { ELECTIONS_BY_ISO, electionSummary } from './elections';
import { NUCLEAR_BY_ISO, NUCLEAR_STATUS_LABEL } from './nuclear';
import { PRESENCE_ACTIVE, type Presence } from './military';
import { SANCTIONS_BY_ISO, type SanctionsRegime } from './sanctions';
import { TRADE_BY_ISO, exportShare } from './trade';
import { SUPPORT_LABEL } from './actors';

export interface SharedBloc {
  bloc: Bloc;
  a: BlocMember;
  b: BlocMember;
}

export interface ConflictLink {
  conflict: Conflict;
  /** How the pair meets in this conflict. */
  how: 'both-parties' | 'a-backs' | 'b-backs';
  detail: string;
}

export interface SanctionLink {
  /** The sanctioning side. */
  from: string;
  to: string;
  regimes: SanctionsRegime[];
}

export interface Relationship {
  a: string;
  b: string;
  sharedBlocs: SharedBloc[];
  conflicts: ConflictLink[];
  sanctions: SanctionLink[];
  presence: { aInB: Presence[]; bInA: Presence[] };
  trade: { aToB: number | null; bToA: number | null; yearA: number | null; yearB: number | null };
  nuclear: { a: string | null; b: string | null };
  elections: { a: string | null; b: string | null };
}

const EU27 = new Set(['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE']);

/** Regimes `from` applies to `to`: the US's own programmes, or the EU's when `from` is a member. */
function sanctionsBetween(from: string, to: string): SanctionsRegime[] {
  const row = SANCTIONS_BY_ISO.get(to);
  if (!row) return [];
  if (from === 'USA') return row.regimes.filter((r) => r.authority === 'US');
  if (EU27.has(from)) return row.regimes.filter((r) => r.authority === 'EU');
  return [];
}

function conflictLinks(a: string, b: string): ConflictLink[] {
  const out: ConflictLink[] = [];
  for (const c of CONFLICTS) {
    const inA = c.countries.includes(a);
    const inB = c.countries.includes(b);
    if (inA && inB) {
      out.push({ conflict: c, how: 'both-parties', detail: 'Both are parties on the map' });
      continue;
    }
    for (const actor of c.actors ?? []) {
      for (const backer of actor.backers ?? []) {
        if (backer.iso === a && (inB || actor.iso === b)) out.push({ conflict: c, how: 'a-backs', detail: `${SUPPORT_LABEL[backer.support]} for ${actor.name}` });
        else if (backer.iso === b && (inA || actor.iso === a)) out.push({ conflict: c, how: 'b-backs', detail: `${SUPPORT_LABEL[backer.support]} for ${actor.name}` });
      }
    }
  }
  return out;
}

export function relationship(a: string, b: string, now: Date = new Date()): Relationship {
  const sharedBlocs: SharedBloc[] = [];
  for (const bloc of BLOCS) {
    const ma = bloc.members.find((m) => m.iso === a);
    const mb = bloc.members.find((m) => m.iso === b);
    if (ma && mb) sharedBlocs.push({ bloc, a: ma, b: mb });
  }
  const sanctions: SanctionLink[] = [];
  const ab = sanctionsBetween(a, b);
  const ba = sanctionsBetween(b, a);
  if (ab.length) sanctions.push({ from: a, to: b, regimes: ab });
  if (ba.length) sanctions.push({ from: b, to: a, regimes: ba });
  const nuc = (iso: string) => {
    const r = NUCLEAR_BY_ISO.get(iso);
    return r ? NUCLEAR_STATUS_LABEL[r.status] : null;
  };
  return {
    a,
    b,
    sharedBlocs,
    conflicts: conflictLinks(a, b),
    sanctions,
    presence: { aInB: PRESENCE_ACTIVE.filter((p) => p.operator === a && p.host === b), bInA: PRESENCE_ACTIVE.filter((p) => p.operator === b && p.host === a) },
    trade: { aToB: exportShare(a, b), bToA: exportShare(b, a), yearA: TRADE_BY_ISO.get(a)?.year ?? null, yearB: TRADE_BY_ISO.get(b)?.year ?? null },
    nuclear: { a: nuc(a), b: nuc(b) },
    elections: { a: ELECTIONS_BY_ISO.has(a) ? electionSummary(a, now) : null, b: ELECTIONS_BY_ISO.has(b) ? electionSummary(b, now) : null },
  };
}

/** Rough one-line verdict for the panel head. */
export function relationshipSummary(r: Relationship): string {
  const parts: string[] = [];
  if (r.sharedBlocs.length) parts.push(`${r.sharedBlocs.length} shared bloc${r.sharedBlocs.length === 1 ? '' : 's'}`);
  if (r.conflicts.length) parts.push(`${r.conflicts.length} conflict link${r.conflicts.length === 1 ? '' : 's'}`);
  if (r.sanctions.length) parts.push('sanctions in force');
  if (r.presence.aInB.length || r.presence.bInA.length) parts.push('military presence');
  return parts.length ? parts.join(' · ') : 'No tracked ties';
}
