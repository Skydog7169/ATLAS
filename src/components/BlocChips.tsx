import { useRef, type KeyboardEvent } from 'react';
import { BLOCS } from '../data/blocs';

interface Props {
  active: string | null;
  /** Second bloc in compare mode. */
  vs: string | null;
  /** True while the user is choosing the second bloc. */
  picking: boolean;
  onChange: (id: string | null) => void;
  onVs: (id: string | null) => void;
  onPicking: (on: boolean) => void;
}

/**
 * The bloc chip row is a toolbar with a roving tab stop: Tab enters once (on
 * the pressed chip, or Overview), arrow keys, Home and End move along it.
 */
export default function BlocChips({ active, vs, picking, onChange, onVs, onPicking }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const stop = active ?? 'overview';
  const tab = (id: string) => (id === stop ? 0 : -1);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const chips = [...(rowRef.current?.querySelectorAll<HTMLButtonElement>('button.chip') ?? [])];
    const i = chips.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const next = e.key === 'ArrowRight' ? Math.min(chips.length - 1, i + 1) : e.key === 'ArrowLeft' ? Math.max(0, i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? chips.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const el = chips[next]!;
    for (const c of chips) c.tabIndex = c === el ? 0 : -1;
    el.focus();
    el.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  };

  return (
    <div className="chip-row" role="toolbar" aria-label="Choose a bloc to highlight" ref={rowRef} onKeyDown={onKeyDown}>
      <button className="chip" aria-pressed={active === null} tabIndex={tab('overview')} onClick={() => onChange(null)}>
        Overview
      </button>
      {active && (
        <button
          className={'chip compare' + (picking ? ' picking' : '')}
          aria-pressed={vs !== null || picking}
          tabIndex={-1}
          title={vs ? 'Stop comparing' : 'Compare with another bloc'}
          onClick={() => {
            if (vs) onVs(null);
            else onPicking(!picking);
          }}
        >
          {vs ? '✕ Compare' : picking ? 'Pick a bloc…' : 'VS Compare'}
        </button>
      )}
      {BLOCS.map((b) => {
        const isA = active === b.id;
        const isB = vs === b.id;
        return (
          <button
            key={b.id}
            className={'chip' + (isB ? ' is-vs' : '')}
            aria-pressed={isA || isB}
            tabIndex={tab(b.id)}
            style={{ ['--chip-color' as string]: b.color }}
            onClick={() => {
              if (picking && active && b.id !== active) {
                onVs(b.id);
                onPicking(false);
              } else if (picking && isA) {
                // Clicking the first bloc again cancels picking rather than dropping the bloc.
                onPicking(false);
              } else if (isB) {
                onVs(null);
              } else {
                onChange(isA ? null : b.id);
              }
            }}
            title={picking && active && b.id !== active ? `Compare ${b.shortName}` : b.name}
          >
            <span className="dot" aria-hidden="true" />
            {b.shortName}
            {b.name !== b.shortName && <span className="sr-only"> — {b.name}</span>}
            {isA && vs && <span className="tag-ab">A</span>}
            {isB && <span className="tag-ab">B</span>}
          </button>
        );
      })}
    </div>
  );
}
