import { useId } from 'react';
import { formatMonth } from '../lib/labels';

interface Props {
  months: string[];
  /** Selected month, or null for live. */
  value: string | null;
  onChange: (month: string | null) => void;
}

/**
 * Month scrubber for Conflicts mode. The right-most stop is the live view;
 * earlier stops replay each conflict's assessment in force at that month.
 */
export default function Timeline({ months, value, onChange }: Props) {
  const id = useId();
  if (months.length < 2) return null;
  const last = months.length - 1;
  const idx = value ? Math.max(0, months.indexOf(value)) : last;
  const live = value === null || idx === last;
  return (
    <div className="timeline frame" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="label">
        Timeline
      </span>
      <input
        type="range"
        min={0}
        max={last}
        step={1}
        value={idx}
        aria-label="Replay month"
        aria-valuetext={live ? 'Live' : formatMonth(months[idx] ?? '')}
        onChange={(e) => {
          const i = Number(e.target.value);
          onChange(i >= last ? null : (months[i] ?? null));
        }}
      />
      <span className={'mono readout' + (live ? ' is-live' : '')} aria-live="polite">
        {live ? (
          <>
            <span className="live" aria-hidden="true" /> LIVE
          </>
        ) : (
          formatMonth(months[idx] ?? '').toUpperCase()
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
