import { useCallback, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react';
import type { Insets } from '../lib/camera';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Rectangle relative to the stage's top-left corner. */
export interface StageRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface MapChrome {
  insets: Insets;
  /** Floating chrome over the map (legend, controls, timeline); labels avoid these. */
  obstacles: StageRect[];
}

/** Sheet share of the viewport at <=820px (global.css .panel max-height) before it is measured. */
export const SHEET_FALLBACK = 0.52;
const PANEL_GUTTER = 12;
const SHEET_QUERY = '(max-width: 820px)';

function panelWidthVar(): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-w'));
  return Number.isFinite(v) && v > 0 ? v : 400;
}

/**
 * First-render guess at what the panel covers, so the very first fly-to
 * already frames its target. Refined by measurement right after commit.
 */
export function estimateInsets(panelOpen: boolean, sheet: boolean, viewportHeight: number): Insets {
  if (!panelOpen) return { top: 0, right: 0, bottom: 0 };
  if (sheet) return { top: 0, right: 0, bottom: Math.round(viewportHeight * SHEET_FALLBACK) };
  return { top: 0, right: panelWidthVar() + 2 * PANEL_GUTTER, bottom: 0 };
}

/** Layout box relative to the stage, ignoring transforms (entry animations slide the panel). */
function box(el: HTMLElement, stage: HTMLElement): StageRect {
  if (el.offsetParent === stage) return { x0: el.offsetLeft, y0: el.offsetTop, x1: el.offsetLeft + el.offsetWidth, y1: el.offsetTop + el.offsetHeight };
  const r = el.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  return { x0: r.left - s.left, y0: r.top - s.top, x1: r.right - s.left, y1: r.bottom - s.top };
}

function measure(stage: HTMLElement): MapChrome {
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const insets: Insets = { top: 0, right: 0, bottom: 0 };
  const panel = stage.querySelector<HTMLElement>('.panel, .embed-caption');
  if (panel && panel.offsetWidth > 0 && panel.offsetHeight > 0) {
    const r = box(panel, stage);
    // A bottom sheet spans the stage width; a side panel floats on the right.
    if (r.x0 < 2 || r.x1 - r.x0 > W * 0.9) insets.bottom = Math.max(0, Math.round(H - r.y0));
    else insets.right = Math.max(0, Math.round(W - r.x0 + PANEL_GUTTER));
  }
  for (const el of stage.querySelectorAll<HTMLElement>('.chip-row, .since')) {
    if (!el.offsetHeight) continue;
    const r = box(el, stage);
    if (r.y0 < H / 3) insets.top = Math.max(insets.top, Math.round(r.y1 + 8));
  }
  const obstacles: StageRect[] = [];
  for (const el of stage.querySelectorAll<HTMLElement>('.legend, .map-controls, .timeline, .map-hud')) {
    if (el.offsetWidth > 0 && el.offsetHeight > 0) obstacles.push(box(el, stage));
  }
  return { insets, obstacles };
}

function same(a: MapChrome, b: MapChrome) {
  return (
    a.insets.top === b.insets.top &&
    a.insets.right === b.insets.right &&
    a.insets.bottom === b.insets.bottom &&
    a.obstacles.length === b.obstacles.length &&
    a.obstacles.every((o, i) => {
      const p = b.obstacles[i]!;
      return Math.abs(o.x0 - p.x0) < 1 && Math.abs(o.y0 - p.y0) < 1 && Math.abs(o.x1 - p.x1) < 1 && Math.abs(o.y1 - p.y1) < 1;
    })
  );
}

/**
 * What the panel / bottom sheet / chip row cover on the map stage. Derived
 * synchronously on render (so the first fly-to is right) and then measured
 * with a ResizeObserver so sheet snaps and landscape panel widths are exact.
 * `layoutKey` should change whenever the chrome over the map may change.
 */
export function useMapChrome(stageRef: RefObject<HTMLElement | null>, panelOpen: boolean, layoutKey: string): MapChrome {
  const sheet = useMediaQuery(SHEET_QUERY);
  const [measured, setMeasured] = useState<{ key: string; chrome: MapChrome } | null>(null);
  const key = `${panelOpen}|${sheet}|${layoutKey}`;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    const update = () => {
      const chrome = measure(stage);
      setMeasured((m) => (m && m.key === key && same(m.chrome, chrome) ? m : { key, chrome }));
    };
    update();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    });
    ro.observe(stage);
    for (const el of stage.querySelectorAll('.panel, .embed-caption, .chip-row, .since, .legend, .timeline')) ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [stageRef, key]);

  if (measured && measured.key === key) return measured.chrome;
  const est = estimateInsets(panelOpen, sheet, typeof window === 'undefined' ? 800 : window.innerHeight);
  return { insets: { ...est, top: measured?.chrome.insets.top ?? 0 }, obstacles: measured?.chrome.obstacles ?? [] };
}
