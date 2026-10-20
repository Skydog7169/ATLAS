import { useEffect, useId, useRef, type RefObject } from 'react';

let appReady = false;
// The first commit is not enough to tell a user-opened panel from a deep link: the
// panel renders lazily and can land after it. So a panel only takes focus once the
// reader has pressed a key or a pointer in the page.
let userActed = false;
if (typeof window !== 'undefined') {
  const mark = () => {
    userActed = true;
  };
  window.addEventListener('pointerdown', mark, { capture: true, once: true });
  window.addEventListener('keydown', mark, { capture: true, once: true });
}

/** Called once the app's first commit is done: panels opened from then on may be user-initiated. */
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
      if (!lost || !document.hasFocus()) return;
      if (isFocusable(target)) target.focus({ preventScroll: true });
      else document.querySelector<SVGSVGElement>('.map-root svg')?.focus({ preventScroll: true });
    };
  }, [sectionRef]);

  useEffect(() => {
    const h2 = sectionRef.current?.querySelector<HTMLHeadingElement>('.panel-head h2');
    if (!h2) return;
    h2.id = headingId;
    h2.tabIndex = -1;
    // Never pull focus out of a text field the user has moved into meanwhile (the panel can render a beat late).
    const active = document.activeElement;
    const typing = (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && !sectionRef.current?.contains(active);
    // document.hasFocus(): an embed must not pull focus out of its host page before the reader has used it.
    if (appReady && userActed && !typing && document.hasFocus()) h2.focus({ preventScroll: true });
  }, [sectionRef, key, headingId]);

  return headingId;
}
