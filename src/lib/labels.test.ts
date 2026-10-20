import { describe, expect, it } from 'vitest';
import { FRESHNESS, INTENSITY_DEF, INTENSITY_LABEL, UNREST_INTENSITY_LABEL, ageInDays, formatDate, formatDayMonth, formatMonth, isStale, relativeAge } from './labels';

describe('dates and freshness', () => {
  it('formats dates in one en-GB style whatever the browser locale', () => {
    expect(formatDate('2026-10-19')).toBe('19 Oct 2026');
    expect(formatDate('2026-10')).toBe('Oct 2026');
    expect(formatMonth('2026-01')).toBe('Jan 2026');
    expect(formatDayMonth('2026-10-20')).toBe('20 Oct');
    expect(formatMonth('nonsense')).toBe('nonsense');
  });

  it('says how old an entry is and when it may be out of date', () => {
    expect(ageInDays('2026-10-19', '2026-10-20')).toBe(1);
    expect(relativeAge('2026-10-20', '2026-10-20')).toBe('today');
    expect(relativeAge('2026-10-19', '2026-10-20')).toBe('1 day ago');
    expect(relativeAge('2026-10-07', '2026-10-20')).toBe('13 days ago');
    expect(isStale('2026-10-07', 'assessment', '2026-10-20')).toBe(false);
    expect(isStale('2026-10-05', 'assessment', '2026-10-20')).toBe(true);
    expect(isStale('2026-10-12', 'chokepoint', '2026-10-20')).toBe(true);
  });

  it('uses four freshness verbs', () => {
    expect(FRESHNESS.updated('2026-10-19')).toBe('Updated 19 Oct 2026');
    expect(FRESHNESS.checked('2026-10-19')).toBe('Checked 19 Oct 2026, no change');
    expect(FRESHNESS.fetched('2026-10-08')).toBe('Data fetched 8 Oct 2026');
    expect(FRESHNESS.curated('2026-10-08')).toBe('Curated 8 Oct 2026');
  });

  it('defines every intensity and gives unrest its own latent label', () => {
    expect(INTENSITY_LABEL.latent).toBe('Latent (standoff or ceasefire)');
    expect(UNREST_INTENSITY_LABEL.latent).toBe('Subsided');
    for (const k of Object.keys(INTENSITY_LABEL) as Array<keyof typeof INTENSITY_LABEL>) expect(INTENSITY_DEF[k].length).toBeGreaterThan(5);
  });
});
