import raw from '../data/us-states.generated.json';
import { formatDate } from './labels';
import { US_LAYERS, type UsLayer } from './urlState';

export { US_LAYERS, type UsLayer };

export type Party = 'D' | 'R' | 'I';
export type ChamberControl = 'D' | 'R' | 'tied' | 'coalition' | 'shared' | 'nonpartisan';

export interface Governor {
  name: string;
  wiki?: string;
  /** D, R, or O for anyone else. */
  party: 'D' | 'R' | 'O';
  partyName: string;
  since?: string;
  /** Year the current term ends. */
  termEnds?: number;
  /** "term limits" or "retiring": the next race is an open seat. */
  termNote?: string;
}

export interface Member {
  name: string;
  party: Party;
  /** The party an independent caucuses with. */
  caucus?: Party;
  wiki?: string;
}

export interface Senator extends Member {
  class: 1 | 2 | 3;
  since: string;
  /** November of this year decides the seat. */
  nextElection: number;
  special?: true;
  appointed?: true;
  url?: string;
}

export interface Representative extends Member {
  /** 0 for an at-large seat. */
  district: number;
}

export interface Chamber {
  id: 'upper' | 'lower' | 'legislature';
  name: string;
  D: number;
  R: number;
  O: number;
  control: ChamberControl;
}

export interface UsState {
  code: string;
  fips: string;
  name: string;
  governor: Governor | null;
  senators: Senator[];
  houseSeats: number;
  house: Representative[];
  legislature: { unicameral?: boolean; chambers: Chamber[]; note?: string; noteSource?: { name: string; url: string } } | null;
}

interface UsFile {
  sources: Array<{ id: string; name: string; url: string }>;
  fetchedAt: string;
  sourceDates: Record<string, string>;
  states: UsState[];
}

export const US = raw as UsFile;
export const US_STATES = US.states;
export const STATE_BY_CODE: ReadonlyMap<string, UsState> = new Map(US_STATES.map((s) => [s.code, s]));
export const STATE_BY_FIPS: ReadonlyMap<string, UsState> = new Map(US_STATES.map((s) => [s.fips, s]));

export const US_LAYER_LABEL: Record<UsLayer, string> = { governor: 'Governor', legislature: 'Legislature', trifecta: 'Trifecta', senate: 'Senate', house: 'House', ballot: 'On the ballot' };

export const PARTY_COLOR = { D: '#3b82f6', R: '#ef4444', I: '#a78bfa', O: '#a78bfa' } as const;
export const PARTY_NAME = { D: 'Democratic', R: 'Republican', I: 'Independent', O: 'Other' } as const;
const SPLIT = '#8b6fd6';
const NEUTRAL = 'var(--land)';

/** Election day: the Tuesday after the first Monday in November. */
export function electionDay(year: number): string {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay(); // 0 Sunday
  const firstMonday = 1 + ((8 - first) % 7);
  return `${year}-11-${String(firstMonday + 1).padStart(2, '0')}`;
}

/** The next federal general election on or after `now` (even years). */
export function nextFederalElection(now: Date = new Date()): string {
  const today = now.toISOString().slice(0, 10);
  let y = now.getUTCFullYear();
  if (y % 2) y += 1;
  return electionDay(y) >= today ? electionDay(y) : electionDay(y + 2);
}

/**
 * Governor election cycles: a year one election fell in, and the term
 * length. New Hampshire and Vermont elect every two years; Kentucky,
 * Louisiana and Mississippi in odd years before a presidential race; New
 * Jersey and Virginia the year after one. DC's row is the mayor.
 */
const GOV_CYCLE: Record<string, [number, number]> = {
  KY: [2027, 4], LA: [2027, 4], MS: [2027, 4],
  DE: [2028, 4], IN: [2028, 4], MO: [2028, 4], MT: [2028, 4], NC: [2028, 4], ND: [2028, 4], UT: [2028, 4], WA: [2028, 4], WV: [2028, 4],
  NJ: [2029, 4], VA: [2029, 4],
  NH: [2026, 2], VT: [2026, 2],
};

export function nextGovernorElection(code: string, now: Date = new Date()): number {
  const [base, term] = GOV_CYCLE[code] ?? [2026, 4];
  const today = now.toISOString().slice(0, 10);
  let y = now.getUTCFullYear();
  while ((((y - base) % term) + term) % term !== 0 || electionDay(y) < today) y += 1;
  return y;
}

