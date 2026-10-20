import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { menuPlacement, type MenuPlacement } from '../lib/menuPlacement';
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
  const [place, setPlace] = useState<MenuPlacement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Open toward whichever side of the stage has more room and cap the list to it, so
  // "Off" and the first layers are never pushed under the header on short screens.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const btn = rootRef.current?.getBoundingClientRect();
      const stage = rootRef.current?.closest('.stage')?.getBoundingClientRect();
      if (btn && stage) setPlace(menuPlacement(btn, stage));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

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
        className="icon-btn layer-trigger"
        aria-label={current ? `Data layers: ${current.label}` : 'Data layers'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        title={current ? `Layer: ${current.label}` : 'Data layers'}
        data-active={value !== null}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="layers" />
        <span className="layer-trigger-label">{current ? current.label : 'Layers'}</span>
        <Icon name="chevron-down" size={12} />
      </button>
      {open && (
        <ul
          className="layer-list frame"
          id={id}
          role="menu"
          aria-label="Data layers"
          data-place={place?.side}
          style={place ? { maxHeight: place.maxHeight, overflowY: 'auto', ...(place.side === 'down' ? { top: 0, bottom: 'auto' } : { bottom: 0, top: 'auto' }) } : undefined}
        >
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
