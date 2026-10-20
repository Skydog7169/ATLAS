import { formatMonth } from '../lib/labels';

interface Props {
  /** Replay month, or null when live. */
  month: string | null;
  /** Out-of-range link notice, shown once. */
  notice: string | null;
  onLive: () => void;
  onDismissNotice: () => void;
}

/** Map-level banner while replaying, so a past state never passes for the live map. */
export default function ReplayBanner({ month, notice, onLive, onDismissNotice }: Props) {
  if (!month && !notice) return null;
  return (
    <div className="replay-banner" role="status">
      {month && (
        <div className="replay-row">
          <span className="replay-tag">Replay · {formatMonth(month).toUpperCase()}</span>
          <button className="text-btn" onClick={onLive}>
            Return to live
          </button>
        </div>
      )}
      {notice && (
        <div className="replay-notice">
          <span>{notice}</span>
          <button className="text-btn" aria-label="Dismiss notice" onClick={onDismissNotice}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
