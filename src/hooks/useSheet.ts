import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export type Snap = 'peek' | 'half' | 'full';

const ORDER: Snap[] = ['peek', 'half', 'full'];
/** Sheet heights as a share of the stage (global.css mirrors these in dvh). */
export const SNAP_SHARE: Record<Snap, number> = { peek: 0.3, half: 0.52, full: 1 };
const SHEET_QUERY = '(max-width: 820px)';
const TAP_SLOP = 6;
const FLICK_SPEED = 0.6; // px per ms

/** Nearest snap for a sheet height (px), given the stage height. */
export function nearestSnap(height: number, stageHeight: number): Snap {
  let best: Snap = 'half';
  let bestD = Infinity;
  for (const s of ORDER) {
    const d = Math.abs(SNAP_SHARE[s] * stageHeight - height);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Next snap when the grip is tapped: peek → half → full → peek. */
export function nextSnap(s: Snap): Snap {
  return ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]!;
}

/**
 * Bottom-sheet snapping for the detail panel on phones: drag the head or the
 * grip between peek, half and full; a flick down from peek closes it; tapping
 * (or Enter on) the grip cycles. Above 820px it does nothing.
 */
export function useSheet(onClose: () => void) {
  const [snap, setSnap] = useState<Snap>('half');
  const drag = useRef<{ y: number; lastY: number; h: number; t: number; v: number; moved: boolean; el: HTMLElement } | null>(null);

  const isSheet = () => window.matchMedia(SHEET_QUERY).matches;

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!isSheet() || e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Only the head and grip drag; the body scrolls, and head buttons stay clickable.
    if (!target.closest('.panel-head, .sheet-grip') || (target.closest('button, a, input') && !target.closest('.sheet-grip'))) return;
    const el = e.currentTarget;
    drag.current = { y: e.clientY, lastY: e.clientY, h: el.getBoundingClientRect().height, t: performance.now(), v: 0, moved: false, el };
    el.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < TAP_SLOP) return;
    d.moved = true;
    const now = performance.now();
    d.v = 0.7 * d.v + 0.3 * ((e.clientY - d.lastY) / Math.max(1, now - d.t));
    d.t = now;
    d.lastY = e.clientY;
    const stage = d.el.parentElement?.clientHeight ?? window.innerHeight;
    const h = Math.max(48, Math.min(stage, d.h - dy));
    d.el.dataset.dragging = 'true';
    d.el.style.height = `${h}px`;
    d.el.style.maxHeight = `${h}px`;
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const el = d.el;
    delete el.dataset.dragging;
    if (!d.moved) {
      if ((e.target as HTMLElement).closest('.sheet-grip')) setSnap(nextSnap);
      return;
    }
    const h = el.getBoundingClientRect().height;
    el.style.height = '';
    el.style.maxHeight = '';
    const stage = el.parentElement?.clientHeight ?? window.innerHeight;
    // A flick wins over the nearest snap.
    if (d.v > FLICK_SPEED) {
      if (snap === 'peek' || h < SNAP_SHARE.peek * stage * 0.8) onClose();
      else setSnap(snap === 'full' ? 'half' : 'peek');
    } else if (d.v < -FLICK_SPEED) setSnap(snap === 'peek' ? 'half' : 'full');
    else if (h < SNAP_SHARE.peek * stage * 0.6) onClose();
    else setSnap(nearestSnap(h, stage));
  };

  const onGripKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp') setSnap((s) => (s === 'peek' ? 'half' : 'full'));
    else if (e.key === 'ArrowDown') setSnap((s) => (s === 'full' ? 'half' : 'peek'));
    else return;
    e.preventDefault();
  };

  return {
    snap,
    sectionProps: { 'data-snap': snap, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    gripProps: {
      className: 'sheet-grip',
      'aria-label': 'Resize panel',
      'aria-expanded': snap === 'full',
      title: 'Drag or press to resize',
      onKeyDown: onGripKey,
      // Keyboard activation: pointer taps are handled in onPointerUp.
      onClick: (e: React.MouseEvent) => {
        if (e.detail === 0) setSnap(nextSnap);
      },
    },
  };
}
