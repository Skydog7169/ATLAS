import { describe, expect, it } from 'vitest';
import { relationship, relationshipSummary } from './relationship';

describe('relationship between two countries', () => {
  it('finds shared blocs, conflict links, sanctions, presence and trade for Russia and Ukraine', () => {
    const r = relationship('UKR', 'RUS', new Date('2026-10-08T00:00:00Z'));
    expect(r.conflicts.some((c) => c.conflict.id === 'russia-ukraine' && c.how === 'both-parties')).toBe(true);
    expect(r.presence.bInA.some((p) => p.host === 'UKR')).toBe(true);
    expect(r.sanctions).toEqual([]);
    expect(r.nuclear.b).toBe('Nuclear-armed');
    expect(relationshipSummary(r)).toMatch(/conflict link/);
  });

  it('shows the US sanctioning Iran and backing Israel against it', () => {
    const r = relationship('USA', 'IRN');
    expect(r.sanctions.find((s) => s.from === 'USA')!.regimes.every((x) => x.authority === 'US')).toBe(true);
    expect(r.conflicts.some((c) => c.conflict.id === 'iran-israel' && c.how === 'both-parties')).toBe(true);
    expect(r.sharedBlocs).toEqual([]);
  });

  it('shows EU-member sanctions and shared blocs for France and Germany', () => {
    const fr = relationship('FRA', 'DEU');
    expect(fr.sharedBlocs.map((s) => s.bloc.id)).toEqual(expect.arrayContaining(['nato', 'eu', 'g7']));
    expect(fr.sanctions).toEqual([]);
    const frRus = relationship('FRA', 'RUS');
    expect(frRus.sanctions.find((s) => s.from === 'FRA')!.regimes.every((x) => x.authority === 'EU')).toBe(true);
  });

  it('reports no ties for an unrelated pair', () => {
    const r = relationship('ISL', 'PRY');
    expect(relationshipSummary(r)).toBe('No tracked ties');
  });
});
