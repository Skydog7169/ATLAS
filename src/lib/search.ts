import { BLOCS } from '../data/blocs';
import { CONFLICTS } from '../data/conflicts';
import { UNREST } from '../data/unrest';
import { UNREST_KIND_LABEL } from './unrest';
import { COUNTRIES, COUNTRY_BY_ISO } from '../lib/countries';
import { leaderIndex } from './leaders';
import { US_STATES } from './usStates';

export type SearchHit =
  | { kind: 'country'; id: string; label: string; sub: string }
  | { kind: 'bloc'; id: string; label: string; sub: string; color: string }
  | { kind: 'conflict'; id: string; label: string; sub: string; color: string }
  | { kind: 'unrest'; id: string; label: string; sub: string; color: string }
  | { kind: 'leader'; id: string; label: string; sub: string }
  | { kind: 'state'; id: string; label: string; sub: string };

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
  ...UNREST.map((u) => ({
    kind: 'unrest' as const,
    id: u.id,
    label: u.name,
    sub: UNREST_KIND_LABEL[u.kind],
    color: '',
    keys: [u.name, ...u.parties, 'unrest', 'protest', UNREST_KIND_LABEL[u.kind]].map((s) => s.toLowerCase()),
  })),
  ...COUNTRIES.filter((c) => c.independent || EXTRA_TERRITORIES.has(c.cca3)).map((c) => ({
    kind: 'country' as const,
    id: c.cca3,
    label: c.name,
    sub: c.capital ?? c.region,
    keys: [c.name, c.official, c.cca3, c.cca2, c.capital ?? ''].map((s) => s.toLowerCase()),
  })),
  // Leaders open their country's dossier; one hit per person per country even when they hold two offices.
  ...[...new Map(leaderIndex().filter((l) => COUNTRY_BY_ISO.has(l.iso)).map((l) => [l.iso + l.name, l])).values()].map((l) => ({
    kind: 'leader' as const,
    id: l.iso,
    label: l.name,
    sub: `${l.title} · ${COUNTRY_BY_ISO.get(l.iso)!.name}`,
    keys: [l.name.toLowerCase()],
  })),
  // US states and their governors open the state panel; listed after countries so Georgia the country ranks first.
  ...US_STATES.map((s) => ({
    kind: 'state' as const,
    id: s.code,
    label: s.name,
    sub: s.governor ? `${s.code === 'DC' ? 'Mayor' : 'Gov.'} ${s.governor.name}` : 'US state',
    keys: [s.name, `${s.name} state`, ...(s.governor ? [s.governor.name] : []), ...s.senators.map((x) => x.name)].map((k) => k.toLowerCase()),
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
