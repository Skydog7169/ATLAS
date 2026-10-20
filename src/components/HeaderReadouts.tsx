import type { ReactNode } from 'react';
import { useSeen } from '../hooks/useSeen';
import { COUNTS, DATA_ASOF } from '../lib/frontdoor';
import { formatDate, formatDayMonth } from '../lib/labels';

/**
 * Header readouts, most important first: when the data last changed (a real
 * button into Latest changes, never hidden, with a dot while anything is
 * unseen), then what is tracked. The counts give way first on narrow screens
 * so search keeps its width.
 */
export default function HeaderReadouts({ onOpenChanges, open, children }: { onOpenChanges: (since: boolean) => void; open: boolean; children?: ReactNode }) {
  const { unseen } = useSeen();
  return (
    <div className="readouts" aria-label="Status readouts">
      <button
        className="readout-btn freshness"
        onClick={() => onOpenChanges(unseen.length > 0)}
        aria-pressed={open}
        aria-label={`Latest changes, data updated ${formatDate(DATA_ASOF)}${unseen.length ? `, ${unseen.length} unseen` : ''}`}
        title="Latest changes"
      >
        <span className="long">UPDATED</span>
        <span className="short">UPD</span> <b>{formatDayMonth(DATA_ASOF).toUpperCase()}</b>
        {unseen.length > 0 && <span className="readout-dot" aria-hidden="true" />}
      </button>
      <span className="counts">
        <b>{COUNTS.conflicts}</b> CONFLICTS · <b>{COUNTS.unrest}</b> UNREST · <b>{COUNTS.blocs}</b> BLOCS
      </span>
      {children}
    </div>
  );
}
