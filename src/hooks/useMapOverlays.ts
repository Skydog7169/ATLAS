import { useCallback, useRef, useState, useSyncExternalStore } from 'react';

type HoverHandler = (hover: { label: string; sub?: string; iso?: string | null } | null, x: number, y: number) => void;

/** Tracks the hovered country for CountryOutlines while passing hover events through; the wrapper is stable so CountryLayer stays memoised. */
export function useHoverIso(onHover: HoverHandler): [string | null, HoverHandler] {
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const ref = useRef(onHover);
  ref.current = onHover;
  const wrapped = useCallback<HoverHandler>((h, x, y) => {
    setHoverIso(h?.iso ?? null);
    ref.current(h, x, y);
  }, []);
  return [hoverIso, wrapped];
}

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener('change', cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener('change', cb);
  };
}

/** The active theme as a string key; changes when the toggle or the OS preference does. */
export function useThemeKey(): string {
  return useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.dataset.theme ?? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
    () => 'dark',
  );
}

