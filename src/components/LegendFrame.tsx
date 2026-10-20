import { useContext, type ReactNode } from 'react';
import { INTENSITY_COLOR, INTENSITY_LABEL } from '../lib/labels';
import type { Intensity } from '../data/types';
import Icon from './Icon';
import { LegendChromeContext } from './legendChrome';

const INTENSITIES: Intensity[] = ['high', 'medium', 'low', 'latent'];

/** The aside every legend variant renders into: state strip on top, conflict key below a layer. */
export function LegendFrame({ children }: { children: ReactNode }) {
  const { mode, layer, strip } = useContext(LegendChromeContext);
  return (
    <aside className="legend" aria-label="Legend">
      {strip}
      {children}
      {/* A layer replaces the conflict fill, but the round markers keep their intensity colours. */}
      {mode === 'conflicts' && layer && (
        <div className="legend-intensity">
          <div className="legend-sub">Conflict markers</div>
          <ul>
            {INTENSITIES.map((i) => (
              <li key={i}>
                <span className="swatch circle" style={{ background: INTENSITY_COLOR[i] }} />
                {INTENSITY_LABEL[i].replace(/ intensity$/i, '')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

/** Legend heading; under a data layer it carries the ✕ that turns the layer off. */
export function LegendTitle({ children }: { children: ReactNode }) {
  const { layer, onClearLayer } = useContext(LegendChromeContext);
  return (
    <h2 className="legend-title">
      <span>{children}</span>
      {layer && onClearLayer && (
        <button type="button" className="legend-clear" aria-label="Clear overlay" title="Clear overlay" onClick={onClearLayer}>
          <Icon name="close" size={12} />
        </button>
      )}
    </h2>
  );
}
