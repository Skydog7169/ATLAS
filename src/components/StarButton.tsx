import { useWatchlist } from '../hooks/useWatchlist';
import type { WatchItem } from '../lib/watchlist';

interface Props {
  item: WatchItem;
  /** Name read out in the accessible label. */
  name: string;
  small?: boolean;
}

/** Adds or removes an entity from the watchlist. Pressed state is the filled star. */
export default function StarButton({ item, name, small }: Props) {
  const { has, toggle } = useWatchlist();
  const on = has(item);
  return (
    <button
      className={'icon-btn star' + (small ? ' small' : '')}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
      title={on ? 'On your watchlist' : 'Add to watchlist'}
      data-watch-kind={item.kind}
      data-watch-id={item.id}
      onClick={() => toggle(item)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8L12 3Z" />
      </svg>
    </button>
  );
}
