import { BLOCS } from '../data/blocs';
import { CONFLICTS } from '../data/conflicts';
import { UNREST } from '../data/unrest';
import { UNREST_KIND_LABEL } from './unrest';
import { COUNTRIES, COUNTRY_BY_ISO } from '../lib/countries';
import { CHOKEPOINTS } from './chokepoints';
import { INTENSITY_LABEL } from './labels';
import { LAYER_OPTIONS } from './layerOptions';
import type { Layer, Mode } from './urlState';

export type SearchAction = 'brief' | 'changes' | 'compare' | 'watchlist';

export type SearchHit =
  | { kind: 'country'; id: string; label: string; sub: string }
  | { kind: 'bloc'; id: string; label: string; sub: string; color: string }
  | { kind: 'conflict'; id: string; label: string; sub: string; color: string }
  | { kind: 'unrest'; id: string; label: string; sub: string; color: string }
  | { kind: 'chokepoint'; id: string; label: string; sub: string }
  | { kind: 'layer'; id: Exclude<Layer, null>; label: string; sub: string }
  | { kind: 'action'; id: SearchAction; label: string; sub: string }
  | { kind: 'pair'; id: string; a: string; b: string; label: string; sub: string };

export type SearchKind = SearchHit['kind'];

/** Result groups in display order; the list shows one small header per group. */
export const SEARCH_GROUPS: Array<{ label: string; kinds: SearchKind[] }> = [
  { label: 'Relationships', kinds: ['pair'] },
  { label: 'Countries', kinds: ['country'] },
  { label: 'Conflicts & unrest', kinds: ['conflict', 'unrest'] },
  { label: 'Blocs', kinds: ['bloc'] },
  { label: 'Places', kinds: ['chokepoint'] },
  { label: 'Layers', kinds: ['layer'] },
  { label: 'Actions', kinds: ['action'] },
];

/** Non-sovereign entries that still need to be findable because they appear on the map or in the data. */
const EXTRA_TERRITORIES = new Set(['TWN', 'PSE', 'UNK', 'ESH']);

