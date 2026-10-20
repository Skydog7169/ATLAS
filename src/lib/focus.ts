import { BLOC_BY_ID } from '../data/blocs';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { UNREST_BY_ID } from '../data/unrest';
import type { Focus } from './camera';
import { CHOKEPOINT_BY_ID } from './chokepoints';
import type { Selection } from './urlState';

/** Full members of a bloc (suspended and partner states are not framed). */
export function blocIsos(id: string | null | undefined): string[] {
  const b = id ? BLOC_BY_ID.get(id) : undefined;
  return b ? b.members.filter((m) => m.status === 'member').map((m) => m.iso) : [];
}

/** Bloc A, or the union of A and B while comparing. */
export function blocFocus(bloc: string | null | undefined, vs?: string | null): Focus {
  const isos = [...new Set([...blocIsos(bloc), ...blocIsos(vs)])];
  return isos.length ? { kind: 'isos', isos } : { kind: 'reset' };
}

/**
 * The camera target for a selection, shared by deep links, the globe/flat
 * toggle and the recentre button. Selections with nothing on the map
 * (changes, about, watchlist, ask) return null so the camera stays put.
 */
export function focusForSelection(selection: Selection, ctx: { bloc?: string | null; vs?: string | null } = {}): Focus {
  if (!selection) return null;
  switch (selection.kind) {
    case 'country':
      return { kind: 'country', iso: selection.iso };
    case 'pair':
      // A one-sided pair is the picker: the map stays put so the second country can be clicked.
      return selection.b ? { kind: 'isos', isos: [selection.a, selection.b] } : null;
    case 'bloc':
      return blocFocus(selection.id);
    case 'compare':
      return blocFocus(ctx.bloc, ctx.vs);
    case 'conflict': {
      const c = CONFLICT_BY_ID.get(selection.id);
      return c ? { kind: 'point', lonLat: c.location, scale: 3.5 } : null;
    }
    case 'chokepoint': {
      const cp = CHOKEPOINT_BY_ID.get(selection.id);
      return cp ? { kind: 'point', lonLat: cp.location, scale: 3 } : null;
    }
    case 'unrest': {
      const u = UNREST_BY_ID.get(selection.id);
      return u ? { kind: 'point', lonLat: u.location, scale: 3.5 } : null;
    }
    default:
      return null;
  }
}

/** Outline colours for a conflict's sides, in declaration order (mediators get none). */
const SIDE_COLORS = ['var(--accent)', 'var(--warn)', 'var(--fg-muted)'];

/**
 * Foreign states backing a party to the conflict, mapped to the colour of the
 * side they back, so the map can draw them as dashed outlines. Countries that
 * are themselves parties to the conflict are left to the theatre fill.
 */
export function backerOutlines(conflictId: string): Map<string, string> {
  const out = new Map<string, string>();
  const c = CONFLICT_BY_ID.get(conflictId);
  if (!c) return out;
  const sides = [...new Set((c.actors ?? []).filter((a) => !/mediator/i.test(a.side)).map((a) => a.side))];
  for (const a of c.actors ?? []) {
    const i = sides.indexOf(a.side);
    if (i < 0) continue;
    for (const b of a.backers ?? []) {
      if (b.iso && !c.countries.includes(b.iso) && !out.has(b.iso)) out.set(b.iso, SIDE_COLORS[Math.min(i, SIDE_COLORS.length - 1)]!);
    }
  }
  return out;
}
