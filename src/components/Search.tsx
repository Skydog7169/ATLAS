import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { search, type SearchHit } from '../lib/search';

export type { SearchHit } from '../lib/search';

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

  const pick = (hit: SearchHit) => {
    onPick(hit);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className="search" role="combobox" aria-expanded={showList} aria-haspopup="listbox" aria-controls={showList ? listId : undefined}>
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
        aria-controls={showList ? listId : undefined}
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
            setQuery('');
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
      />
      {!query && <span className="kbd" aria-hidden="true">/</span>}
      {showList && (
        <ul id={listId} className="search-list" role="listbox">
          {hits.length === 0 && (
            <li className="empty" role="option" aria-selected={false}>
              No matches for “{query}”
            </li>
          )}
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
              <span className="kind">{hit.kind === 'bloc' ? hit.sub : hit.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
