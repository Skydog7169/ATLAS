import { describe, expect, it } from 'vitest';
import { menuPlacement } from './menuPlacement';

describe('menu placement', () => {
  it('opens upward from a trigger near the bottom and caps the height to the room above', () => {
    // 1280x720: stage from 56 to 720, layers button near the bottom right.
    expect(menuPlacement({ top: 470, bottom: 506 }, { top: 56, bottom: 720 })).toEqual({ side: 'up', maxHeight: 442 });
  });

  it('opens downward from a trigger at the top (phones)', () => {
    expect(menuPlacement({ top: 112, bottom: 148 }, { top: 56, bottom: 412 })).toEqual({ side: 'down', maxHeight: 292 });
  });

  it('never collapses below a usable height', () => {
    expect(menuPlacement({ top: 60, bottom: 96 }, { top: 56, bottom: 150 }).maxHeight).toBe(120);
  });
});
