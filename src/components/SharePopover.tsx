import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { menuPlacement, type MenuPlacement } from '../lib/menuPlacement';
import Icon, { type IconName } from './Icon';

export interface ShareAction {
  id: string;
  label: string;
  hint: string;
  icon: IconName;
  /** Text shown in place of the label for a moment after it ran, e.g. "Link copied". */
  done?: string;
  busy?: boolean;
  disabled?: boolean;
  /** Return false when the action failed, so no confirmation shows. */
  run: () => boolean | void | Promise<boolean | void>;
}

/**
 * The output end of the map controls: copy a link or embed code, export a
 * PNG, present. Built like the layer menu so the two read as one family.
 */
export default function SharePopover({ actions, triggerRef: outerRef }: { actions: ShareAction[]; triggerRef?: RefObject<HTMLButtonElement | null> }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<MenuPlacement | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const ownRef = useRef<HTMLButtonElement>(null);
  const triggerRef = outerRef ?? ownRef;
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      triggerRef.current?.focus();
      setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const btn = rootRef.current?.getBoundingClientRect();
    const stage = rootRef.current?.closest('.stage')?.getBoundingClientRect();
    if (btn && stage) setPlace(menuPlacement(btn, stage));
  }, [open]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 1500);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <div className="layer-menu share-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        className="icon-btn"
        aria-label="Share and present"
        title="Share, export or present"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="share" />
      </button>
      {open && (
        <ul
          className="layer-list frame"
          id={id}
          role="menu"
          aria-label="Share and present"
          data-place={place?.side}
          style={place ? { maxHeight: place.maxHeight, overflowY: 'auto', ...(place.side === 'down' ? { top: 0, bottom: 'auto' } : { bottom: 0, top: 'auto' }) } : undefined}
        >
          {actions.map((a) => (
            <li role="none" key={a.id}>
              <button
                role="menuitem"
                data-action={a.id}
                data-busy={a.busy || undefined}
                disabled={a.disabled}
                onClick={async () => {
                  const ok = await a.run();
                  if (ok === false) return;
                  if (a.done) setDone(a.id);
                  else setOpen(false);
                }}
              >
                <span className="name">
                  <Icon name={a.icon} size={12} /> {done === a.id && a.done ? a.done : a.label}
                </span>
                <span className="hint">{a.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
