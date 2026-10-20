import { useCallback, useEffect, useRef, useState } from 'react';

export type GestureKind = 'wheel' | 'touch';

/** A 1.5s overlay explaining cooperative gestures when an embed hands a swipe or scroll back to the page. */
export function useGestureHint(): [GestureKind | null, (kind: GestureKind) => void] {
  const [hint, setHint] = useState<GestureKind | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const show = useCallback((kind: GestureKind) => {
    setHint(kind);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHint(null), 1500);
  }, []);
  return [hint, show];
}