/** English exonyms and short forms that world-countries' altSpellings lack. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  TUR: ['Turkey'],
  NLD: ['Holland'],
  SWZ: ['Swaziland'],
  TLS: ['East Timor'],
  MKD: ['Macedonia'],
  GBR: ['Britain', 'England'],
  USA: ['America'],
  CZE: ['Czech Republic'],
  CPV: ['Cabo Verde'],
  VAT: ['Vatican'],
};

/** Lowercase, strip diacritics and normalise apostrophes so "turkiye" finds Türkiye and "cote d'ivoire" finds Côte d’Ivoire. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/ı/g, 'i')
    .replace(/[-‐-―]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Entry = SearchHit & { keys: string[] };

const ACTIONS: Array<{ id: SearchAction; label: string; sub: string; keys: string[] }> = [
  { id: 'brief', label: 'Start briefing', sub: 'Full-screen, auto-cycling', keys: ['briefing', 'brief', 'start briefing', 'slideshow', 'wall display', 'present'] },
  { id: 'changes', label: 'Open recent changes', sub: 'Dated feed of what moved', keys: ['changes', 'recent changes', 'feed', "what's new", 'news', 'updates'] },
  { id: 'compare', label: 'Compare two blocs', sub: 'Shared and exclusive members', keys: ['compare', 'compare blocs', 'vs', 'versus'] },
  { id: 'watchlist', label: 'Open watchlist', sub: 'Starred countries, blocs and conflicts', keys: ['watchlist', 'starred', 'favourites', 'favorites'] },
];

const INDEX: Entry[] = [
  ...BLOCS.map((b) => ({
    kind: 'bloc' as const,
    id: b.id,
    label: b.name,
    sub: b.shortName,
    color: b.color,
    keys: [b.name, b.shortName].map(fold),
  })),
  ...CONFLICTS.map((c) => ({
    kind: 'conflict' as const,
    id: c.id,
    label: c.name,
    sub: INTENSITY_LABEL[c.intensity],
    color: '',
    keys: [c.name, ...(c.aliases ?? []), ...c.parties].map(fold),
  })),
  ...UNREST.map((u) => ({
    kind: 'unrest' as const,
    id: u.id,
    label: u.name,
    sub: UNREST_KIND_LABEL[u.kind],
    color: '',
    keys: [u.name, ...u.parties, 'unrest', 'protest', UNREST_KIND_LABEL[u.kind]].map(fold),
  })),
  ...CHOKEPOINTS.map((cp) => ({
    kind: 'chokepoint' as const,
    id: cp.id,
    label: cp.name,
    sub: `Chokepoint · ${cp.between}`,
    keys: [cp.name, cp.id.replace(/-/g, ' '), 'chokepoint', 'strait', 'shipping'].map(fold),
  })),
  ...LAYER_OPTIONS.map((l) => ({
    kind: 'layer' as const,
    id: l.id,
    label: `${l.label}`,
    sub: 'Show map layer',
    keys: [l.label, l.id.replace(/-/g, ' '), 'layer'].map(fold),
  })),
  ...ACTIONS.map((a) => ({ kind: 'action' as const, id: a.id, label: a.label, sub: a.sub, keys: [a.label, ...a.keys].map(fold) })),
  ...COUNTRIES.filter((c) => c.independent || EXTRA_TERRITORIES.has(c.cca3)).map((c) => ({
    kind: 'country' as const,
    id: c.cca3,
    label: c.name,
    sub: c.capital ?? c.region,
    keys: [c.name, c.official, c.cca3, c.cca2, c.capital ?? '', ...(c.alt ?? []), ...(COUNTRY_ALIASES[c.cca3] ?? [])].filter(Boolean).map(fold),
  })),
];

const COUNTRY_ENTRIES = INDEX.filter((h) => h.kind === 'country');

function rankKeys(keys: string[], q: string): number {
  let best = 0;
  for (const k of keys) {
    if (k === q) return 100;
    if (k.startsWith(q)) best = Math.max(best, 80);
    else if (k.split(/[\s,()'-]+/).some((w) => w.startsWith(q))) best = Math.max(best, 60);
    else if (q.length >= 3 && k.includes(q)) best = Math.max(best, 30);
  }
  return best;
}

/** Whole-query match first; otherwise every token must start a word of some key ("war sudan"). */
function rank(hit: Entry, q: string, tokens: string[]): number {
  const whole = rankKeys(hit.keys, q);
  if (whole || tokens.length < 2) return whole;
  const words = hit.keys.flatMap((k) => k.split(/[\s,()'-]+/));
  return tokens.every((t) => words.some((w) => w.startsWith(t))) ? 40 : 0;
}

/** In Conflicts mode a country name with a tracked war should open the war; in Blocs mode, blocs lead. */
function modeBoost(kind: SearchKind, mode: Mode | undefined): number {
  if (mode === 'conflicts' && (kind === 'conflict' || kind === 'unrest')) return 25;
  if (mode === 'blocs' && kind === 'bloc') return 25;
  return 0;
}

const CONNECTORS = new Set(['and', 'vs', 'v', 'versus', '&', '-', 'x', '/', '↔', '<>', 'with', 'relations', 'relationship']);

/** Country names, codes and aliases (not capitals) that name exactly one country, for pair queries. */
const PAIR_KEYS = (() => {
  const map = new Map<string, string | null>();
  for (const c of COUNTRIES.filter((x) => x.independent || EXTRA_TERRITORIES.has(x.cca3))) {
    for (const k of [c.name, c.official, c.cca3, c.cca2, ...(c.alt ?? []), ...(COUNTRY_ALIASES[c.cca3] ?? [])].map(fold)) {
      map.set(k, map.has(k) && map.get(k) !== c.cca3 ? null : c.cca3);
    }
  }
  return map;
})();

/** A country the phrase names outright; prefixes are too loose here ("serbia anti" is not Serbia ↔ Antigua). */
function resolveCountry(phrase: string): string | null {
  return PAIR_KEYS.get(phrase) ?? null;
}

/** "usa china", "israel vs iran", "united states and china" → the relationship view. */
function pairHit(tokens: string[]): SearchHit | null {
  // "Guinea Bissau" or "Trinidad and Tobago" is one country, not a pair.
  const whole = tokens.join(' ');
  if (COUNTRY_ENTRIES.some((h) => rankKeys(h.keys, whole) >= 80)) return null;
  const words = tokens.filter((t) => !CONNECTORS.has(t));
  if (words.length < 2) return null;
  for (let i = 1; i < words.length; i++) {
    const a = resolveCountry(words.slice(0, i).join(' '));
    const b = a && resolveCountry(words.slice(i).join(' '));
    if (a && b && a !== b) {
      const na = COUNTRY_BY_ISO.get(a)?.name ?? a;
      const nb = COUNTRY_BY_ISO.get(b)?.name ?? b;
      return { kind: 'pair', id: `${a},${b}`, a, b, label: `Relationship: ${na} ↔ ${nb}`, sub: 'Shared blocs, conflicts, sanctions, trade' };
    }
  }
  return null;
}

function strip(h: Entry): SearchHit {
  const { keys: _keys, ...hit } = h;
  void _keys;
  return hit as SearchHit;
}

export interface SearchOptions {
  limit?: number;
  /** Current map mode; nudges conflicts (Conflicts mode) or blocs (Blocs mode) up. */
  mode?: Mode;
}

/** Ranks exact and prefix matches above substring hits; every searchable thing shares one index. */
export function search(query: string, limitOrOptions: number | SearchOptions = 10): SearchHit[] {
  const { limit = 10, mode } = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions;
  const q = fold(query);
  if (!q) return [];
  const tokens = q.split(' ').filter(Boolean);
  const hits = INDEX.map((h) => {
    const base = rank(h, q, tokens);
    return { h, score: base ? base + modeBoost(h.kind, mode) : 0 };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.h.label.localeCompare(b.h.label))
    .map(({ h }) => strip(h));
  const pair = pairHit(tokens);
  return (pair ? [pair, ...hits] : hits).slice(0, limit);
}

/** Re-resolves a stored {kind, id} (recents, watchlist) to a displayable hit. */
export function hitFor(kind: SearchKind, id: string): SearchHit | null {
  if (kind === 'pair') {
    const [a, b] = id.split(',');
    return a && b ? pairHit([fold(a), fold(b)]) : null;
  }
  const h = INDEX.find((x) => x.kind === kind && x.id === id);
  return h ? strip(h) : null;
}

/** Groups hits for display, keeping the ranked order inside each group and ordering groups by their best hit. */
export function groupHits(hits: SearchHit[]): Array<{ label: string; hits: SearchHit[] }> {
  const out: Array<{ label: string; hits: SearchHit[] }> = [];
  for (const hit of hits) {
    const group = SEARCH_GROUPS.find((g) => g.kinds.includes(hit.kind))!;
    let row = out.find((g) => g.label === group.label);
    if (!row) out.push((row = { label: group.label, hits: [] }));
    row.hits.push(hit);
  }
  return out;
}
