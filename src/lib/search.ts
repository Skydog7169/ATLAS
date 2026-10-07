import { BLOCS } from '../data/blocs';
import { CONFLICTS } from '../data/conflicts';
import { COUNTRIES } from '../lib/countries';

export type SearchHit =
  | { kind: 'country'; id: string; label: string; sub: string }
  | { kind: 'bloc'; id: string; label: string; sub: string; color: string }
  | { kind: 'conflict'; id: string; label: string; sub: string; color: string };

/** Non-sovereign entries that still need to be findable because they appear on the map or in the data. */
const EXTRA_TERRITORIES = new Set(['TWN', 'PSE', 'UNK', 'ESH']);

const INDEX: Array<SearchHit & { keys: string[] }> = [
  ...BLOCS.map((b) => ({
    kind: 'bloc' as const,
    id: b.id,
    label: b.name,
    sub: b.shortName,
    color: b.color,
    keys: [b.name, b.shortName].map((s) => s.toLowerCase()),
  })),
  ...CONFLICTS.map((c) => ({
    kind: 'conflict' as const,
    id: c.id,
    label: c.name,
    sub: 'Conflict',
    color: '',
    keys: [c.name, ...c.parties].map((s) => s.toLowerCase()),
  })),
  ...COUNTRIES.filter((c) => c.independent || EXTRA_TERRITORIES.has(c.cca3)).map((c) => ({
    kind: 'country' as const,
    id: c.cca3,
    label: c.name,
    sub: c.capital ?? c.region,
    keys: [c.name, c.official, c.cca3, c.cca2, c.capital ?? ''].map((s) => s.toLowerCase()),
  })),
];

function rank(hit: (typeof INDEX)[number], q: string): number {
  let best = 0;
  for (const k of hit.keys) {
    if (k === q) best = Math.max(best, 100);
    else if (k.startsWith(q)) best = Math.max(best, 80);
    else if (k.split(/\s+/).some((w) => w.startsWith(q))) best = Math.max(best, 60);
    else if (k.includes(q)) best = Math.max(best, 30);
  }
  return best;
}

/** Ranks exact and prefix matches above substring hits; countries, blocs and conflicts share one index. */
export function search(query: string, limit = 10): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return INDEX.map((h) => ({ h, score: rank(h, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.h.label.localeCompare(b.h.label))
    .slice(0, limit)
    .map(({ h }) => {
      const { keys: _keys, ...hit } = h;
      void _keys;
      return hit;
    });
}
