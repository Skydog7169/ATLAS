import { useId } from 'react';
import { formatDate, formatMonth } from '../lib/labels';

interface Props {
  months: string[];
  /** Months with at least one new assessment; the rest only carry earlier ones forward. */
  assessed: Set<string>;
  /** Selected month, or null for live. */
  value: string | null;
  onChange: (month: string | null) => void;
  /** Date of the newest bundled change when it is too old to call live. */
  snapshot?: string | null;
}

/**
 * Month scrubber for Conflicts mode. The right-most stop is the live view;
 * earlier stops replay each conflict's assessment in force at that month.
 * Months with no new assessment get hollow ticks so carried-forward data
 * does not read as observed.
 */
export default function Timeline({ months, assessed, value, onChange, snapshot }: Props) {
  const id = useId();
  if (months.length < 2) return null;
  const last = months.length - 1;
  const found = value ? months.indexOf(value) : last;
  // A month off the scale (parse normally clamps these) keeps its own label rather than borrowing the first stop's.
  const idx = found === -1 ? 0 : found;
  const live = value === null || found === last;
  const label = live ? 'Live' : formatMonth(value ?? '');
  const fresh = !live && value !== null && assessed.has(value);
  return (
    <div className="timeline frame" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="label">
        Timeline
      </span>
      <div className="scrub">
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={idx}
          aria-label="Replay month"
          aria-valuetext={live ? (snapshot ? `Snapshot ${formatDate(snapshot)}` : 'Live') : `${label}${fresh ? '' : ', no new assessments'}`}
          onChange={(e) => {
            const i = Number(e.target.value);
            onChange(i >= last ? null : (months[i] ?? null));
          }}
        />
        <div className="ticks" aria-hidden="true">
          {months.map((m, i) => (
            <span key={m} className="tick" data-assessed={i === last || assessed.has(m)} data-current={i === idx} title={i === last ? 'Live' : `${formatMonth(m)}${assessed.has(m) ? '' : ': no new assessments'}`} />
          ))}
        </div>
        <div className="ends" aria-hidden="true">
          <span>{formatMonth(months[0] ?? '')}</span>
          <span>Live</span>
        </div>
      </div>
      <span className={'mono readout' + (live ? ' is-live' : '')} data-fresh={live || fresh} aria-live="polite">
        {live && snapshot ? (
          <>
            <span className="live stale" aria-hidden="true" /> SNAPSHOT {formatDate(snapshot).toUpperCase()}
          </>
        ) : live ? (
          <>
            <span className="live" aria-hidden="true" /> LIVE
          </>
        ) : (
          label.toUpperCase()
        )}
      </span>
      {!live && (
        <button className="text-btn" onClick={() => onChange(null)}>
          Now
        </button>
      )}
    </div>
  );
}
