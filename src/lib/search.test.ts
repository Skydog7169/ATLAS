import { describe, expect, it } from 'vitest';
import { search } from './search';

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