/** The governor's seat is open at the next race when the term that race ends is flagged term-limited or retiring. */
export function openGovernorSeat(s: UsState, now: Date = new Date()): boolean {
  const g = s.governor;
  if (!g?.termNote || !g.termEnds) return false;
  const next = nextGovernorElection(s.code, now);
  return g.termEnds === next || g.termEnds === next + 1;
}

export function caucusOf(m: Member): Party {
  return m.party === 'I' ? (m.caucus ?? 'I') : m.party;
}

export function houseCounts(s: UsState): { D: number; R: number; I: number; vacant: number } {
  const c = { D: 0, R: 0, I: 0, vacant: Math.max(0, s.houseSeats - s.house.length) };
  for (const m of s.house) c[m.party] += 1;
  return c;
}

/** D or R when the governor's party controls every chamber; null for DC. */
export function trifecta(s: UsState): 'D' | 'R' | 'divided' | 'nonpartisan' | null {
  if (!s.legislature || !s.governor) return null;
  if (s.legislature.unicameral) return 'nonpartisan';
  const g = s.governor.party;
  if (g !== 'O' && s.legislature.chambers.every((c) => c.control === g)) return g;
  return 'divided';
}

export const CONTROL_LABEL: Record<ChamberControl, string> = { D: 'Democratic', R: 'Republican', tied: 'Tied', coalition: 'Bipartisan coalition', shared: 'Power-sharing', nonpartisan: 'Nonpartisan' };

/** Both chambers held by one party, split between them, or something else. */
export function legislatureControl(s: UsState): 'D' | 'R' | 'split' | 'other' | null {
  if (!s.legislature) return null;
  const set = new Set(s.legislature.chambers.map((c) => c.control));
  if (set.size === 1 && (set.has('D') || set.has('R'))) return [...set][0] as 'D' | 'R';
  if (set.has('D') && set.has('R') && set.size === 2) return 'split';
  return 'other';
}

/** "D", "R" or "split" by caucus, so Sanders and King count with the Democrats. */
export function senateDelegation(s: UsState): 'D' | 'R' | 'split' | null {
  if (s.senators.length < 2) return null;
  const parties = new Set(s.senators.map(caucusOf));
  if (parties.size === 1) return [...parties][0] === 'R' ? 'R' : 'D';
  return 'split';
}

/** What this state votes on at the next federal election: governor, a Senate seat, always the House. */
export function onBallot(s: UsState, now: Date = new Date()): { governor: boolean; senate: Senator[]; house: boolean; year: number } {
  const year = Number(nextFederalElection(now).slice(0, 4));
  return { year, governor: s.code !== 'DC' && nextGovernorElection(s.code, now) === year, senate: s.senators.filter((x) => x.nextElection === year), house: true };
}

export interface LegendRow {
  color: string;
  label: string;
}

/** Legend rows per layer, in display order. */
export function usLegend(layer: UsLayer): LegendRow[] {
  switch (layer) {
    case 'governor':
      return [
        { color: PARTY_COLOR.D, label: 'Democratic governor' },
        { color: PARTY_COLOR.R, label: 'Republican governor' },
        { color: PARTY_COLOR.O, label: 'Independent or other' },
      ];
    case 'legislature':
      return [
        { color: PARTY_COLOR.D, label: 'Both chambers Democratic' },
        { color: PARTY_COLOR.R, label: 'Both chambers Republican' },
        { color: SPLIT, label: 'Chambers split' },
        { color: '#7a8796', label: 'Coalition, power-sharing or nonpartisan' },
      ];
    case 'trifecta':
      return [
        { color: PARTY_COLOR.D, label: 'Democratic trifecta' },
        { color: PARTY_COLOR.R, label: 'Republican trifecta' },
        { color: SPLIT, label: 'Divided government' },
        { color: '#7a8796', label: 'Nonpartisan legislature' },
      ];
    case 'senate':
      return [
        { color: PARTY_COLOR.D, label: 'Two Democrats (independents by caucus)' },
        { color: PARTY_COLOR.R, label: 'Two Republicans' },
        { color: SPLIT, label: 'Split delegation' },
      ];
    case 'house':
      return [
        { color: houseColor(1), label: 'All Democratic' },
        { color: houseColor(0.75), label: 'Mostly Democratic' },
        { color: houseColor(0.5), label: 'Even' },
        { color: houseColor(0.25), label: 'Mostly Republican' },
        { color: houseColor(0), label: 'All Republican' },
      ];
    case 'ballot':
      return [
        { color: '#ffd166', label: 'Governor and Senate races' },
        { color: '#ff9f43', label: 'Governor race' },
        { color: '#e05aa6', label: 'Senate race' },
        { color: NEUTRAL, label: 'House seats only' },
      ];
  }
}

