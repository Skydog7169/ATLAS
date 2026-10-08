import raw from '../data/nuclear.json';
import { BLOC_BY_ID } from '../data/blocs';
import type { DossierExtra } from './dossier';
import { formatDate } from './labels';

export type NuclearStatus = 'armed' | 'threshold' | 'hosting' | 'umbrella';

export interface NuclearRow {
  iso: string;
  status: NuclearStatus;
  note: string;
  sources: Array<{ name: string; url: string }>;
}

export interface NuclearTest {
  iso: string;
  date: string;
  note: string;
  source: { name: string; url: string };
}

interface NuclearFile {
  verified: string;
  sources: Array<{ name: string; url: string }>;
  statuses: NuclearRow[];
  umbrellaBloc: string;
  tests: NuclearTest[];
}

export const NUCLEAR = raw as NuclearFile;

export const NUCLEAR_STATUS_LABEL: Record<NuclearStatus, string> = {
  armed: 'Nuclear-armed',
  threshold: 'Threshold state',
  hosting: 'Hosts allied weapons',
  umbrella: 'Under a nuclear umbrella',
};

/** Categorical, chosen to read apart from every sequential ramp on the map. */
export const NUCLEAR_COLOR: Record<NuclearStatus, string> = {
  armed: '#ff4fd8',
  threshold: '#ff9a2e',
  hosting: '#b47cff',
  umbrella: '#3b7dd8',
};

const explicit = new Map(NUCLEAR.statuses.map((s) => [s.iso, s]));

/** Explicit statuses plus every full member of the umbrella bloc (NATO) not otherwise listed. */
export const NUCLEAR_BY_ISO: ReadonlyMap<string, NuclearRow> = (() => {
  const out = new Map(explicit);
  const bloc = BLOC_BY_ID.get(NUCLEAR.umbrellaBloc);
  for (const m of bloc?.members ?? []) {
    if (m.status !== 'member' || out.has(m.iso)) continue;
    out.set(m.iso, {
      iso: m.iso,
      status: 'umbrella',
      note: `${bloc!.shortName} member: covered by the alliance's nuclear deterrent.`,
      sources: NUCLEAR.sources.filter((s) => /nato/i.test(s.name)),
    });
  }
  return out;
})();

export const NUCLEAR_STATUSES: NuclearStatus[] = ['armed', 'threshold', 'hosting', 'umbrella'];

export function nuclearColor(iso: string): string {
  const row = NUCLEAR_BY_ISO.get(iso);
  return row ? NUCLEAR_COLOR[row.status] : 'var(--land)';
}

export function nuclearCount(status: NuclearStatus): number {
  let n = 0;
  for (const r of NUCLEAR_BY_ISO.values()) if (r.status === status) n += 1;
  return n;
}

export function testsFor(iso: string): NuclearTest[] {
  return NUCLEAR.tests.filter((t) => t.iso === iso).sort((a, b) => b.date.localeCompare(a.date));
}

export function nuclearSummary(iso: string): string | null {
  const row = NUCLEAR_BY_ISO.get(iso);
  if (!row) return null;
  const last = testsFor(iso)[0];
  return last ? `${NUCLEAR_STATUS_LABEL[row.status]} · last test ${formatDate(last.date)}` : NUCLEAR_STATUS_LABEL[row.status];
}

/** Only countries with a status get a section; the rest of the world has nothing to say. */
export function nuclearDossier(iso: string): DossierExtra | null {
  const row = NUCLEAR_BY_ISO.get(iso);
  if (!row) return null;
  const tests = testsFor(iso);
  const rows: DossierExtra['rows'] = [{ label: NUCLEAR_STATUS_LABEL[row.status], value: '', href: row.sources[0]?.url, note: row.note }];
  if (tests.length) rows.push({ label: `Last test ${formatDate(tests[0]!.date)}`, value: `${tests.length} since 1998`, href: tests[0]!.source.url, note: tests[0]!.note });
  return { id: 'nuclear', title: 'Nuclear status', rows, footnote: `Curated, verified ${formatDate(NUCLEAR.verified)}.` };
}
