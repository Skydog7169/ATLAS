import { BLOCS } from '../data/blocs';

interface Props {
  active: string | null;
  onChange: (id: string | null) => void;
}

export default function BlocChips({ active, onChange }: Props) {
  return (
    <div className="chip-row" role="toolbar" aria-label="Choose a bloc to highlight">
      <button className="chip" aria-pressed={active === null} onClick={() => onChange(null)}>
        Overview
      </button>
      {BLOCS.map((b) => (
        <button
          key={b.id}
          className="chip"
          aria-pressed={active === b.id}
          style={{ ['--chip-color' as string]: b.color }}
          onClick={() => onChange(active === b.id ? null : b.id)}
          title={b.name}
        >
          <span className="dot" aria-hidden="true" />
          {b.shortName}
        </button>
      ))}
    </div>
  );
}
