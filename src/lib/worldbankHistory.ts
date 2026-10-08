import raw from '../data/worldbank-history.generated.json';

interface HistoryFile {
  source: { name: string; url: string };
  fetchedAt: string;
  from: number;
  to: number;
  /** GDP in current US$ per year from `from`, null where the World Bank has no value. */
  gdpUsd: Record<string, Array<number | null>>;
}

export const WB_HISTORY = raw as HistoryFile;

export function gdpIn(iso: string, year: number): number | null {
  const series = WB_HISTORY.gdpUsd[iso];
  if (!series || year < WB_HISTORY.from || year > WB_HISTORY.to) return null;
  return series[year - WB_HISTORY.from] ?? null;
}
