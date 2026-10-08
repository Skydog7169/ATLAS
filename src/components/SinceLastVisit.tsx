import { useMemo, useState } from 'react';
import { CHANGES } from '../lib/feed';
import type { ChangeItem } from '../lib/history';
import { INTENSITY_COLOR, formatDate } from '../lib/labels';
import { changesSinceVisit, readLastVisit, writeLastVisit } from '../lib/lastVisit';

interface Props {
  onSelectConflict: (id: string) => void;
  onSelectBloc: (id: string) => void;
  onOpenChanges: () => void;
}

const SHOWN = 4;

/**
 * Strip under the header listing what changed since the visitor last pressed
 * "Mark read". The timestamp lives in localStorage; a first visit stores
 * today's date silently so the next visit has a baseline.
 */
export default function SinceLastVisit({ onSelectConflict, onSelectBloc, onOpenChanges }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [lastVisit, setLastVisit] = useState<string | null>(() => {
    const v = readLastVisit();
    if (!v) writeLastVisit(today);
    return v;
  });
  const items = useMemo(() => changesSinceVisit(CHANGES, lastVisit), [lastVisit]);
  if (!lastVisit || items.length === 0) return null;
  const open = (it: ChangeItem) => (it.kind === 'conflict' ? onSelectConflict(it.id) : onSelectBloc(it.id));
  const markRead = () => {
    writeLastVisit(today);
    setLastVisit(today);
  };
  return (
    <div className="since" role="status" aria-label="Changes since your last visit">
      <span className="since-label">
        Since {formatDate(lastVisit)} · <b>{items.length}</b> {items.length === 1 ? 'change' : 'changes'}
      </span>
      <ul className="since-list">
        {items.slice(0, SHOWN).map((it, i) => (
          <li key={it.kind + it.id + it.date + i}>
            <button type="button" onClick={() => open(it)}>
              <span className="dot" style={{ background: it.intensity ? INTENSITY_COLOR[it.intensity] : it.color }} aria-hidden="true" />
              {it.title}
            </button>
          </li>
        ))}
        {items.length > SHOWN && (
          <li>
            <button type="button" className="more" onClick={onOpenChanges}>
              +{items.length - SHOWN} more
            </button>
          </li>
        )}
      </ul>
      <button type="button" className="text-btn since-read" onClick={markRead}>
        Mark read
      </button>
    </div>
  );
}