/** Blue-to-red by the Democratic share of the delegation. */
export function houseColor(dShare: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, dShare)) * 100);
  return `color-mix(in srgb, ${PARTY_COLOR.D} ${pct}%, ${PARTY_COLOR.R})`;
}

const GREY = '#7a8796';

export function stateFill(s: UsState, layer: UsLayer, now: Date = new Date()): string {
  switch (layer) {
    case 'governor':
      return s.governor ? PARTY_COLOR[s.governor.party] : NEUTRAL;
    case 'legislature': {
      const c = legislatureControl(s);
      return c === 'D' || c === 'R' ? PARTY_COLOR[c] : c === 'split' ? SPLIT : c === 'other' ? GREY : NEUTRAL;
    }
    case 'trifecta': {
      const t = trifecta(s);
      return t === 'D' || t === 'R' ? PARTY_COLOR[t] : t === 'divided' ? SPLIT : t === 'nonpartisan' ? GREY : NEUTRAL;
    }
    case 'senate': {
      const d = senateDelegation(s);
      return d === 'D' || d === 'R' ? PARTY_COLOR[d] : d === 'split' ? SPLIT : NEUTRAL;
    }
    case 'house': {
      const c = houseCounts(s);
      const seated = c.D + c.R + c.I;
      return seated ? houseColor((c.D + (s.house.filter((m) => m.party === 'I' && m.caucus === 'D').length)) / seated) : NEUTRAL;
    }
    case 'ballot': {
      const b = onBallot(s, now);
      if (b.governor && b.senate.length) return '#ffd166';
      if (b.governor) return '#ff9f43';
      if (b.senate.length) return '#e05aa6';
      return NEUTRAL;
    }
  }
}

function seats(c: { D: number; R: number; O: number }): string {
  return `${c.D}D–${c.R}R${c.O ? `–${c.O} other` : ''}`;
}

/** Tooltip line for a state under a layer. */
export function stateSummary(s: UsState, layer: UsLayer, now: Date = new Date()): string {
  switch (layer) {
    case 'governor':
      return s.governor ? `${s.code === 'DC' ? 'Mayor' : 'Governor'} ${s.governor.name} (${s.governor.party === 'O' ? s.governor.partyName : s.governor.party})${s.governor.since ? ` since ${formatDate(s.governor.since)}` : ''}` : 'No governor on record';
    case 'legislature':
      return s.legislature ? s.legislature.chambers.map((c) => `${c.name} ${c.control === 'nonpartisan' ? `${c.O} members, nonpartisan` : seats(c)}${c.control === 'coalition' || c.control === 'shared' ? ` (${CONTROL_LABEL[c.control].toLowerCase()})` : ''}`).join(' · ') : 'No state legislature (the DC Council is not tracked)';
    case 'trifecta': {
      const t = trifecta(s);
      return t === 'D' || t === 'R' ? `${PARTY_NAME[t]} trifecta: governor and every chamber` : t === 'divided' ? 'Divided government' : t === 'nonpartisan' ? 'Nonpartisan unicameral legislature' : 'Not a state';
    }
    case 'senate':
      return s.senators.length ? s.senators.map((x) => `${x.name} (${x.party}${x.caucus ? `, caucuses ${x.caucus}` : ''})`).join(' · ') : 'No senators (DC is not a state)';
    case 'house': {
      const c = houseCounts(s);
      return `${s.houseSeats} seat${s.houseSeats === 1 ? '' : 's'}: ${c.D} D, ${c.R} R${c.I ? `, ${c.I} I` : ''}${c.vacant ? `, ${c.vacant} vacant` : ''}${s.code === 'DC' ? ' (non-voting delegate)' : ''}`;
    }
    case 'ballot': {
      const b = onBallot(s, now);
      const races = [b.governor ? `governor${openGovernorSeat(s, now) ? ' (open seat)' : ''}` : null, ...b.senate.map((x) => `Senate${x.special ? ' special' : ''} (${x.name}'s seat)`), s.code === 'DC' ? 'delegate' : `${s.houseSeats} House seat${s.houseSeats === 1 ? '' : 's'}`].filter(Boolean);
      return `${formatDate(nextFederalElection(now))}: ${races.join(', ')}`;
    }
  }
}

export function stateWikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
}

export function ballotpediaUrl(name: string): string {
  return `https://ballotpedia.org/${encodeURIComponent(name.replace(/ /g, '_'))}`;
}

/** "at-large" or "district 7". */
export function districtLabel(d: number): string {
  return d === 0 ? 'at-large' : `district ${d}`;
}
