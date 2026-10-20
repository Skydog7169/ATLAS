import { useEffect, useState } from 'react';
import { BUNDLED_NEWEST, isStale, newerEdition, type FeedItem } from '../lib/edition';

const POLL_MS = 15 * 60_000;

export interface Edition {
  /** Newest date of a shipped edition this tab lacks, or null. */
  newer: string | null;
  /** Newest change this tab carries. */
  newest: string;
  /** The bundled data is older than the research cadence: a snapshot, not live. */
  stale: boolean;
}

/**
 * Long-lived tabs and briefing wall displays re-check the deployed feed when they
 * become visible and every 15 minutes, so they can say a newer edition exists.
 */
export function useEdition(): Edition {
  const [newer, setNewer] = useState<string | null>(null);
  const [stale, setStale] = useState(() => isStale());

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setStale(isStale());
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/feed.json', { cache: 'no-cache' });
        if (!res.ok) return;
        const body = (await res.json()) as { items?: FeedItem[] };
        if (!cancelled && Array.isArray(body.items)) setNewer(newerEdition(body.items));
      } catch {
        /* offline or blocked: keep what we know */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const id = setInterval(() => void check(), POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { newer, newest: BUNDLED_NEWEST, stale };
}
