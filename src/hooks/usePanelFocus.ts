import { useEffect, useId, useRef, type RefObject } from 'react';

let appReady = false;

/** Called once the app's first commit is done: panels opened from then on are user-initiated. */
export function markAppReady() {
  appReady = true;
}

function isFocusable(el: Element | null): el is HTMLElement | SVGElement {
  return !!el && el.isConnected && el !== document.body && 'focus' in el && (el as HTMLElement).getClientRects().length > 0;
}

/**
 * Focus management for the detail panel. When the user opens a panel or hops
 * to another one, focus moves to its heading (tabIndex -1) so keyboard and
 * screen-reader users land on the new content and hear its title once. A
 * deep link that opens with a panel leaves focus alone. When the panel
 * closes, focus returns to whatever opened it, or to the map.
 *
 * The heading is found in the DOM rather than threaded through every view;
 * returns the id to point aria-labelledby at.
 */
export function usePanelFocus(sectionRef: RefObject<HTMLElement | null>, key: string): string {
  const headingId = useId();
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const active = document.activeElement;
    opener.current = active && !sectionRef.current?.contains(active) ? active : null;
    return () => {
      const target = opener.current;
      // Only pull focus back if it was in the panel (or lost with it); another overlay may have taken it.
      const lost = !document.activeElement || document.activeElement === document.body;
      if (!lost) return;
      if (isFocusable(target)) target.focus({ preventScroll: true });
      else document.querySelector<SVGSVGElement>('.map-root svg')?.focus({ preventScroll: true });
    };
  }, [sectionRef]);

  useEffect(() => {
    const h2 = sectionRef.current?.querySelector<HTMLHeadingElement>('.panel-head h2');
    if (!h2) return;
    h2.id = headingId;
    h2.tabIndex = -1;
    if (appReady) h2.focus({ preventScroll: true });
  }, [sectionRef, key, headingId]);

  return headingId;
}
