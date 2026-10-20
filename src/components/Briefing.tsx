import { useEffect, useRef, useState } from 'react';
import type { HistoryEntry } from '../data/types';
import { INTENSITY_COLOR, formatDate } from '../lib/labels';
import { shortProvenance } from '../lib/sources';
import { DATA_ASOF } from '../lib/frontdoor';
import Clock from './Clock';

export interface BriefItem {
  id: string;
  kind: 'conflict' | 'country' | 'bloc' | 'unrest';
  title: string;
  eyebrow: string;
  detail: string;
  color: string;
  /** A conflict or unrest record: the newest assessment is shown as the caption. */
  conflict?: { history: HistoryEntry[]; location: [number, number] };
}

interface Props {
  items: BriefItem[];
  intervalMs?: number;
  onShow: (item: BriefItem) => void;
  onOpen: (item: BriefItem) => void;
  onExit: () => void;
}

/**
 * Full-screen briefing: cycles through the given items, flying the map to
 * each and showing a caption. Space pauses, arrows step, Escape exits.
 * Requests browser full screen when available; failures are ignored.
 */
export default function Briefing({ items, intervalMs = 9000, onShow, onOpen, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const item = items[index] ?? null;

  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => undefined);
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (item) onShowRef.current(item);
  }, [item]);

  useEffect(() => {
    if (paused || items.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), intervalMs);
    return () => clearInterval(t);
  }, [paused, items.length, intervalMs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % Math.max(1, items.length));
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + items.length) % Math.max(1, items.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, onExit]);

  if (!item) {
    return (
      <div className="brief-card frame" role="status">
        <p>Nothing to brief: no high-intensity conflict is live and the watchlist is empty.</p>
        <button className="text-btn" onClick={onExit}>
          Exit
        </button>
      </div>
    );
  }
  const latest = item.conflict?.history[0];
  return (
    <div className="brief-card frame" role="region" aria-label="Briefing" aria-live="polite" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="brief-head">
        <span className="eyebrow" style={{ color: item.color }}>
          {item.eyebrow}
        </span>
        <Clock live={Date.now() - Date.parse(DATA_ASOF + 'T00:00:00Z') < 86400000 * 1.5} />
        <span className="brief-count mono">
          {index + 1} / {items.length}
        </span>
      </div>
      <h2>{item.title}</h2>
      {latest ? (
        <p>
          <span className="label" style={{ color: INTENSITY_COLOR[latest.intensity] }}>
            {formatDate(latest.date)}
          </span>
          <span className="label brief-provenance"> · {shortProvenance(latest)}</span>
          <br />
          {latest.status}
        </p>
      ) : (
        <p>{item.detail}</p>
      )}
      <div className="brief-actions">
        <button className="icon-btn" aria-label="Previous" onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}>
          ‹
        </button>
        <button className="icon-btn" aria-label={paused ? 'Resume' : 'Pause'} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
          {paused ? '▶' : '❚❚'}
        </button>
        <button className="icon-btn" aria-label="Next" onClick={() => setIndex((i) => (i + 1) % items.length)}>
          ›
        </button>
        <button className="text-btn" onClick={() => onOpen(item)}>
          Open
        </button>
        <button className="text-btn" onClick={onExit}>
          Exit briefing
        </button>
      </div>
      {!paused && items.length > 1 && <div className="brief-progress" key={index} style={{ animationDuration: `${intervalMs}ms` }} aria-hidden="true" />}
    </div>
  );
}
