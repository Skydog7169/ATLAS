import type { MapStateSegment } from '../lib/mapState';
import type { AppState } from '../lib/urlState';
import Icon from './Icon';

interface Props {
  segments: MapStateSegment[];
  onClear: (patch: Partial<AppState>) => void;
  /** Absent when the map is already the default. */
  onReset?: () => void;
}

/**
 * A breadcrumb of what the map is showing ("CONFLICTS › OVERLAY: SANCTIONS ›
 * REPLAY MAR 2026"), so nothing that changes the colours is ever invisible.
 * Each piece can be removed on its own, and Reset returns to the default map.
 */
export default function MapStateStrip({ segments, onClear, onReset }: Props) {
  // Mode alone is the default map: the legend title already says it.
  if (segments.length < 2 && !onReset) return null;
  return (
    <nav className="map-state" aria-label="Map state">
      <div className="map-state-path">
        {segments.map((s) => (
          // Spans, not list items: the PNG export reads every legend <li> as a key row.
          <span className="map-state-seg" key={s.key} data-key={s.key}>
            <span>{s.label}</span>
            {s.clear && (
              <button type="button" className="map-state-clear" aria-label={s.clearLabel} title={s.clearLabel} onClick={() => onClear(s.clear!)}>
                <Icon name="close" size={10} />
              </button>
            )}
          </span>
        ))}
      </div>
      {onReset && (
        <button type="button" className="map-state-reset" onClick={onReset} title="Back to the default map">
          Reset
        </button>
      )}
    </nav>
  );
}
