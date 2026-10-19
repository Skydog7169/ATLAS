import { describe, expect, it } from 'vitest';
import { daysBetween, hotSelection } from '../../scripts/research/select.mjs';
import { CONFLICTS } from '../data/conflicts';
import { UNREST } from '../data/unrest';

const entry = (id: string, intensity: string, date: string, lastChecked?: string) => ({ id, history: [{ date, intensity }], ...(lastChecked ? { lastChecked } : {}) });

describe('hot list selection', () => {
  const today = '2026-10-19';

  it('counts days', () => {
    expect(daysBetween('2026-10-05', today)).toBe(14);
    expect(daysBetween(today, today)).toBe(0);
  });

  it('keeps high intensity, recent updates and stale entries, and drops quiet ones', () => {
    const picked = hotSelection(
      [
        entry('high-old', 'high', '2026-06-01'),
        entry('medium-recent', 'medium', '2026-10-10'),
        entry('low-quiet', 'low', '2026-10-01', '2026-10-15'),
        entry('latent-stale', 'latent', '2026-08-01'),
        entry('low-rechecked', 'low', '2026-08-01', '2026-10-18'),
      ],
      today,
    ).map((e) => e.id);
    expect(picked[0]).toBe('high-old');
    expect(picked).toContain('medium-recent');
    expect(picked).toContain('latent-stale');
    expect(picked).not.toContain('low-quiet');
    expect(picked).not.toContain('low-rechecked');
  });

  it('caps the list and puts high intensity first', () => {
    const many = Array.from({ length: 20 }, (_, i) => entry(`e${i}`, i < 3 ? 'high' : 'medium', '2026-10-18'));
    const picked = hotSelection(many, today, { cap: 5 });
    expect(picked).toHaveLength(5);
    expect(picked.slice(0, 3).every((e) => e.history[0]!.intensity === 'high')).toBe(true);
  });

  it('selects a bounded hot list from the live data', () => {
    const conflicts = hotSelection(CONFLICTS, today, { cap: 8 });
    const unrest = hotSelection(UNREST, today, { cap: 6 });
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.length).toBeLessThanOrEqual(8);
    expect(unrest.length).toBeLessThanOrEqual(6);
    expect(conflicts.every((c) => c.intensity === 'high' || daysBetween(c.updated, today) <= 14 || daysBetween(c.lastChecked ?? c.updated, today) >= 21)).toBe(true);
  });
});
