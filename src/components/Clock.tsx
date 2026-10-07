import { useEffect, useState } from 'react';

function stamp(d: Date) {
  return d.toISOString().slice(11, 19) + 'Z';
}

/** UTC clock readout for the header. Ticks once a second; cheap enough to leave on. */
export default function Clock() {
  const [now, setNow] = useState(() => stamp(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(stamp(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="readout" aria-label="Current UTC time">
      <span className="live" aria-hidden="true" />
      UTC <b>{now}</b>
    </span>
  );
}
