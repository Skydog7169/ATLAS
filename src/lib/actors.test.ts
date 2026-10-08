import { describe, expect, it } from 'vitest';
import { CONFLICTS, CONFLICT_BY_ID } from '../data/conflicts';
import { COUNTRY_BY_ISO } from './countries';
import { backersOf, sides, sponsorsAbroad, sponsorshipDossier } from './actors';
import { countryDossier } from './dossier';

describe('actors and peace process data', () => {
  it('every conflict declares actors with at least two sides and sourced lists', () => {
    for (const c of CONFLICTS) {
      expect(c.actors?.length, c.id).toBeGreaterThanOrEqual(2);
      expect(sides(c).length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.actorsSources?.length, c.id).toBeGreaterThan(0);
      expect(new Set(c.actors!.map((a) => a.id)).size).toBe(c.actors!.length);
      for (const a of c.actors!) {
        if (a.iso) expect(COUNTRY_BY_ISO.has(a.iso), `${c.id}/${a.id}`).toBe(true);
        for (const b of a.backers ?? []) if (b.iso) expect(COUNTRY_BY_ISO.has(b.iso), `${c.id}/${a.id}/${b.name}`).toBe(true);
      }
      const dates = (c.peace ?? []).map((e) => e.date);
      expect(dates, c.id).toEqual([...dates].sort().reverse());
      for (const e of c.peace ?? []) for (const s of e.sources) expect(s.url).toMatch(/^https:\/\//);
    }
    expect(CONFLICTS.filter((c) => (c.peace?.length ?? 0) > 0).length).toBeGreaterThan(25);
  });

  it('mediators sort last', () => {
    const s = sides(CONFLICT_BY_ID.get('drc-east')!);
    expect(s.at(-1)!.side).toBe('Mediators');
  });

  it('finds the conflicts a country sponsors abroad', () => {
    const rwa = sponsorsAbroad('RWA').map((s) => s.conflict.id);
    expect(rwa).toContain('drc-east');
    expect(rwa).toContain('mozambique');
    expect(sponsorsAbroad('SDN')).toEqual([]);
    const usa = sponsorsAbroad('USA');
    expect(usa.some((s) => s.conflict.id === 'russia-ukraine' && s.backer.support === 'arms')).toBe(true);
    expect(usa.some((s) => s.conflict.id === 'venezuela-us')).toBe(false);
  });

  it('collapses backers per conflict and surfaces them in the dossier', () => {
    const b = backersOf(CONFLICT_BY_ID.get('russia-ukraine')!);
    expect(b.find((x) => x.iso === 'PRK')?.support).toEqual(['troops']);
    expect(sponsorshipDossier('IRN')!.rows.some((r) => r.conflictId === 'yemen')).toBe(true);
    expect(sponsorshipDossier('ISL')).toBeNull();
    expect(countryDossier('IRN')!.sections).toContain('sponsorship');
    expect(countryDossier('ISL')!.sections).not.toContain('sponsorship');
  });
});
