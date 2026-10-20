import { BLOC_BY_ID } from '../data/blocs';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { UNREST_BY_ID } from '../data/unrest';
import { CHOKEPOINT_BY_ID } from './chokepoints';
import { countryName } from './countries';
import type { Selection } from './urlState';

/** Where the camera goes for a selection; shared with the footprint camera. */
export { focusForSelection } from './focus';

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
      return 'Latest changes';
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
