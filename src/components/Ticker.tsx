import { useMemo } from 'react';
import { useWatchlist } from '../hooks/useWatchlist';
import { CHANGES, tickerItems } from '../lib/feed';
import type { ChangeItem } from '../lib/history';
import { INTENSITY_COLOR, INTENSITY_LABEL, formatDate } from '../lib/labels';

interface Props {
  onSelectConflict: (id: string) => void;
  onSelectBloc: (id: string) => void;
}

export const TICKER_COUNT = 10;

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

/**
 * Bottom strip cycling the newest dated assessments and membership changes.
 * The track is duplicated so the loop is seamless; the copy is hidden from
 * assistive tech. Hover or keyboard focus pauses the motion (CSS), and
 * reduced-motion users get a plain horizontal scroller instead.
 */
export default function Ticker({ onSelectConflict, onSelectBloc }: Props) {
  const { filter, only, items: starred, setOnly } = useWatchlist();
  const items = useMemo(() => tickerItems(CHANGES, filter, TICKER_COUNT), [filter]);
  const open = (it: ChangeItem) => (it.kind === 'conflict' ? onSelectConflict(it.id) : onSelectBloc(it.id));
  const duration = `${Math.max(30, items.length * 7)}s`;

  const render = (hidden: boolean) => (
    <ul className="ticker-track" aria-hidden={hidden || undefined} style={{ animationDuration: duration }}>
      {items.map((it, i) => (
        <li key={it.kind + it.id + it.date + i}>
          <button type="button" tabIndex={hidden ? -1 : 0} onClick={() => open(it)} data-kind={it.kind} data-id={it.id}>
            <span className="dot" style={{ background: it.intensity ? INTENSITY_COLOR[it.intensity] : it.color }} aria-hidden="true" />
            <span className="when">{formatDate(it.date)}</span>
            <span className="title">{it.title}</span>
            <span className="tag">{it.kind === 'conflict' ? INTENSITY_LABEL[it.intensity!] : 'Membership'}</span>
            <span className="detail">{clip(it.detail, 110)}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="ticker" role="region" aria-label="Latest changes">
      <span className="ticker-label">
        <span className="live" aria-hidden="true" />
        <span>FEED</span>
      </span>
      <div className="ticker-viewport" data-empty={items.length === 0}>
        {items.length === 0 ? (
          <p className="ticker-empty">{starred.length === 0 ? 'Star a country, bloc or conflict to build your watchlist.' : 'No dated changes for your watchlist yet.'}</p>
        ) : (
          <>
            {render(false)}
            {render(true)}
          </>
        )}
      </div>
      <button className={'ticker-filter' + (only ? ' on' : '')} aria-pressed={only} onClick={() => setOnly(!only)} title="Show only watchlist items">
        <svg width="12" height="12" viewBox="0 0 24 24" fill={only ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="m12 3 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8L12 3Z" />
        </svg>
        <span>Watchlist</span>
      </button>
    </div>
  );
}
