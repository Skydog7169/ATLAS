import { createContext, type ReactNode } from 'react';
import type { Layer, Mode } from '../lib/urlState';

interface LegendChrome {
  mode: Mode;
  layer: Layer;
  /** Turns the overlay off; the legend shows a ✕ when this and a layer are both present. */
  onClearLayer?: () => void;
  /** The map-state strip, drawn above the legend's title. */
  strip?: ReactNode;
}

export const LegendChromeContext = createContext<LegendChrome>({ mode: 'blocs', layer: null });

