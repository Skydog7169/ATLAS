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

export default function BlocChips({ active, vs, picking, onChange, onVs, onPicking }: Props) {
  return (
    <div className="chip-row" role="toolbar" aria-label="Choose a bloc to highlight">
      <button className="chip" aria-pressed={active === null} onClick={() => onChange(null)}>
        Overview
      </button>
      {active && (
        <button
          className={'chip compare' + (picking ? ' picking' : '')}
          aria-pressed={vs !== null || picking}
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
            style={{ ['--chip-color' as string]: b.color }}
            onClick={() => {
              if (picking && active && b.id !== active) {
                onVs(b.id);
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
            {isA && vs && <span className="tag-ab">A</span>}
            {isB && <span className="tag-ab">B</span>}
          </button>
        );
      })}
    </div>
  );
}
