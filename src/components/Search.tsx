import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { groupHits, hitFor, search, type SearchHit } from '../lib/search';
import { pushRecent, readRecent, type RecentPick } from '../lib/recentSearches';
import type { WatchItem } from '../lib/watchlist';
import type { Mode } from '../lib/urlState';

export type { SearchHit } from '../lib/search';

/** Window event whose detail is a query to put in the search box. */
export const SEARCH_PREFILL_EVENT = 'atlas:search';

interface Props {
  onPick: (hit: SearchHit) => void;
  conflictColor: (id: string) => string;
  /** Current map mode: conflicts rank first in Conflicts mode, blocs in Blocs mode. */
  mode?: Mode;
  /** Starred items, offered when the field is focused while empty. */
  watchlist?: WatchItem[];
}

function resolve(items: Array<RecentPick | WatchItem>, limit: number): SearchHit[] {
  return items
    .map((x) => hitFor(x.kind, x.id))
    .filter((x): x is SearchHit => x !== null)
    .slice(0, limit);
}

export default function Search({ onPick, conflictColor, mode, watchlist = [] }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentPick[]>(readRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listId = useId();
  const hasQuery = query.trim().length > 0;

  // With a query: ranked hits grouped by kind. Empty: watchlist, then recent picks.
  const groups = useMemo(() => {
    if (hasQuery) return groupHits(search(query, { mode }));
    const starred = resolve(watchlist, 5);
    const seen = new Set(starred.map((h) => h.kind + h.id));
    const recents = resolve(recent, 5).filter((h) => !seen.has(h.kind + h.id));
    return [...(starred.length ? [{ label: 'Watchlist', hits: starred }] : []), ...(recents.length ? [{ label: 'Recent', hits: recents }] : [])];
  }, [hasQuery, query, mode, watchlist, recent]);
  const hits = useMemo(() => groups.flatMap((g) => g.hits), [groups]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setActive(0), [query]);

  // "Search" from a stale-link notice: fill the box and open the list.
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      if (typeof q !== 'string') return;
      setQuery(q);
      setOpen(true);
      inputRef.current?.focus();
    };
    window.addEventListener(SEARCH_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(SEARCH_PREFILL_EVENT, onPrefill);
  }, []);

  const pick = (hit: SearchHit) => {
    onPick(hit);
    const opensPanel = hit.kind !== 'action' && hit.kind !== 'layer';
    if (opensPanel) setRecent(pushRecent({ kind: hit.kind, id: hit.id }));
    setQuery('');
    setOpen(false);
    // A pick that opens a panel hands focus to it (the panel focuses its heading);
    // layers and actions keep focus here so the user doesn't lose their place.
    if (opensPanel) inputRef.current?.blur();
  };

  const showList = open;
  const showOptions = hasQuery || hits.length > 0;

  // Match counts for screen readers, after typing settles.
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => setAnnounce(!showList || !q ? '' : hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : `No matches for “${q}”`), 300);
    return () => clearTimeout(t);
  }, [query, hits.length, showList]);
  let index = -1;

  return (
    <div className="search" role="combobox" aria-expanded={showList} aria-haspopup="listbox" aria-controls={showList && showOptions ? listId : undefined}>
      <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search countries, blocs, conflicts, places"
        aria-label="Search countries, blocs, conflicts, unrest, places and layers"
        aria-autocomplete="list"
        aria-controls={showList && showOptions ? listId : undefined}
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          // A blur moments ago (a pick) must not close the list we are reopening.
          clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => (blurTimer.current = setTimeout(() => setOpen(false), 120))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            const hit = hits[active];
            if (hit) pick(hit);
          } else if (e.key === 'Escape') {
            // Step down one layer per press and keep focus; an empty, closed box lets Escape through to the app.
            if (showList) {
              e.preventDefault();
              setOpen(false);
            } else if (query) {
              e.preventDefault();
              setQuery('');
            }
          }
        }}
      />
      {!query && (
        <span className="kbd" aria-hidden="true">
          /
        </span>
      )}
      <span className="sr-only" role="status">
        {announce}
      </span>
      {showList && (
        <div className="search-list">
          {showOptions && (
            <ul id={listId} role="listbox" aria-label={hasQuery ? 'Search results' : 'Suggestions'}>
              {hasQuery && hits.length === 0 && (
                // Shown, not announced: the status line above says it.
                <li className="empty" aria-hidden="true">
                  No matches for “{query}”
                </li>
              )}
              {groups.map((g) => (
                <li key={g.label} role="group" aria-label={g.label}>
                  <div className="search-group" aria-hidden="true">
                    {g.label}
                  </div>
                  <ul role="none">
                    {g.hits.map((hit) => {
                      const i = ++index;
                      const dot = hit.kind === 'bloc' ? hit.color : hit.kind === 'conflict' || hit.kind === 'unrest' ? conflictColor(hit.id) : null;
                      return (
                        <li
                          key={hit.kind + hit.id}
                          id={`${listId}-${i}`}
                          role="option"
                          aria-selected={i === active}
                          onPointerEnter={() => setActive(i)}
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => pick(hit)}
                        >
                          {dot && <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: dot }} />}
                          <span>
                            {hit.label}
                            {hit.kind === 'country' && <span style={{ color: 'var(--fg-muted)' }}> · {hit.sub}</span>}
                          </span>
                          {hit.kind !== 'country' && <span className="kind">{hit.sub}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {!hasQuery && <p className="empty hint">Try Sudan, NATO, Hormuz, sanctions, or two countries like “usa china”</p>}
        </div>
      )}
    </div>
  );
}
