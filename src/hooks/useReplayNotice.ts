import { useEffect, useState } from 'react';
import { clampNotice } from '../lib/timeline';

function requested(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('t');
}

/**
 * Notice for a link whose #t= fell outside the replay range. Read from the
 * raw hash before the app rewrites it to the clamped month.
 */
export function useReplayNotice(): [string | null, () => void] {
  const [notice, setNotice] = useState<string | null>(() => clampNotice(requested()));
  useEffect(() => {
    const onHash = () => setNotice(clampNotice(requested()));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(t);
  }, [notice]);
  return [notice, () => setNotice(null)];
}
