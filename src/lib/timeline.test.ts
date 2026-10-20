import { describe, expect, it } from 'vitest';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { clampMonth } from './history';
import { ASSESSED_MONTHS, TIMELINE_MONTHS, clampNotice, replayBadge, timelineMonth } from './timeline';

describe('timeline', () => {
  it('starts at the first assessment and ends at the live month', () => {
    expect(TIMELINE_MONTHS[0]).toBe('2025-12');
    expect(TIMELINE_MONTHS.at(-1)).toBe(new Date().toISOString().slice(0, 7));
  });

  it('knows which months carry no new assessment', () => {
    expect(ASSESSED_MONTHS.has('2025-12')).toBe(true);
    const gaps = TIMELINE_MONTHS.filter((m) => !ASSESSED_MONTHS.has(m));
    expect(gaps.length).toBeGreaterThan(0);
  });

  it('clamps link months through the validator', () => {
    expect(timelineMonth('2023-01')).toBe(TIMELINE_MONTHS[0]);
    expect(timelineMonth('2099-01')).toBeNull();
  });

  it('explains a clamped link', () => {
    const months = ['2025-12', '2026-01', '2026-02'];
    expect(clampNotice('2023-01', months)).toMatch(/^Replay starts Dec(ember)? 2025/);
    expect(clampNotice('2099-01', months)).toMatch(/live map/);
    expect(clampNotice('2026-01', months)).toBeNull();
    expect(clampNotice(null, months)).toBeNull();
    expect(clampMonth('2026-02', months).month).toBeNull();
  });

  it('says when a replayed assessment is carried forward', () => {
    const iran = CONFLICT_BY_ID.get('iran-israel')!;
    const month = TIMELINE_MONTHS.find((m) => m > '2025-12' && !iran.history.some((h) => h.date.startsWith(m)))!;
    expect(replayBadge(iran, month)).toMatch(/^Last assessed .*2025 · no assessment on record for /);
    expect(replayBadge(iran, '2025-12')).toMatch(/^Assessed /);
    const balochistan = CONFLICT_BY_ID.get('balochistan')!;
    expect(replayBadge(balochistan, '2025-12')).toMatch(/^Not yet tracked in /);
  });
});
