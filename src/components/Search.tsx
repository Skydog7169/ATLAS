import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { search, type SearchHit } from '../lib/search';

export type { SearchHit } from '../lib/search';

/** Window event whose detail is a query to put in the search box. */
export const SEARCH_PREFILL_EVENT = 'atlas:search';

interface Props {
  onPick: (hit: SearchHit) => void;
  conflictColor: (id: string) => string;
}

export default function Search({ onPick, conflictColor }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const hits = useMemo(() => search(query), [query]);

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

  // Focus stays put: the app moves it into the panel the pick opens.
  const pick = (hit: SearchHit) => {
    onPick(hit);
    setQuery('');
    setOpen(false);
  };

  const showList = open && query.trim().length > 0;

  // Match counts for screen readers, after typing settles.
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => setAnnounce(!showList ? '' : hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : `No matches for “${q}”`), 300);
    return () => clearTimeout(t);
  }, [query, hits.length, showList]);

  return (
    <div className="search" role="combobox" aria-expanded={showList && hits.length > 0} aria-haspopup="listbox" aria-controls={showList && hits.length > 0 ? listId : undefined}>
      <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search countries, blocs, conflicts"
        aria-label="Search countries, blocs and conflicts"
        aria-autocomplete="list"
        aria-controls={showList && hits.length > 0 ? listId : undefined}
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
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
      {!query && <span className="kbd" aria-hidden="true">/</span>}
      <span className="sr-only" role="status">
        {announce}
      </span>
      {showList && hits.length === 0 && (
        // Shown, not announced: the status line above says it.
        <ul className="search-list" aria-hidden="true">
          <li className="empty">No matches for “{query}”</li>
        </ul>
      )}
      {showList && hits.length > 0 && (
        <ul id={listId} className="search-list" role="listbox">
          {hits.map((hit, i) => (
            <li
              key={hit.kind + hit.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(hit)}
            >
              {hit.kind !== 'country' && (
                <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: hit.kind === 'bloc' ? hit.color : conflictColor(hit.id) }} />
              )}
              <span>
                {hit.label}
                {hit.kind === 'country' && <span style={{ color: 'var(--fg-muted)' }}> · {hit.sub}</span>}
              </span>
              <span className="kind">{hit.kind === 'bloc' || hit.kind === 'unrest' ? hit.sub : hit.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
