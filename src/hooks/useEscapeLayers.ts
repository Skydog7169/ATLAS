import { useEffect, useRef } from 'react';

interface Layers {
  brief: boolean;
  picking: boolean;
  panelOpen: boolean;
  onCancelPicking: () => void;
  onClosePanel: () => void;
}

/**
 * One app-level Escape that peels back one layer per press: compare picking
 * first, then the detail panel. Popovers (search, layer menu, briefing)
 * handle their own Escape and call preventDefault, which this respects; so
 * does a non-empty text field, where Escape belongs to the field.
 */
export function useEscapeLayers(layers: Layers) {
  const ref = useRef(layers);
  useEffect(() => {
    ref.current = layers;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target;
      if ((t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) && t.type !== 'range' && t.value) return;
      const l = ref.current;
      if (l.brief) return;
      if (l.picking) {
        e.preventDefault();
        l.onCancelPicking();
        document.querySelector<HTMLButtonElement>('.chip.compare')?.focus();
      } else if (l.panelOpen) {
        e.preventDefault();
        l.onClosePanel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
