import type { ReactNode } from 'react';
import { formatMonth } from '../lib/labels';

interface Props {
  href: string;
  logo: ReactNode;
  /** Replay month, or null for the live view. */
  month: string | null;
  /** Newest data month, YYYY-MM. */
  dataAsof: string;
}

function longMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** The one element every embed shows: where to open the view and what date it shows. */
export default function EmbedBadge({ href, logo, month, dataAsof }: Props) {
  const label = month ? `Open this view in ATLAS, replay of ${longMonth(month)}` : `Open this view in ATLAS, data as of ${longMonth(dataAsof)}`;
  return (
    <a className="embed-badge" href={href} target="_blank" rel="noopener noreferrer" aria-label={label} data-replay={month !== null}>
      {logo}
      <span className="word">ATLAS</span> ↗<span className="sep">·</span>
      <span className="when">{month ? `REPLAY · ${formatMonth(month).toUpperCase()}` : `DATA ${formatMonth(dataAsof).toUpperCase()}`}</span>
    </a>
  );
}
