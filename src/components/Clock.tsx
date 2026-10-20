import { useEffect, useState } from 'react';

function stamp(d: Date) {
  return d.toISOString().slice(11, 19) + 'Z';
}

/**
 * UTC clock for briefing mode, where a presenter wants the time on screen.
 * Ticks once a second; the dot blinks only when the data changed within the
 * last day or so, since a "live" signal on week-old data would mislead.
 */
export default function Clock({ live = false }: { live?: boolean }) {
  const [now, setNow] = useState(() => stamp(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(stamp(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="readout" aria-label="Current UTC time">
      <span className="live" data-static={!live || undefined} aria-hidden="true" />
      UTC <b>{now}</b>
    </span>
  );
}
