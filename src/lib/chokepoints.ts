import raw from '../data/chokepoints.json';
import { CONFLICT_BY_ID } from '../data/conflicts';
import type { Conflict, Source } from '../data/types';

export type ChokepointStatus = 'open' | 'recovering' | 'restricted' | 'disrupted' | 'closed';

export interface ChokepointEntry {
  date: string;
  status: ChokepointStatus;
  summary: string;
  sources: Source[];
}

export interface Chokepoint {
  id: string;
  name: string;
  location: [number, number];
  between: string;
  carries: string;
  conflicts: string[];
  history: ChokepointEntry[];
}

interface ChokepointsFile {
  verified: string;
  sources: Source[];
  chokepoints: Chokepoint[];
}

export const CHOKEPOINTS_FILE = raw as ChokepointsFile;
export const CHOKEPOINTS: Chokepoint[] = CHOKEPOINTS_FILE.chokepoints.map((c) => ({ ...c, history: [...c.history].sort((a, b) => b.date.localeCompare(a.date)) }));
export const CHOKEPOINT_BY_ID: ReadonlyMap<string, Chokepoint> = new Map(CHOKEPOINTS.map((c) => [c.id, c]));

export const CHOKEPOINT_STATUS_LABEL: Record<ChokepointStatus, string> = {
  open: 'Open',
  recovering: 'Recovering',
  restricted: 'Restricted',
  disrupted: 'Disrupted',
  closed: 'Closed',
};

/** Green to red, with amber in between; matches the conflict intensity hues so a disrupted strait reads like a hot conflict. */
export const CHOKEPOINT_COLOR: Record<ChokepointStatus, string> = {
  open: '#3fb04a',
  recovering: '#9ad04a',
  restricted: '#ffd84a',
  disrupted: '#ff9a2e',
  closed: '#ff3b3b',
};

export const CHOKEPOINT_STATUSES: ChokepointStatus[] = ['open', 'recovering', 'restricted', 'disrupted', 'closed'];

export function currentStatus(c: Chokepoint): ChokepointEntry {
  return c.history[0]!;
}

export function linkedConflicts(c: Chokepoint): Conflict[] {
  return c.conflicts.map((id) => CONFLICT_BY_ID.get(id)).filter((x): x is Conflict => Boolean(x));
}

/** Marker id prefix so chokepoint markers share the map's marker layer with conflicts. */
export const CHOKEPOINT_MARKER_PREFIX = 'chokepoint:';
