import type { DroppedId } from '../lib/urlState';
import { deslug } from '../lib/panelNav';

const KIND_LABEL: Record<DroppedId['kind'], string> = {
  bloc: 'bloc',
  vs: 'bloc',
  conflict: 'conflict',
  country: 'country',
  chokepoint: 'chokepoint',
  unrest: 'unrest episode',
  pair: 'country pair',
};

/**
 * Says so when a link named an id this edition doesn't know, instead of
 * silently showing the parent view. The id stays readable so it can be
 * searched for or reported.
 */
export default function StaleLinkNotice({ dropped, onSearch, onDismiss }: { dropped: DroppedId[]; onSearch: (query: string) => void; onDismiss: () => void }) {
  const first = dropped[0];
  if (!first) return null;
  return (
    <div className="since stale-link" role="status">
      <span className="since-label">Link</span>
      <span className="stale-text">
        The {KIND_LABEL[first.kind]} “{first.id}” isn’t in this edition. It may have been renamed or closed.
        {dropped.length > 1 && ` (+${dropped.length - 1} more)`}
      </span>
      <button className="text-btn since-read" onClick={() => onSearch(deslug(first.id))}>
        Search
      </button>
      <button className="text-btn since-read" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
