import type { ReactNode } from 'react';
import { COUNTS, DATA_ASOF } from '../lib/frontdoor';
import { formatDate, formatDayMonth } from '../lib/labels';

/**
 * Header readouts, most important first: when the data last changed (a real
 * button into Latest changes, never hidden), then what is tracked. The counts
 * give way first on narrow screens so search keeps its width.
 */
export default function HeaderReadouts({ onOpenChanges, open, children }: { onOpenChanges: () => void; open: boolean; children?: ReactNode }) {
  return (
    <div className="readouts" aria-label="Status readouts">
      <button className="readout-btn freshness" onClick={onOpenChanges} aria-pressed={open} aria-label={`Latest changes, data updated ${formatDate(DATA_ASOF)}`} title="Latest changes">
        <span className="long">UPDATED</span>
        <span className="short">UPD</span> <b>{formatDayMonth(DATA_ASOF).toUpperCase()}</b>
      </button>
      <span className="counts">
        <b>{COUNTS.conflicts}</b> CONFLICTS · <b>{COUNTS.unrest}</b> UNREST · <b>{COUNTS.blocs}</b> BLOCS
      </span>
      {children}
    </div>
  );
}
