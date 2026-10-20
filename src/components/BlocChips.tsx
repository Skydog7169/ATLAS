import { useEffect, useRef, useState } from 'react';
import { BLOCS } from '../data/blocs';
import Icon from './Icon';

interface Props {
  active: string | null;
  /** Second bloc in compare mode. */
  vs: string | null;
  /** True while the user is choosing the second bloc. */
  picking: boolean;
  /** A data layer is painting the map, so the chips' bloc isn't what's shown. */
  suppressed?: boolean;
  onChange: (id: string | null) => void;
  onVs: (id: string | null) => void;
  onPicking: (on: boolean) => void;
}

export default function BlocChips({ active, vs, picking, suppressed = false, onChange, onVs, onPicking }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true, overflow: false });

  // Which ends have more chips past them: drives the fades and the ‹ › buttons.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const read = () =>
      setEdges({ start: row.scrollLeft <= 1, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1, overflow: row.scrollWidth > row.clientWidth + 1 });
    read();
    row.addEventListener('scroll', read, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(row);
    return () => {
      row.removeEventListener('scroll', read);
      ro?.disconnect();
    };
  }, []);

  // Keep the active bloc's chip in view, e.g. after picking it from search on a phone.
  useEffect(() => {
    if (!active) return;
    rowRef.current?.querySelector<HTMLElement>(`[data-bloc="${active}"]`)?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [active]);

  const page = (dir: 1 | -1) => {
    const row = rowRef.current;
    if (row) row.scrollBy({ left: dir * row.clientWidth * 0.7, behavior: 'smooth' });
  };

  const compareChip = active && (
    <button
      key="compare"
      className={'chip compare' + (picking ? ' picking' : '')}
      aria-pressed={vs !== null || picking}
      title={vs ? 'Stop comparing' : 'Compare with another bloc'}
      onClick={() => {
        if (vs) onVs(null);
        else onPicking(!picking);
      }}
    >
      {vs ? (
        <>
          <Icon name="close" size={10} /> Compare
        </>
      ) : picking ? (
        'Pick a bloc…'
      ) : (
        'VS Compare'
      )}
    </button>
  );

  return (
    <div
      className="chip-row"
      role="toolbar"
      aria-label="Choose a bloc to highlight"
      ref={rowRef}
      data-at-start={edges.start}
      data-at-end={edges.end}
      data-suppressed={suppressed || undefined}
      onWheel={(e) => {
        // A vertical mouse wheel has nowhere else to go here: scroll the row sideways.
        if (e.deltaX === 0 && e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY;
      }}
    >
      {/* Always present while the row overflows (hidden at its own end) so chips don't shift as it scrolls. */}
      {edges.overflow && (
        <button type="button" className="chip chip-page prev" aria-label="Scroll blocs left" tabIndex={-1} data-hidden={edges.start} onClick={() => page(-1)}>
          <Icon name="chevron-left" size={12} />
        </button>
      )}
      <button className="chip" aria-pressed={active === null} title={suppressed ? 'Show the bloc overview (turns the layer off)' : undefined} onClick={() => onChange(null)}>
        Overview
      </button>
      {BLOCS.map((b) => {
        const isA = active === b.id;
        const isB = vs === b.id;
        const chip = (
          <button
            key={b.id}
            data-bloc={b.id}
            className={'chip' + (isB ? ' is-vs' : '')}
            aria-pressed={isA || isB}
            style={{ ['--chip-color' as string]: b.color }}
            onClick={() => {
              if (picking && active && b.id !== active) {
                onVs(b.id);
                onPicking(false);
              } else if (suppressed && (isA || isB)) {
                // Under a layer the pressed chip isn't on the map: clicking it brings the bloc back.
                onChange(active);
              } else if (isB) {
                onVs(null);
              } else {
                onChange(isA ? null : b.id);
              }
            }}
            title={picking && active && b.id !== active ? `Compare ${b.shortName}` : suppressed ? `Show ${b.shortName} on the map (turns the layer off)` : b.name}
          >
            <span className="dot" aria-hidden="true" />
            {b.shortName}
            {isA && vs && <span className="tag-ab">A</span>}
            {isB && <span className="tag-ab">B</span>}
          </button>
        );
        // Compare sits right after the bloc it compares.
        return isA ? [chip, compareChip] : chip;
      })}
      {edges.overflow && (
        <button type="button" className="chip chip-page next" aria-label="Scroll blocs right" tabIndex={-1} data-hidden={edges.end} onClick={() => page(1)}>
          <Icon name="chevron-right" size={12} />
        </button>
      )}
    </div>
  );
}
