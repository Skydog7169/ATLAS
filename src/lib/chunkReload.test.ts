import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RELOAD_KEY, isChunkError, reloadOnce } from './chunkReload';

describe('chunk reload', () => {
  beforeEach(() => sessionStorage.clear());

  it('recognises stale-chunk errors across browsers', () => {
    expect(isChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/GlobeMap-abc.js'))).toBe(true);
    expect(isChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('reloads once, then refuses inside the loop window', () => {
    const reload = vi.fn();
    expect(reloadOnce(reload)).toBe(true);
    expect(reloadOnce(reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again once the previous reload is old', () => {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now() - 5 * 60_000));
    const reload = vi.fn();
    expect(reloadOnce(reload)).toBe(true);
  });
});
