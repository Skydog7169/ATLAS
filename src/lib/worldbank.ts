import raw from '../data/worldbank.generated.json';
import type { Bloc } from '../data/types';

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
}

export function sumFigures(isos: Iterable<string>): Figures {
  const f: Figures = { members: 0, population: 0, gdpUsd: 0, militaryUsd: 0, coverage: { population: 0, gdpUsd: 0, militaryUsd: 0 } };
  for (const iso of isos) {
    f.members += 1;
    const r = WORLDBANK_BY_ISO.get(iso);
    if (!r) continue;
    if (r.population !== null) {
      f.population += r.population;
      f.coverage.population += 1;
    }
    if (r.gdpUsd !== null) {
      f.gdpUsd += r.gdpUsd;
      f.coverage.gdpUsd += 1;
    }
    if (r.militaryUsd !== null) {
      f.militaryUsd += r.militaryUsd;
      f.coverage.militaryUsd += 1;
    }
  }
  return f;
}

/** Figures for a bloc's full members only. */
export function blocFigures(bloc: Bloc): Figures {
  return sumFigures(bloc.members.filter((m) => m.status === 'member').map((m) => m.iso));
}

export const WORLD: Figures = sumFigures(WORLDBANK.rows.map((r) => r.iso));

export function share(part: number, whole: number): string {
  if (!whole) return '';
  const pct = (part / whole) * 100;
  return pct >= 10 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
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
