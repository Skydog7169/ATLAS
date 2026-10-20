import type { Bloc } from '../data/types';
import { WB_HISTORY, gdpIn } from './worldbankHistory';
import { blocMembers } from './membership';

export const TREND_FROM = 1990;

export interface TrendPoint {
  year: number;
  /** Members holding membership that year, including those now suspended or frozen. */
  members: number;
  /**
   * Combined GDP, current US$, of the year's members excluding those now
   * suspended or frozen (the same rule as the 'At a glance' tiles). A member
   * with no value that year contributes its most recent earlier value.
   */
  gdpUsd: number;
  /** Members with a GDP value that year, reported or carried forward. */
  covered: number;
  /** How many of `covered` were carried forward from an earlier year. */
  estimated: number;
  /** The carried-forward values, for the chart's footnote. */
  carried: Array<{ iso: string; from: number }>;
  /** gdpUsd as a share of the world's GDP that year, computed the same way (0–1). */
  worldShare: number;
}

/** A country's GDP in `year`, or its most recent earlier value; null if it never reported by then. */
export function gdpCarried(iso: string, year: number): { value: number; from: number } | null {
  for (let y = year; y >= WB_HISTORY.from; y--) {
    const g = gdpIn(iso, y);
    if (g !== null) return { value: g, from: y };
  }
  return null;
}

const worldCache = new Map<number, number>();
/** World GDP in `year`: every country in the history file, with the same carry-forward. */
export function worldGdp(year: number): number {
  let total = worldCache.get(year);
  if (total === undefined) {
    total = 0;
    for (const iso of Object.keys(WB_HISTORY.gdpUsd)) total += gdpCarried(iso, year)?.value ?? 0;
    worldCache.set(year, total);
  }
  return total;
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
  const suspended = new Set(blocMembers(bloc).suspended.map((m) => m.iso));
  for (let year = start; year <= to; year++) {
    const isos = membersIn(bloc, year);
    let gdpUsd = 0;
    let covered = 0;
    const carried: TrendPoint['carried'] = [];
    for (const iso of isos) {
      if (suspended.has(iso)) continue;
      const g = gdpCarried(iso, year);
      if (g === null) continue;
      gdpUsd += g.value;
      covered += 1;
      if (g.from !== year) carried.push({ iso, from: g.from });
    }
    const world = worldGdp(year);
    points.push({ year, members: isos.length, gdpUsd, covered, estimated: carried.length, carried, worldShare: world ? gdpUsd / world : 0 });
  }
  return points;
}

/** True when every counted member has an accession year, so the member line is trustworthy. */
export function trendComplete(bloc: Bloc): boolean {
  return bloc.members.every((m) => !COUNTED.has(m.status) || m.since !== undefined);
}

/** Year of the bloc's latest accession or exit, for 'unchanged since' captions. */
export function lastChange(bloc: Bloc): number {
  let year = bloc.founded;
  for (const m of bloc.members) if (COUNTED.has(m.status) && m.since !== undefined) year = Math.max(year, m.since);
  for (const f of bloc.former ?? []) year = Math.max(year, f.until);
  return year;
}
