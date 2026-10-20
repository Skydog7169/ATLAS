import { useCallback, useEffect, useRef, useState } from 'react';
import type { HistoryEntry } from '../data/types';
import { INTENSITY_COLOR, INTENSITY_LABEL, formatDate } from '../lib/labels';

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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const exited = useRef(false);
  const item = items[index] ?? null;

  // Exit once, whichever of Escape, the button or leaving full screen gets there first.
  const exit = useCallback(() => {
    if (exited.current) return;
    exited.current = true;
    onExit();
  }, [onExit]);

  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => undefined);
    // In real full screen the browser takes the first Escape to leave it; treat that as exiting the briefing.
    const onFullscreen = () => {
      if (!document.fullscreenElement) exit();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, [exit]);

  // The header is hidden during a briefing; land focus on the card so it is announced.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
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
      if (e.key === 'Escape') {
        // Claimed so the app-level Escape doesn't also close something underneath.
        e.preventDefault();
        exit();
      } else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % Math.max(1, items.length));
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + items.length) % Math.max(1, items.length));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [items.length, exit]);

  if (!item) {
    return (
      <div className="brief-card frame" role="status">
        <p>Nothing to brief: no high-intensity conflict is live and the watchlist is empty.</p>
        <button className="text-btn" onClick={exit}>
          Exit
        </button>
      </div>
    );
  }
  const latest = item.conflict?.history[0];
  return (
    <div
      className="brief-card frame"
      role="region"
      aria-label="Briefing"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      // Keyboard and screen-reader users get the same pause as a hovering pointer
      // (the heading takes focus on entry, which isn't a request to pause).
      onFocus={(e) => {
        if (e.target !== headingRef.current) setPaused(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      {/* Each advance announces one short line; the card itself is read on demand. */}
      <p className="sr-only" role="status">
        {`${index + 1} of ${items.length}: ${item.title}, ${item.eyebrow}`}
      </p>
      <div className="brief-head">
        <span className="eyebrow" style={{ color: item.color }}>
          {item.eyebrow}
        </span>
        <span className="brief-count mono">
          {index + 1} / {items.length}
        </span>
        <span className="brief-hint mono">Esc to exit</span>
      </div>
      <h2 ref={headingRef} tabIndex={-1}>
        {item.title}
      </h2>
      {latest ? (
        <p>
          <span className="label" style={{ color: INTENSITY_COLOR[latest.intensity] }}>
            {INTENSITY_LABEL[latest.intensity]} · {formatDate(latest.date)}
          </span>
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
        <button className="text-btn" onClick={exit}>
          Exit briefing
        </button>
      </div>
      {!paused && items.length > 1 && <div className="brief-progress" key={index} style={{ animationDuration: `${intervalMs}ms` }} aria-hidden="true" />}
    </div>
  );
}
