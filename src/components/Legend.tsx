import { BLOC_BY_ID } from '../data/blocs';
import { INTENSITY_COLOR, INTENSITY_LABEL } from '../lib/labels';
import type { Intensity } from '../data/types';
import type { Layer, Mode } from '../lib/urlState';
import { DISPLACEMENT, DISPLACEMENT_COLORS, binLabel } from '../lib/displacement';
import { formatDate } from '../lib/labels';

interface Props {
  mode: Mode;
  bloc: string | null;
  overviewSteps: string[];
  layer: Layer;
}

const INTENSITIES: Intensity[] = ['high', 'medium', 'low', 'latent'];

export default function Legend({ mode, bloc, overviewSteps, layer }: Props) {
  if (layer === 'displacement') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Forcibly displaced</h3>
        <ul>
          {DISPLACEMENT_COLORS.map((color, i) => (
            <li key={i}>
              <span className="swatch" style={{ background: color }} />
              {binLabel(i)}
            </li>
          ))}
        </ul>
        <div className="note">
          People displaced from each country: refugees, asylum seekers, IDPs and others in need of protection.{' '}
          <a href={DISPLACEMENT.source.url} target="_blank" rel="noopener noreferrer">
            UNHCR
          </a>{' '}
          {DISPLACEMENT.year} figures, fetched {formatDate(DISPLACEMENT.fetchedAt)}.
          {mode === 'conflicts' ? ' Markers still show conflict intensity.' : ''}
        </div>
      </aside>
    );
  }
  if (mode === 'conflicts') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Conflict intensity</h3>
        <ul>
          {INTENSITIES.map((i) => (
            <li key={i}>
              <span className="swatch circle" style={{ background: INTENSITY_COLOR[i] }} />
              {INTENSITY_LABEL[i]}
            </li>
          ))}
        </ul>
        <div className="note">Countries are tinted by the most intense conflict on their territory. Marker size follows intensity.</div>
      </aside>
    );
  }

  const b = bloc ? BLOC_BY_ID.get(bloc) : undefined;
  if (b) {
    const statuses = new Set(b.members.map((m) => m.status));
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>{b.shortName}</h3>
        <ul>
          <li>
            <span className="swatch" style={{ background: b.color }} /> Member
          </li>
          {(statuses.has('partner') || statuses.has('observer') || statuses.has('invited')) && (
            <li>
              <span className="swatch" style={{ background: b.color, opacity: 0.45 }} /> Partner, observer or invited
            </li>
          )}
          {(statuses.has('suspended') || statuses.has('frozen')) && (
            <li>
              <span className="swatch" style={{ background: `repeating-linear-gradient(45deg, ${b.color} 0 3px, transparent 3px 6px)` }} /> Suspended or frozen
            </li>
          )}
        </ul>
      </aside>
    );
  }

  return (
    <aside className="legend frame" aria-label="Legend">
      <h3>Bloc memberships</h3>
      <ul>
        {overviewSteps.map((color, i) => (
          <li key={i}>
            <span className="swatch" style={{ background: color }} />
            {i === 0 ? 'None' : i === overviewSteps.length - 1 ? `${i}+` : String(i)}
          </li>
        ))}
      </ul>
      <div className="note">Pick a bloc above to see its members. Click any country for details.</div>
    </aside>
  );
}
