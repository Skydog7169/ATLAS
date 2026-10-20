import { describe, expect, it } from 'vitest';
import { fold, groupHits, search } from './search';

describe('search', () => {
  it('returns nothing for blank queries', () => {
    expect(search('')).toEqual([]);
    expect(search('   ')).toEqual([]);
  });

  it('ranks an exact country name first', () => {
    const [first] = search('France');
    expect(first).toMatchObject({ kind: 'country', id: 'FRA' });
  });

  it('finds blocs by abbreviation and full name', () => {
    expect(search('nato')[0]).toMatchObject({ kind: 'bloc', id: 'nato' });
    expect(search('european union')[0]).toMatchObject({ kind: 'bloc', id: 'eu' });
  });

  it('finds conflicts by party name', () => {
    expect(search('houthi').some((h) => h.kind === 'conflict' && h.id === 'yemen')).toBe(true);
  });

  it('matches ISO codes and capitals', () => {
    expect(search('DEU')[0]).toMatchObject({ kind: 'country', id: 'DEU' });
    expect(search('Nairobi')[0]).toMatchObject({ kind: 'country', id: 'KEN' });
  });

  it('respects the limit', () => {
    expect(search('a', 5)).toHaveLength(5);
  });
});

describe('search: names people actually type', () => {
  const top = (q: string) => search(q)[0];

  it.each([
    ['turkey', 'TUR'],
    ['turkiye', 'TUR'],
    ['Türkiye', 'TUR'],
    ['uae', 'ARE'],
    ['burma', 'MMR'],
    ['uk', 'GBR'],
    ['dprk', 'PRK'],
    ["cote d'ivoire", 'CIV'],
    ['cote d’ivoire', 'CIV'],
    ['sao tome', 'STP'],
    ['drc', 'COD'],
    ['holland', 'NLD'],
    ['east timor', 'TLS'],
    ['swaziland', 'SWZ'],
    ['macedonia', 'MKD'],
    ['guinea-bissau', 'GNB'],
    ['guinea bissau', 'GNB'],
  ])('%s → %s', (q, iso) => {
    expect(top(q)).toMatchObject({ kind: 'country', id: iso });
  });

  it('puts the UK ahead of Ukraine for "uk"', () => {
    const hits = search('uk');
    const gbr = hits.findIndex((h) => h.kind === 'country' && h.id === 'GBR');
    const ukr = hits.findIndex((h) => h.kind === 'country' && h.id === 'UKR');
    expect(gbr).toBe(0);
    expect(ukr === -1 || ukr > gbr).toBe(true);
  });

  it.each([
    ['usa china', 'USA', 'CHN'],
    ['israel iran', 'ISR', 'IRN'],
    ['us vs china', 'USA', 'CHN'],
    ['united states and china', 'USA', 'CHN'],
  ])('two countries in "%s" lead with the relationship view', (q, a, b) => {
    expect(top(q)).toMatchObject({ kind: 'pair', a, b, label: expect.stringContaining('↔') });
  });

  it('does not split one multi-word country into a pair', () => {
    expect(search('trinidad and tobago').some((h) => h.kind === 'pair')).toBe(false);
    expect(search('south sudan').some((h) => h.kind === 'pair')).toBe(false);
    expect(search('papua new guinea')[0]).toMatchObject({ kind: 'country', id: 'PNG' });
  });

  it('finds chokepoints, layers and actions by name', () => {
    expect(top('suez')).toMatchObject({ kind: 'chokepoint', id: 'suez' });
    expect(search('hormuz').some((h) => h.kind === 'chokepoint' && h.id === 'hormuz')).toBe(true);
    expect(search('hormuz').some((h) => h.kind === 'conflict')).toBe(true);
    expect(top('sanctions')).toMatchObject({ kind: 'layer', id: 'sanctions' });
    expect(top('nuclear')).toMatchObject({ kind: 'layer', id: 'nuclear' });
    expect(top('briefing')).toMatchObject({ kind: 'action', id: 'brief' });
    expect(top('compare')).toMatchObject({ kind: 'action', id: 'compare' });
  });

  it('only offers layers this build can draw', () => {
    // ACLED and UCDP are credential-gated; without them the layer must not be searchable.
    expect(search('violence events').some((h) => h.kind === 'layer' && h.id === 'acled')).toBe(false);
  });

  it('requires every token to match when the phrase itself does not', () => {
    expect(search('war sudan').some((h) => h.kind === 'conflict' && h.id === 'sudan')).toBe(true);
  });
});

describe('search: mode-aware ranking', () => {
  it('opens the war, not the dossier, for "sudan" in Conflicts mode', () => {
    expect(search('sudan', { mode: 'conflicts' })[0]).toMatchObject({ kind: 'conflict', id: 'sudan' });
    expect(search('sudan', { mode: 'blocs' })[0]).toMatchObject({ kind: 'country', id: 'SDN' });
    expect(search('sudan')[0]).toMatchObject({ kind: 'country', id: 'SDN' });
  });
});

describe('groupHits', () => {
  it('groups by kind in ranked order', () => {
    const groups = groupHits(search('sudan', { mode: 'conflicts' }));
    expect(groups[0]!.label).toBe('Conflicts & unrest');
    expect(groups.map((g) => g.label)).toContain('Countries');
  });
});

describe('fold', () => {
  it('strips diacritics and normalises apostrophes and dashes', () => {
    expect(fold('Côte d’Ivoire')).toBe("cote d'ivoire");
    expect(fold('İmamoğlu')).toBe('imamoglu');
    expect(fold('Russia–Ukraine')).toBe('russia ukraine');
  });
});
