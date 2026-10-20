import { useMemo } from 'react';
import { useSeen } from '../hooks/useSeen';
import { setWatchOnly, useWatchlist } from '../hooks/useWatchlist';
import { bySignal, watchlistOnly } from '../lib/feed';
import type { ChangeItem } from '../lib/history';
import { deltaWord, itemColor } from '../lib/delta';
import { formatDate } from '../lib/labels';

interface Props {
  onSelectConflict: (id: string) => void;
  onSelectBloc: (id: string) => void;
  onSelectUnrest: (id: string) => void;
  onOpenChanges: () => void;
}

const SHOWN = 4;

/**
 * Strip under the header listing what the visitor has not seen since they
 * last pressed "Mark read". What counts as seen is a set of item keys in
 * localStorage (see lastVisit.ts), so entries merged later than their research
 * date still surface. Followed items lead, then new and escalated ones. "+N
 * more" opens the changes panel on the same unseen window, unfiltered, so the
 * count it promises is the count it shows.
 */
export default function SinceLastVisit({ onSelectConflict, onSelectBloc, onSelectUnrest, onOpenChanges }: Props) {
  const { since, unseen, markRead } = useSeen();
  const { keys } = useWatchlist();
  const followed = useMemo(() => watchlistOnly(unseen, keys).sort(bySignal), [unseen, keys]);
  if (unseen.length === 0) return null;
  const followedKeys = new Set(followed.map((it) => it.key));
  const shown = [...followed, ...unseen.filter((it) => !followedKeys.has(it.key)).sort(bySignal)].slice(0, SHOWN);
  const rest = unseen.length - shown.length;
  const open = (it: ChangeItem) => (it.kind === 'conflict' ? onSelectConflict(it.id) : it.kind === 'unrest' ? onSelectUnrest(it.id) : onSelectBloc(it.id));
  const openAll = () => {
    setWatchOnly(false);
    onOpenChanges();
  };
  return (
    <div className="since" role="status" aria-label="Changes since your last visit">
      <span className="since-label">
        Since {formatDate(since)} · <b>{unseen.length}</b> {unseen.length === 1 ? 'change' : 'changes'}
        {followed.length > 0 && (
          <>
            {' '}· <b className="since-followed">{followed.length}</b> you follow
          </>
        )}
      </span>
      <ul className="since-list">
        {shown.map((it) => {
          const word = deltaWord(it.delta);
          return (
            <li key={it.key}>
              <button type="button" onClick={() => open(it)} data-followed={followedKeys.has(it.key) || undefined}>
                <span className={'dot' + (it.kind === 'unrest' ? ' triangle' : '')} style={{ background: itemColor(it) }} aria-hidden="true" />
                {followedKeys.has(it.key) && <span className="since-star" aria-label="Followed">★</span>}
                {it.title}
                {word && <span className="since-delta" data-delta={it.delta}>{word}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {rest > 0 && (
        <button type="button" className="text-btn since-more" onClick={openAll}>
          +{rest} more
        </button>
      )}
      <button type="button" className="text-btn since-read" onClick={markRead}>
        Mark read
      </button>
    </div>
  );
}
