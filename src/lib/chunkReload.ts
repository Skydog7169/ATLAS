import { lazy, type ComponentType } from 'react';

/**
 * Each deploy renames the hashed chunks and serves only the new build, so a tab
 * left open across a deploy fails its first lazy import. The fix is a reload:
 * the hash keeps the view, selection and brief=1. A sessionStorage stamp stops a
 * genuinely broken chunk from reloading in a loop.
 */
export const RELOAD_KEY = 'atlas:reloaded';
const LOOP_WINDOW_MS = 60_000;

export function isChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk|ChunkLoadError/i.test(msg);
}

/** Reloads the page unless it already did so in the last minute; returns whether it reloaded. */
export function reloadOnce(reload: () => void = () => window.location.reload()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < LOOP_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Without storage there is no loop guard; let the error boundary offer the reload instead.
    return false;
  }
  reload();
  return true;
}

/** React.lazy that reloads once when the chunk has been replaced by a newer deploy. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same constraint as React.lazy
export function lazyWithReload<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((error: unknown) => {
      // The page is reloading; never settle so React keeps the skeleton up meanwhile.
      if (isChunkError(error) && reloadOnce()) return new Promise<{ default: T }>(() => {});
      throw error;
    }),
  );
}

/** Vite fires this when a preloaded dependency of a dynamic import fails to load. */
export function installChunkReload() {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnce()) event.preventDefault();
  });
}
