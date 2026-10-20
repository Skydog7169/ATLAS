import raw from '../data/worldbank.generated.json';
import type { Bloc } from '../data/types';
import { blocMembers } from './membership';

export interface WorldBankRow {
  iso: string;
  population: number | null;
  populationYear: number | null;
  gdpUsd: number | null;
  gdpYear: number | null;
  militaryUsd: number | null;
  militaryYear: number | null;
}

interface WorldBankFile {
  source: { name: string; url: string };
  fetchedAt: string;
  rows: WorldBankRow[];
}

export const WORLDBANK = raw as WorldBankFile;
export const WORLDBANK_BY_ISO: ReadonlyMap<string, WorldBankRow> = new Map(WORLDBANK.rows.map((r) => [r.iso, r]));

export interface Figures {
  members: number;
  population: number;
  gdpUsd: number;
  militaryUsd: number;
  /** How many members had a value for each metric. */
  coverage: { population: number; gdpUsd: number; militaryUsd: number };
  /** Newest year among the summed values, per metric. */
  newest: Record<Metric, number | null>;
  /** Summed values from a year before the newest, per metric, oldest first. */
  older: Record<Metric, Array<{ iso: string; year: number }>>;
}

export type Metric = 'population' | 'gdpUsd' | 'militaryUsd';

/** A value this many years older than the newest one in the same sum is flagged as stale. */
export const STALE_YEARS = 3;

/** Values in a sum that are more than STALE_YEARS older than its newest value. */
export function staleValues(f: Figures, metric: Metric): Array<{ iso: string; year: number }> {
  const newest = f.newest[metric];
  return newest === null ? [] : f.older[metric].filter((v) => newest - v.year > STALE_YEARS);
}

export function sumFigures(isos: Iterable<string>): Figures {
  const f: Figures = {
    members: 0,
    population: 0,
    gdpUsd: 0,
    militaryUsd: 0,
    coverage: { population: 0, gdpUsd: 0, militaryUsd: 0 },
    newest: { population: null, gdpUsd: null, militaryUsd: null },
    older: { population: [], gdpUsd: [], militaryUsd: [] },
  };
  const years: Record<Metric, Array<{ iso: string; year: number }>> = { population: [], gdpUsd: [], militaryUsd: [] };
  const YEAR_KEY = { population: 'populationYear', gdpUsd: 'gdpYear', militaryUsd: 'militaryYear' } as const;
  for (const iso of isos) {
    f.members += 1;
    const r = WORLDBANK_BY_ISO.get(iso);
    if (!r) continue;
    for (const metric of ['population', 'gdpUsd', 'militaryUsd'] as const) {
      const v = r[metric];
      if (v === null) continue;
      f[metric] += v;
      f.coverage[metric] += 1;
      const year = r[YEAR_KEY[metric]];
      if (year !== null) years[metric].push({ iso, year });
    }
  }
  for (const metric of ['population', 'gdpUsd', 'militaryUsd'] as const) {
    const newest = years[metric].length ? Math.max(...years[metric].map((v) => v.year)) : null;
    f.newest[metric] = newest;
    f.older[metric] = years[metric].filter((v) => v.year !== newest).sort((a, b) => a.year - b.year || a.iso.localeCompare(b.iso));
  }
  return f;
}

/** Figures for a bloc's full members only. */
export function blocFigures(bloc: Bloc): Figures {
  return sumFigures(blocMembers(bloc).full);
}

export const WORLD: Figures = sumFigures(WORLDBANK.rows.map((r) => r.iso));

/** Share of a world total. Two significant figures below 1%, so small countries never read '0.0%'. */
export function share(part: number, whole: number): string {
  if (!whole) return '';
  const pct = (part / whole) * 100;
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct <= 0) return '0%';
  if (pct < 0.01) return '<0.01%';
  return `${Number(pct.toPrecision(2))}%`;
}

export function formatUsd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(n >= 1e13 ? 0 : 1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e11 ? 0 : 1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${Math.round(n)}`;
}

export function formatCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}
