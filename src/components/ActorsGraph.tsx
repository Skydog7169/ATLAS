import type { Conflict } from '../data/types';
import { SUPPORT_LABEL, sides } from '../lib/actors';
import { countryName } from '../lib/countries';

interface Props {
  conflict: Conflict;
  onSelectCountry: (iso: string) => void;
}

const COL_W = 150;
const ROW_H = 34;
const BACKER_H = 20;
const GAP = 14;
const PAD = 6;

/**
 * Who-backs-whom diagram: one column per side, an actor box per party, and
 * its outside backers stacked beneath with a connector. Pure SVG sized by
 * viewBox so it scales to the panel width on phones. Everything drawn here is
 * also listed as text below the diagram for screen readers.
 */
export default function ActorsGraph({ conflict, onSelectCountry }: Props) {
  const cols = sides(conflict);
  if (cols.length === 0) return null;
  const colHeight = (c: (typeof cols)[number]) => c.actors.reduce((h, a) => h + ROW_H + (a.backers?.length ?? 0) * BACKER_H + GAP, 0);
  const height = Math.max(...cols.map(colHeight)) + 24;
  const width = cols.length * (COL_W + GAP) - GAP;
  const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  return (
    <figure className="actors">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="group" aria-label={`Parties to ${conflict.name} and their backers`}>
        {cols.map((col, ci) => {
          const x = ci * (COL_W + GAP);
          let y = 18;
          return (
            <g key={col.side}>
              <text x={x} y={10} className="side">
                {truncate(col.side.toUpperCase(), 22)}
              </text>
              {col.actors.map((a) => {
                const top = y;
                const backers = a.backers ?? [];
                y += ROW_H + backers.length * BACKER_H + GAP;
                const mediator = /mediator/i.test(col.side);
                return (
                  <g key={a.id}>
                    <rect x={x} y={top} width={COL_W} height={ROW_H - 6} className={`actor actor-${a.type}${mediator ? ' mediator' : ''}`} />
                    <text x={x + PAD} y={top + 12} className="actor-name">
                      {truncate(a.name, 24)}
                    </text>
                    <text x={x + PAD} y={top + 23} className="actor-type">
                      {a.type.replace('-', ' ')}
                    </text>
                    {backers.map((b, bi) => {
                      const by = top + ROW_H + bi * BACKER_H;
                      const label = `${b.iso ? countryName(b.iso) : b.name} · ${SUPPORT_LABEL[b.support].toLowerCase()}`;
                      return (
                        <g
                          key={b.name + b.support}
                          className={b.iso ? 'backer clickable' : 'backer'}
                          onClick={b.iso ? () => onSelectCountry(b.iso!) : undefined}
                          tabIndex={b.iso ? 0 : undefined}
                          role={b.iso ? 'button' : undefined}
                          aria-label={b.iso ? `${countryName(b.iso)}: ${SUPPORT_LABEL[b.support]} for ${a.name}` : undefined}
                          onKeyDown={b.iso ? (e) => (e.key === 'Enter' || e.key === ' ') && onSelectCountry(b.iso!) : undefined}
                        >
                          <path d={`M${x + 10} ${top + ROW_H - 6} V${by + 9} H${x + 18}`} className="link" />
                          <text x={x + 22} y={by + 12} className="backer-name">
                            {truncate(label, 26)}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {cols.map((col) => `${col.side}: ${col.actors.map((a) => `${a.name}${a.backers?.length ? ` (backed by ${a.backers.map((b) => `${b.iso ? countryName(b.iso) : b.name}, ${SUPPORT_LABEL[b.support].toLowerCase()}`).join('; ')})` : ''}`).join(', ')}`).join('. ')}
      </figcaption>
    </figure>
  );
}
