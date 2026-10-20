import { BLOC_BY_ID } from '../data/blocs';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { UNREST_BY_ID } from '../data/unrest';
import { CHOKEPOINT_BY_ID } from './chokepoints';
import { countryName } from './countries';
import type { Focus } from '../components/WorldMap';
import type { Selection } from './urlState';

/**
 * Where the camera goes for a selection: the same targets the select*
 * callbacks fly to. Null for panels that don't move the map (changes,
 * watchlist, about, ask, a one-sided pair).
 */
export function focusForSelection(s: Selection): Focus {
  if (!s) return null;
  if (s.kind === 'country') return { kind: 'country', iso: s.iso };
  if (s.kind === 'conflict') {
    const c = CONFLICT_BY_ID.get(s.id);
    return c ? { kind: 'point', lonLat: c.location, scale: 3.5 } : null;
  }
  if (s.kind === 'chokepoint') {
    const cp = CHOKEPOINT_BY_ID.get(s.id);
    return cp ? { kind: 'point', lonLat: cp.location, scale: 3 } : null;
  }
  if (s.kind === 'unrest') {
    const u = UNREST_BY_ID.get(s.id);
    return u ? { kind: 'point', lonLat: u.location, scale: 3.5 } : null;
  }
  if (s.kind === 'bloc' || s.kind === 'compare' || (s.kind === 'pair' && s.b)) return { kind: 'reset' };
  return null;
}

/** Short name of a panel for the "‹ Ukraine" back chip. */
export function selectionLabel(s: Selection): string {
  if (!s) return '';
  switch (s.kind) {
    case 'country':
      return countryName(s.iso);
    case 'bloc':
      return BLOC_BY_ID.get(s.id)?.shortName ?? s.id;
    case 'conflict':
      return CONFLICT_BY_ID.get(s.id)?.name ?? s.id;
    case 'unrest':
      return UNREST_BY_ID.get(s.id)?.name ?? s.id;
    case 'chokepoint':
      return CHOKEPOINT_BY_ID.get(s.id)?.name ?? s.id;
    case 'pair':
      return s.b ? `${countryName(s.a)} – ${countryName(s.b)}` : countryName(s.a);
    case 'compare':
      return 'Comparison';
    case 'changes':
      return 'Recent changes';
    case 'watchlist':
      return 'Watchlist';
    case 'about':
      return 'About';
    case 'ask':
      return 'Ask ATLAS';
  }
}

/** "old-episode" -> "old episode", so a stale id can seed the search box. */
export function deslug(id: string): string {
  return id.replace(/[-_,]+/g, ' ').trim();
}
