import { US_LAYERS, US_LAYER_LABEL, type UsLayer } from '../lib/usStates';

interface Props {
  value: UsLayer;
  onChange: (layer: UsLayer) => void;
  onWorld: () => void;
}

/** The US view's chip row: back to the world map, then one chip per political layer. */
export default function UsChips({ value, onChange, onWorld }: Props) {
  return (
    <div className="chip-row" role="toolbar" aria-label="Choose what colours the states">
      <button className="chip" onClick={onWorld} title="Back to the world map">
        ← World
      </button>
      {US_LAYERS.map((l) => (
        <button key={l} className="chip" aria-pressed={value === l} onClick={() => onChange(l)}>
          {US_LAYER_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
