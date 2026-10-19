import type { Bloc } from '../data/types';
import { WB_HISTORY, gdpIn } from './worldbankHistory';

export const TREND_FROM = 1990;

export interface TrendPoint {
  year: number;
  members: number;
  /** Combined GDP of the members with a World Bank value that year, current US$. */
  gdpUsd: number;
  /** Members with a GDP value that year. */
  covered: number;
}

/** Statuses that count as holding membership in a given year. */
const COUNTED = new Set(['member', 'suspended', 'frozen']);

/** Members as of `year`: current members whose accession is at or before it, plus former spells covering it. */
export function membersIn(bloc: Bloc, year: number): string[] {
  const out: string[] = [];
  for (const m of bloc.members) if (COUNTED.has(m.status) && m.since !== undefined && m.since <= year) out.push(m.iso);
  for (const f of bloc.former ?? []) if (f.since <= year && year < f.until && !out.includes(f.iso)) out.push(f.iso);
  return out;
}

/** One point per year from the later of 1990 and the founding year to the newest GDP year. */
export function blocTrend(bloc: Bloc, from = TREND_FROM, to = WB_HISTORY.to): TrendPoint[] {
  const start = Math.max(from, bloc.founded);
  const points: TrendPoint[] = [];
  for (let year = start; year <= to; year++) {
    const isos = membersIn(bloc, year);
    let gdpUsd = 0;
    let covered = 0;
    for (const iso of isos) {
      const g = gdpIn(iso, year);
      if (g !== null) {
        gdpUsd += g;
        covered += 1;
      }
    }
    points.push({ year, members: isos.length, gdpUsd, covered });
  }
  return points;
}

/** True when every counted member has an accession year, so the member line is trustworthy. */
export function trendComplete(bloc: Bloc): boolean {
  return bloc.members.every((m) => !COUNTED.has(m.status) || m.since !== undefined);
}
