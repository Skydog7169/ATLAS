import { useEffect, useRef, useState } from 'react';

interface Item {
  label: string;
  pressed: boolean;
  onSelect: () => void;
}

/**
 * Overflow for the narrowest phones (<=400px), where the header row cannot fit
 * every icon button: Changes and About move in here. Hidden by CSS elsewhere.
 */
export default function MoreMenu({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="more-menu" ref={rootRef}>
      <button className="icon-btn" aria-label="More" aria-expanded={open} title="More" onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {open && (
        <ul className="more-list frame">
          {items.map((it) => (
            <li key={it.label}>
              <button
                aria-pressed={it.pressed}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
