import { useEffect, useRef, useState } from 'react';
import type { AircraftFeed } from '../lib/aircraft';

/** How often the browser asks for a new snapshot; the server and CDN cache upstream for 90 s anyway. */
export const POLL_MS = 60_000;
/** How often positions are dead-reckoned forward between snapshots. */
const TICK_MS = 2_000;
/** Reported positions kept per aircraft for its trail. */
const TRAIL_POINTS = 12;

export interface AircraftState {
  status: 'idle' | 'loading' | 'ok' | 'error';
  feed: AircraftFeed | null;
  error: string | null;
  /** Client time the current snapshot arrived. */
  receivedAt: number;
  /** Reported positions per hex across snapshots, oldest first. */
  trails: ReadonlyMap<string, Array<[number, number]>>;
  /** Advances every couple of seconds while the layer is on, for dead reckoning. */
  clock: number;
}

const IDLE: AircraftState = { status: 'idle', feed: null, error: null, receivedAt: 0, trails: new Map(), clock: 0 };

/**
 * Polls /api/aircraft while `enabled` and the tab is visible. Snapshots
 * accumulate into short trails so movement shows across refreshes.
 */
export function useAircraft(enabled: boolean): AircraftState {
  const [state, setState] = useState<AircraftState>(IDLE);
  const trails = useRef(new Map<string, Array<[number, number]>>());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(load, POLL_MS);
        return;
      }
      setState((s) => (s.feed ? s : { ...s, status: 'loading' }));
      try {
        const res = await fetch('/api/aircraft', { headers: { accept: 'application/json' } });
        const body = (await res.json()) as AircraftFeed & { error?: string };
        if (!res.ok || !Array.isArray(body.aircraft)) throw new Error(body.error ?? `feed returned ${res.status}`);
        if (cancelled) return;
        const next = new Map<string, Array<[number, number]>>();
        for (const a of body.aircraft) {
          const prev = trails.current.get(a.hex) ?? [];
          const last = prev.at(-1);
          const pts = last && last[0] === a.lon && last[1] === a.lat ? prev : [...prev, [a.lon, a.lat] as [number, number]];
          next.set(a.hex, pts.slice(-TRAIL_POINTS));
        }
        trails.current = next;
        const now = Date.now();
        setState({ status: 'ok', feed: body, error: null, receivedAt: now, trails: next, clock: now });
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, status: s.feed ? 'ok' : 'error', error: (err as Error).message }));
      }
      if (!cancelled) timer = setTimeout(load, POLL_MS);
    };
    void load();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = reduce ? undefined : setInterval(() => setState((s) => (s.feed ? { ...s, clock: Date.now() } : s)), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        void load();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (tick) clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return enabled ? state : IDLE;
}
