import { describe, expect, it } from 'vitest';
import { nearestSnap, nextSnap } from '../hooks/useSheet';
import { estimateInsets } from '../hooks/useMapInsets';
import { layerSummary } from './layerSummary';
import { captionFor } from './caption';

describe('bottom sheet snaps', () => {
  it('cycles peek → half → full → peek', () => {
    expect(nextSnap('peek')).toBe('half');
    expect(nextSnap('half')).toBe('full');
    expect(nextSnap('full')).toBe('peek');
  });
  it('settles on the nearest snap', () => {
    expect(nearestSnap(250, 800)).toBe('peek');
    expect(nearestSnap(430, 800)).toBe('half');
    expect(nearestSnap(760, 800)).toBe('full');
  });
});

describe('estimateInsets', () => {
  it('reserves the sheet on phones and the panel on desktop', () => {
    expect(estimateInsets(true, true, 915)).toEqual({ top: 0, right: 0, bottom: Math.round(915 * 0.52) });
    expect(estimateInsets(false, true, 915)).toEqual({ top: 0, right: 0, bottom: 0 });
    expect(estimateInsets(true, false, 900).right).toBeGreaterThan(400);
  });
});

describe('layerSummary', () => {
  it('reads a country on the active layer and nothing without one', () => {
    expect(layerSummary('sanctions', 'PRK')).toMatch(/^Sanctions: /);
    expect(layerSummary(null, 'PRK')).toBeNull();
    expect(layerSummary('chokepoints', 'PRK')).toBeNull();
  });
});

describe('captionFor', () => {
  it('describes deep-linked subjects for the embed caption', () => {
    expect(captionFor({ kind: 'conflict', id: 'sudan' })?.title).toMatch(/Sudan/);
    expect(captionFor({ kind: 'conflict', id: 'sudan' })?.kicker).toMatch(/since \d{4}/);
    expect(captionFor({ kind: 'pair', a: 'USA', b: 'CHN' })?.title).toBe('United States and China');
    expect(captionFor({ kind: 'about' })).toBeNull();
  });
});
