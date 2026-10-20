import { useMemo, useState } from 'react';
import { useWatchlist } from '../hooks/useWatchlist';
import { CHANGES, tickerItems } from '../lib/feed';
import type { ChangeItem } from '../lib/history';
import { deltaWord, itemColor, kindTag } from '../lib/delta';
import { formatDate } from '../lib/labels';

interface Props {
  onSelectConflict: (id: string) => void;
  onSelectBloc: (id: string) => void;
  onSelectUnrest: (id: string) => void;
}

export const TICKER_COUNT = 10;

export const PAUSED_KEY = 'atlas.tickerPaused';

function readPaused(): boolean {
  try {
    return window.localStorage.getItem(PAUSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writePaused(paused: boolean) {
  try {
    window.localStorage.setItem(PAUSED_KEY, paused ? '1' : '0');
  } catch {
    /* the choice lasts for this page only */
  }
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

/**
 * Bottom strip cycling the week's most significant assessments and membership
 * changes (see tickerItems). The track is duplicated so the loop is seamless;
 * the copy is hidden from assistive tech. Hover or keyboard focus pauses the
 * motion (CSS); the Pause button, and the reduced-motion preference, turn it
 * into a plain horizontal scroller.
 */
export default function Ticker({ onSelectConflict, onSelectBloc, onSelectUnrest }: Props) {
  const { filter, only, items: starred, setOnly } = useWatchlist();
  const items = useMemo(() => tickerItems(CHANGES, filter, TICKER_COUNT), [filter]);
  const open = (it: ChangeItem) => (it.kind === 'conflict' ? onSelectConflict(it.id) : it.kind === 'unrest' ? onSelectUnrest(it.id) : onSelectBloc(it.id));
  const duration = `${Math.max(30, items.length * 7)}s`;
  const [paused, setPaused] = useState(readPaused);
  const togglePaused = () => {
    writePaused(!paused);
    setPaused(!paused);
  };

  const render = (hidden: boolean) => (
    <ul className="ticker-track" aria-hidden={hidden || undefined} style={{ animationDuration: duration }}>
      {items.map((it, i) => (
        <li key={it.kind + it.id + it.date + i}>
          <button type="button" tabIndex={hidden ? -1 : 0} onClick={() => open(it)} data-kind={it.kind} data-id={it.id}>
            <span className={'dot' + (it.kind === 'unrest' ? ' triangle' : '')} style={{ background: itemColor(it) }} aria-hidden="true" />
            <span className="when">{formatDate(it.date)}</span>
            <span className="title">{it.title}</span>
            <span className="tag" data-kind={it.kind}>
              {kindTag(it)}
            </span>
            {deltaWord(it.delta) && (
              <span className="delta" data-delta={it.delta}>
                {deltaWord(it.delta)}
              </span>
            )}
            <span className="detail">{clip(it.detail, 110)}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={'ticker' + (paused ? ' paused' : '')} role="region" aria-label="Latest changes">
      <span className="ticker-label">
        <span className="live" aria-hidden="true" />
        <span>LATEST{only ? ' · STARRED' : ''}</span>
      </span>
      <button className="ticker-pause" aria-pressed={paused} aria-label="Pause feed" title={paused ? 'Resume scrolling' : 'Pause feed'} onClick={togglePaused}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {paused ? <path d="M7 4v16l13-8Z" /> : <path d="M6 4h4v16H6zM14 4h4v16h-4z" />}
        </svg>
      </button>
      <div className="ticker-viewport" data-empty={items.length === 0}>
        {items.length === 0 ? (
          <p className="ticker-empty">{starred.length === 0 ? 'Star a country, bloc, conflict or unrest episode to use this filter.' : 'No dated changes for your starred items yet.'}</p>
        ) : (
          <>
            {render(false)}
            {render(true)}
          </>
        )}
      </div>
      <button className={'ticker-filter' + (only ? ' on' : '')} aria-pressed={only} onClick={() => setOnly(!only)} aria-label="Show only starred items" title="Show only starred items">
        <svg width="12" height="12" viewBox="0 0 24 24" fill={only ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 4h18l-7 8.5V19l-4 2v-8.5Z" />
        </svg>
        <span>Starred only</span>
        <span className="short" aria-hidden="true">
          ★ Only
        </span>
      </button>
    </div>
  );
}
