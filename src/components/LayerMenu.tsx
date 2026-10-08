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
 * radio group with an "Off" entry.
 */
export default function LayerMenu({ options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

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

  const current = options.find((o) => o.id === value);
  return (
    <div className="layer-menu" ref={rootRef}>
      <button
        className="icon-btn"
        aria-label="Data layers"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
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
        <ul className="layer-list frame" id={id} role="menu" aria-label="Data layers">
          <li role="none">
            <button role="menuitemradio" aria-checked={value === null} onClick={() => { onChange(null); setOpen(false); }}>
              <span className="name">Off</span>
              <span className="hint">Mode colours only</span>
            </button>
          </li>
          {options.map((o) => (
            <li role="none" key={o.id}>
              <button role="menuitemradio" aria-checked={value === o.id} data-layer={o.id} onClick={() => { onChange(value === o.id ? null : o.id); setOpen(false); }}>
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
