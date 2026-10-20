import { useState, type ReactNode } from 'react';
import { useMediaQuery } from '../hooks/useMapInsets';

const KEY = 'atlas:legend';
/** Phones, and phones in landscape: the legend starts as a one-line pill. */
const COMPACT = '(max-width: 820px), (max-height: 520px) and (pointer: coarse)';

function readPref(): 'open' | 'closed' | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'open' || v === 'closed' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Positions the legend and, on small screens, collapses it to its title and
 * swatches so it stops covering the data-dense south. The choice persists.
 */
export default function LegendDock({ panelOpen, children }: { panelOpen: boolean; children: ReactNode }) {
  const compact = useMediaQuery(COMPACT);
  const sheet = useMediaQuery('(max-width: 820px)');
  const [pref, setPref] = useState(readPref);
  // Above an open bottom sheet the map strip is short: the pill stays collapsed
  // unless opened for this panel.
  const squeezed = sheet && panelOpen;
  const [peek, setPeek] = useState<{ open: boolean; panelOpen: boolean } | null>(null);
  const peekOpen = peek && peek.panelOpen === panelOpen ? peek.open : false;
  const collapsed = compact && (squeezed ? !peekOpen : pref !== 'open');
  const toggle = () => {
    if (squeezed) {
      setPeek({ open: collapsed, panelOpen });
      return;
    }
    const next = collapsed ? 'open' : 'closed';
    setPref(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the choice lasts for this page view.
    }
  };
  return (
    <div className="legend-dock" data-collapsed={collapsed}>
      {children}
      {compact && (
        <button type="button" className="legend-toggle" aria-expanded={!collapsed} aria-label={collapsed ? 'Expand legend' : 'Collapse legend'} onClick={toggle}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d={collapsed ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
          </svg>
        </button>
      )}
    </div>
  );
}
