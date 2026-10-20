import { describe, expect, it } from 'vitest';
import { collectItems } from '../../scripts/build-feeds.mjs';
import blocs from '../data/blocs.json';
import conflicts from '../data/conflicts.json';
import unrest from '../data/unrest.json';
import { BUNDLED_IDS, BUNDLED_NEWEST, daysSince, isStale, newerEdition } from './edition';

describe('edition check', () => {
  it('knows every id the build writes to feed.json, so a fresh tab never sees a "new edition"', () => {
    const items = collectItems(conflicts, blocs, (iso: string) => iso, unrest) as Array<{ id: string }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.filter((it) => !BUNDLED_IDS.has(it.id))).toEqual([]);
    expect(newerEdition(items)).toBeNull();
  });

  it('reports the newest date the bundle lacks', () => {
    const known = new Set(['conflict:sudan:2026-10-01']);
    expect(newerEdition([{ id: 'conflict:sudan:2026-10-01' }, { id: 'conflict:sudan:2026-10-21', date_published: '2026-10-21T12:00:00Z' }, { id: 'bloc:nato:FIN:2026-10-19:joined' }], known)).toBe('2026-10-21');
    expect(newerEdition([{ id: 7 }, {}], known)).toBeNull();
  });

  it('calls data older than the weekly cadence a snapshot', () => {
    expect(BUNDLED_NEWEST).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(daysSince('2026-10-01', new Date('2026-10-20T10:00:00Z'))).toBe(19);
    expect(isStale('2026-10-15', new Date('2026-10-20T00:00:00Z'))).toBe(false);
    expect(isStale('2026-10-01', new Date('2026-10-20T00:00:00Z'))).toBe(true);
  });
});
