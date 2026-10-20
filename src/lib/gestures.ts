/**
 * Which pointer gestures pan and zoom. Cooperative (embeds) leaves one-finger
 * swipes and plain wheel scrolling to the host page; static allows neither.
 */
export type Gestures = 'all' | 'cooperative' | 'none';

/** d3-zoom filter for the gesture policy; mirrors d3's default for 'all'. */
export function gestureFilter(gestures: Gestures, onBlocked?: (kind: 'wheel' | 'touch') => void) {
  return (e: Event & { ctrlKey?: boolean; metaKey?: boolean; button?: number; touches?: TouchList }) => {
    if (gestures === 'all') return (!e.ctrlKey || e.type === 'wheel') && !e.button;
    if (gestures === 'none') return false;
    if (e.type === 'wheel') {
      const ok = Boolean(e.ctrlKey || e.metaKey);
      if (!ok) onBlocked?.('wheel');
      return ok;
    }
    // One-finger touches go to the page; the hint is raised from touchmove so taps stay quiet.
    if (e.type.startsWith('touch')) return (e.touches?.length ?? 0) > 1;
    return !e.button;
  };
}
