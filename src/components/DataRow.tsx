import type { ReactNode } from 'react';
import type { Intensity } from '../data/types';
import { INTENSITY_COLOR, INTENSITY_SHORT } from '../lib/labels';

export interface DataRowData {
  label: string;
  value: string;
  note?: string;
  intensity?: Intensity;
  share?: number;
}

/**
 * One dossier row: label and note on the left, the value the reader came for
 * on the right in a fixed column on the title line. Intensity renders as the
 * same dot-and-label pill everywhere; a share renders as an inline bar.
 */
export function DataRowBody({ label, value, note, intensity, share, suffix }: DataRowData & { suffix?: ReactNode }) {
  return (
    <>
      <span className="data-label">
        {label}
        {note && <span className="row-note">{note}</span>}
        {share !== undefined && (
          <span className="share-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} />
          </span>
        )}
      </span>
      <span className="data-value">
        {intensity && (
          <span className="pill" style={{ ['--pill-color' as string]: INTENSITY_COLOR[intensity] }}>
            <span className="dot" aria-hidden="true" />
            {INTENSITY_SHORT[intensity]}
          </span>
        )}
        {value && <span>{value}</span>}
        {suffix}
      </span>
    </>
  );
}
