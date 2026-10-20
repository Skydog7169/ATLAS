import { BLOC_BY_ID } from '../data/blocs';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { UNREST_BY_ID } from '../data/unrest';
import { CHOKEPOINT_BY_ID } from './chokepoints';
import { countryName } from './countries';
import { CONFLICT_TYPE_LABEL, INTENSITY_LABEL, formatDate } from './labels';
import type { Selection } from './urlState';

/** Kicker and title for a deep-linked subject. */
export function captionFor(selection: Exclude<Selection, null>): { kicker: string; title: string } | null {
  switch (selection.kind) {
    case 'conflict': {
      const c = CONFLICT_BY_ID.get(selection.id);
      return c ? { kicker: [CONFLICT_TYPE_LABEL[c.type], INTENSITY_LABEL[c.intensity], `since ${c.since}`, `assessed ${formatDate(c.updated)}`].join(' · '), title: c.name } : null;
    }
    case 'unrest': {
      const u = UNREST_BY_ID.get(selection.id);
      return u ? { kicker: [INTENSITY_LABEL[u.intensity], `assessed ${formatDate(u.updated)}`].join(' · '), title: u.name } : null;
    }
    case 'country':
      return { kicker: 'Country dossier', title: countryName(selection.iso) };
    case 'pair':
      return { kicker: 'Relationship', title: selection.b ? `${countryName(selection.a)} and ${countryName(selection.b)}` : countryName(selection.a) };
    case 'bloc': {
      const b = BLOC_BY_ID.get(selection.id);
      return b ? { kicker: 'Bloc', title: b.name } : null;
    }
    case 'chokepoint': {
      const cp = CHOKEPOINT_BY_ID.get(selection.id);
      return cp ? { kicker: 'Chokepoint', title: cp.name } : null;
    }
    case 'compare':
      return { kicker: 'Bloc comparison', title: 'Members of both blocs' };
    default:
      return null;
  }
}
