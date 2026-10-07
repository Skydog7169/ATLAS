import type { Source } from './types';

export const TRACKERS = {
  cfr: { name: 'CFR Global Conflict Tracker', url: 'https://www.cfr.org/global-conflict-tracker' },
  acled: { name: 'ACLED', url: 'https://acleddata.com/' },
  crisisWatch: { name: 'Crisis Group CrisisWatch', url: 'https://www.crisisgroup.org/crisiswatch' },
  ucdp: { name: 'Uppsala Conflict Data Program', url: 'https://ucdp.uu.se/' },
  isw: { name: 'Institute for the Study of War', url: 'https://www.understandingwar.org/' },
} satisfies Record<string, Source>;


export const DEFAULT_CONFLICT_SOURCES: Source[] = [TRACKERS.cfr, TRACKERS.acled, TRACKERS.crisisWatch];
