import { BLOC_BY_ID } from '../data/blocs';
import { INTENSITY_COLOR, INTENSITY_LABEL } from '../lib/labels';
import type { Intensity } from '../data/types';
import type { Layer, Mode } from '../lib/urlState';
import { DISPLACEMENT, DISPLACEMENT_COLORS, binLabel } from '../lib/displacement';
import { formatDate } from '../lib/labels';
import { SANCTIONS, SANCTIONS_COLORS, sanctionsBinLabel } from '../lib/sanctions';
import { ELECTIONS, ELECTIONS_VERIFIED, ELECTION_COLORS, electionBinLabel } from '../lib/elections';
import { NUCLEAR, NUCLEAR_COLOR, NUCLEAR_STATUSES, NUCLEAR_STATUS_LABEL, nuclearCount } from '../lib/nuclear';

interface Props {
  mode: Mode;
  bloc: string | null;
  vs: string | null;
  overviewSteps: string[];
  layer: Layer;
}

const INTENSITIES: Intensity[] = ['high', 'medium', 'low', 'latent'];

export default function Legend({ mode, bloc, vs, overviewSteps, layer }: Props) {
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
  if (layer === 'sanctions') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Sanctions regimes</h3>
        <ul>
          {SANCTIONS_COLORS.map((color, i) => (
            <li key={i}>
              <span className="swatch" style={{ background: color }} />
              {sanctionsBinLabel(i)}
            </li>
          ))}
        </ul>
        <div className="note">
          Country-level regimes by the UN Security Council, the United States (OFAC) and the EU; thematic programmes against people are not counted.{' '}
          {SANCTIONS.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 ? ', ' : ''}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.name}
              </a>
            </span>
          ))}
          , fetched {formatDate(SANCTIONS.fetchedAt)}.
        </div>
      </aside>
    );
  }
  if (layer === 'elections') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Next national election</h3>
        <ul>
          {[4, 3, 2, 1, 0].map((i) => (
            <li key={i}>
              <span className="swatch" style={{ background: ELECTION_COLORS[i] }} />
              {electionBinLabel(i)}
            </li>
          ))}
        </ul>
        <div className="note">
          Next presidential or legislative vote per country. Seeded from{' '}
          <a href={ELECTIONS.source.url} target="_blank" rel="noopener noreferrer">
            {ELECTIONS.source.name.replace(/^Wikipedia: /, 'Wikipedia, ')}
          </a>{' '}
          and re-checked by the weekly research pass; last verified {formatDate(ELECTIONS_VERIFIED)}.
        </div>
      </aside>
    );
  }
  if (layer === 'nuclear') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Nuclear status</h3>
        <ul>
          {NUCLEAR_STATUSES.map((st) => (
            <li key={st}>
              <span className="swatch" style={{ background: NUCLEAR_COLOR[st] }} />
              {NUCLEAR_STATUS_LABEL[st]} · {nuclearCount(st)}
            </li>
          ))}
        </ul>
        <div className="note">
          Curated from{' '}
          {NUCLEAR.sources.slice(0, 3).map((s, i) => (
            <span key={s.url}>
              {i > 0 ? ', ' : ''}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.name.split(':')[0]}
              </a>
            </span>
          ))}
          ; verified {formatDate(NUCLEAR.verified)}. Umbrella covers NATO members, Japan, South Korea and Australia.
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
  const v = vs ? BLOC_BY_ID.get(vs) : undefined;
  if (b && v) {
    const setA = new Set(b.members.filter((m) => m.status === 'member').map((m) => m.iso));
    const setB = new Set(v.members.filter((m) => m.status === 'member').map((m) => m.iso));
    let both = 0;
    for (const iso of setA) if (setB.has(iso)) both += 1;
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>
          {b.shortName} vs {v.shortName}
        </h3>
        <ul>
          <li>
            <span className="swatch" style={{ background: b.color }} /> {b.shortName} only · {setA.size - both}
          </li>
          <li>
            <span className="swatch" style={{ background: v.color }} /> {v.shortName} only · {setB.size - both}
          </li>
          <li>
            <span className="swatch" style={{ background: `repeating-linear-gradient(45deg, ${b.color} 0 4px, ${v.color} 4px 8px)` }} /> Both · {both}
          </li>
        </ul>
        <div className="note">Full members only. Open the panel for shared members and combined figures.</div>
      </aside>
    );
  }
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
