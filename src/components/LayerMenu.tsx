import { useEffect, useId, useRef, useState } from 'react';
import type { Layer } from '../lib/urlState';

export interface LayerOption {
  id: Exclude<Layer, null>;
  label: string;
  hint: string;
}

interface Props {
  options: LayerOption[];
  value: Layer;
  onChange: (layer: Layer) => void;
}

/**
 * One button that opens a list of data overlays. Exactly one overlay can be
 * on at a time (they all recolour the countries), so the list behaves like a
 * radio group with an "Off" entry. Keyboard follows the menu pattern: opening
 * focuses the checked item, arrows/Home/End move, Tab or Escape closes, and
 * choosing or Escape returns focus to the button.
 */
export default function LayerMenu({ options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const close = (refocus: boolean) => {
    if (refocus) triggerRef.current?.focus();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Capture phase + preventDefault: one Escape closes only the menu, not the panel behind it.
      e.preventDefault();
      triggerRef.current?.focus();
      setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    // Move into the list on the checked item.
    listRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (at + 1) % items.length;
    else if (e.key === 'ArrowUp') next = (at - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'Tab') return close(false);
    else return;
    e.preventDefault();
    items[next]?.focus();
  };

  const current = options.find((o) => o.id === value);
  return (
    <div
      className="layer-menu"
      ref={rootRef}
      onBlur={(e) => {
        // Tabbing or clicking out of the menu closes it rather than leaving it open over the map.
        if (open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        className="icon-btn"
        aria-label="Data layers"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        ref={triggerRef}
        title={current ? `Layer: ${current.label}` : 'Data layers'}
        data-active={value !== null}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 13 9 5 9-5" />
        </svg>
      </button>
      {open && (
        <ul className="layer-list frame" id={id} role="menu" aria-label="Data layers" ref={listRef} onKeyDown={onListKey}>
          <li role="none">
            <button role="menuitemradio" tabIndex={-1} aria-checked={value === null} onClick={() => { onChange(null); close(true); }}>
              <span className="name">Off</span>
              <span className="hint">Mode colours only</span>
            </button>
          </li>
          {options.map((o) => (
            <li role="none" key={o.id}>
              <button role="menuitemradio" tabIndex={-1} aria-checked={value === o.id} data-layer={o.id} onClick={() => { onChange(value === o.id ? null : o.id); close(true); }}>
                <span className="name">{o.label}</span>
                <span className="hint">{o.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
