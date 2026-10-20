import { describe, expect, it } from 'vitest';
import { DEFAULT_TITLE, titleFor } from './docTitle';
import { DEFAULT_STATE } from './urlState';

const t = (patch: Partial<typeof DEFAULT_STATE>) => titleFor({ ...DEFAULT_STATE, ...patch });

describe('document title', () => {
  it('names the default view', () => {
    expect(t({})).toBe(DEFAULT_TITLE);
  });

  it('names conflicts with their intensity', () => {
    expect(t({ mode: 'conflicts', selection: { kind: 'conflict', id: 'sudan' } })).toMatch(/^Sudan.* · \w+ intensity — ATLAS$/);
  });

  it('names countries, pairs, comparisons and panels', () => {
    expect(t({ selection: { kind: 'country', iso: 'UKR' } })).toBe('Ukraine — ATLAS');
    expect(t({ selection: { kind: 'pair', a: 'USA', b: 'CHN' } })).toBe('United States ↔ China — ATLAS');
    expect(t({ bloc: 'nato', vs: 'eu', selection: { kind: 'compare' } })).toBe('NATO vs EU — ATLAS');
    expect(t({ selection: { kind: 'changes' } })).toBe('Recent changes — ATLAS');
  });

  it('falls back to the mode or layer when nothing is selected', () => {
    expect(t({ mode: 'conflicts' })).toBe('Conflicts — ATLAS');
    expect(t({ layer: 'sanctions' })).toBe('Sanctions layer — ATLAS');
    expect(t({ brief: true })).toBe('Briefing — ATLAS');
  });
});
