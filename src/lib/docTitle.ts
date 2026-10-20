import { BLOC_BY_ID } from '../data/blocs';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { UNREST_BY_ID } from '../data/unrest';
import { CHOKEPOINT_BY_ID, CHOKEPOINT_STATUS_LABEL, currentStatus } from './chokepoints';
import { countryName } from './countries';
import { INTENSITY_LABEL, formatMonth } from './labels';
import { LAYER_LABEL } from './layerOptions';
import { UNREST_KIND_LABEL } from './unrest';
import type { AppState } from './urlState';

export const DEFAULT_TITLE = 'ATLAS — alliances, wars and unrest';

const withBrand = (s: string) => `${s} — ATLAS`;

/** Tab, history and bookmark title for the current view, so several ATLAS tabs can be told apart. */
export function titleFor(state: Pick<AppState, 'mode' | 'bloc' | 'vs' | 'selection' | 'month' | 'layer' | 'brief'>): string {
  const { selection: sel, mode, bloc, vs, month, layer, brief } = state;
  if (brief) return withBrand('Briefing');
  if (sel) {
    switch (sel.kind) {
      case 'conflict': {
        const c = CONFLICT_BY_ID.get(sel.id);
        if (c) return withBrand(`${c.name} · ${INTENSITY_LABEL[c.intensity]}`);
        break;
      }
      case 'country':
        return withBrand(countryName(sel.iso));
      case 'bloc': {
        const b = BLOC_BY_ID.get(sel.id);
        if (b) return withBrand(b.name);
        break;
      }
      case 'compare': {
        const a = bloc ? BLOC_BY_ID.get(bloc) : undefined;
        const b = vs ? BLOC_BY_ID.get(vs) : undefined;
        if (a && b) return withBrand(`${a.shortName} vs ${b.shortName}`);
        break;
      }
      case 'pair':
        return withBrand(sel.b ? `${countryName(sel.a)} ↔ ${countryName(sel.b)}` : `${countryName(sel.a)}: relationships`);
      case 'chokepoint': {
        const cp = CHOKEPOINT_BY_ID.get(sel.id);
        if (cp) return withBrand(`${cp.name} · ${CHOKEPOINT_STATUS_LABEL[currentStatus(cp).status]}`);
        break;
      }
      case 'unrest': {
        const u = UNREST_BY_ID.get(sel.id);
        if (u) return withBrand(`${u.name} · ${UNREST_KIND_LABEL[u.kind]}`);
        break;
      }
      case 'changes':
        return withBrand('Latest changes');
      case 'watchlist':
        return withBrand('Watchlist');
      case 'about':
        return withBrand('About');
      case 'ask':
        return 'Ask ATLAS';
    }
  }
  if (layer) return withBrand(`${LAYER_LABEL.get(layer) ?? layer} layer`);
  if (mode === 'conflicts') return withBrand(month ? `Conflicts · ${formatMonth(month)}` : 'Conflicts');
  if (bloc) {
    const b = BLOC_BY_ID.get(bloc);
    if (b) return withBrand(b.name);
  }
  return DEFAULT_TITLE;
}
