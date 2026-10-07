import raw from '../data/displacement.generated.json';

export interface DisplacementRow {
  iso: string;
  refugees: number;
  asylumSeekers: number;
  idps: number;
  oip: number;
  total: number;
}

interface DisplacementFile {
  source: { name: string; url: string };
  year: number;
  fetchedAt: string;
  rows: DisplacementRow[];
}

export const DISPLACEMENT = raw as DisplacementFile;
export const DISPLACEMENT_BY_ISO: ReadonlyMap<string, DisplacementRow> = new Map(DISPLACEMENT.rows.map((r) => [r.iso, r]));

/** Lower bounds of each bin, people displaced from the country. */
export const DISPLACEMENT_BINS = [0, 100_000, 500_000, 1_000_000, 3_000_000, 6_000_000] as const;

/** Sequential violet ramp, kept distinct from the red/orange conflict scale and the cyan bloc scale. */
export const DISPLACEMENT_COLORS = ['var(--land)', '#2b2150', '#4a2f86', '#7142bf', '#a35be6', '#dd8bff'] as const;

export function displacementBin(total: number): number {
  let bin = 0;
  for (let i = 0; i < DISPLACEMENT_BINS.length; i++) if (total >= DISPLACEMENT_BINS[i]! && (i === 0 || total > 0)) bin = i;
  return total <= 0 ? 0 : bin;
}

export function displacementColor(iso: string): string {
  const row = DISPLACEMENT_BY_ISO.get(iso);
  return DISPLACEMENT_COLORS[displacementBin(row?.total ?? 0)] ?? 'var(--land)';
}

export function formatPeople(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'k';
  return String(n);
}

export function binLabel(i: number): string {
  const lo = DISPLACEMENT_BINS[i] ?? 0;
  const hi = DISPLACEMENT_BINS[i + 1];
  if (i === 0) return `Under ${formatPeople(DISPLACEMENT_BINS[1]!)}`;
  return hi ? `${formatPeople(lo)} – ${formatPeople(hi)}` : `${formatPeople(lo)}+`;
}
