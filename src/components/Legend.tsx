import { BLOC_BY_ID } from '../data/blocs';
import { CONFIDENCE_DEF, INTENSITY_COLOR, INTENSITY_DEF, INTENSITY_LABEL, UNREST_INTENSITY_DEF, UNREST_INTENSITY_LABEL } from '../lib/labels';
import { BLOCS } from '../data/blocs';
import type { Intensity } from '../data/types';
import type { Layer, Mode } from '../lib/urlState';
import { DISPLACEMENT, DISPLACEMENT_COLORS, binLabel } from '../lib/displacement';
import { formatDate } from '../lib/labels';
import { SANCTIONS, SANCTIONS_COLORS, sanctionsBinLabel } from '../lib/sanctions';
import { ELECTIONS, ELECTIONS_VERIFIED, ELECTION_COLORS, electionBinLabel } from '../lib/elections';
import { NUCLEAR, NUCLEAR_COLOR, NUCLEAR_STATUSES, NUCLEAR_STATUS_LABEL, nuclearCount } from '../lib/nuclear';
import { ACLED, ACLED_COLORS, ACLED_UNREST_COLORS, acledBinLabel, acledNote } from '../lib/acled';
import { UCDP, UCDP_COLORS, ucdpBinLabel, ucdpNote } from '../lib/ucdp';
import { MILITARY, MILITARY_COLORS, militaryBinLabel } from '../lib/military';
import { TRADE, TRADE_COLOR, TRADE_PARTNERS, TRADE_PARTNER_LABEL } from '../lib/trade';
import { CHOKEPOINTS_FILE, CHOKEPOINT_COLOR, CHOKEPOINT_STATUSES, CHOKEPOINT_STATUS_LABEL } from '../lib/chokepoints';
import { UNREST } from '../data/unrest';
import { UNREST_COLOR, UNREST_VERIFIED } from '../lib/unrest';

interface Props {
  mode: Mode;
  bloc: string | null;
  vs: string | null;
  layer: Layer;
}

const INTENSITIES: Intensity[] = ['high', 'medium', 'low', 'latent'];

export default function Legend({ mode, bloc, vs, layer }: Props) {
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
  if (layer === 'military') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Foreign military presence</h3>
        <ul>
          {MILITARY_COLORS.map((color, i) => (
            <li key={i}>
              <span className="swatch" style={{ background: color }} />
              {militaryBinLabel(i)}
            </li>
          ))}
        </ul>
        <div className="note">
          Host countries tinted by how many foreign states or organisations keep bases, deployments or peace operations there. Curated from{' '}
          {MILITARY.sources.slice(0, 2).map((s, i) => (
            <span key={s.url}>
              {i > 0 ? ' and ' : ''}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.name.replace(/^Wikipedia: /, '')}
              </a>
            </span>
          ))}
          ; curated {formatDate(MILITARY.verified)}.
        </div>
      </aside>
    );
  }
  if (layer === 'trade') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Export dependence</h3>
        <ul>
          {TRADE_PARTNERS.map((p) => (
            <li key={p}>
              <span className="swatch" style={{ background: TRADE_COLOR[p] }} />
              Mostly to {TRADE_PARTNER_LABEL[p]}
            </li>
          ))}
          <li>
            <span className="swatch" style={{ background: 'var(--land-dim)' }} />
            None above 10%
          </li>
        </ul>
        <div className="note">
          Hue is the largest of the three export destinations; a stronger tint means a larger share (60% of exports and up reads as full colour).{' '}
          <a href={TRADE.source.url} target="_blank" rel="noopener noreferrer">
            {TRADE.source.name}
          </a>
          , fetched {formatDate(TRADE.fetchedAt)}.
        </div>
      </aside>
    );
  }
  if (layer === 'chokepoints') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Maritime chokepoints</h3>
        <ul>
          {CHOKEPOINT_STATUSES.map((st) => (
            <li key={st}>
              <span className="swatch diamond" style={{ background: CHOKEPOINT_COLOR[st] }} />
              {CHOKEPOINT_STATUS_LABEL[st]}
            </li>
          ))}
        </ul>
        <div className="note">
          Eight passages with a dated status and the conflicts that bear on them. Curated {formatDate(CHOKEPOINTS_FILE.verified)}; re-checked daily where a high-intensity conflict bears on the passage.{mode === 'conflicts' ? ' Round markers are still conflicts.' : ''}
        </div>
      </aside>
    );
  }
  if (layer === 'unrest') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Civil unrest · {UNREST.length}</h3>
        <ul>
          {INTENSITIES.map((i) => (
            <li key={i}>
              <span className="swatch triangle" style={{ background: UNREST_COLOR[i] }} />
              <span>
                {UNREST_INTENSITY_LABEL[i]}
                <span className="def">{UNREST_INTENSITY_DEF[i]}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="note">
          Protest movements, riots, uprisings, coups, mutinies and crackdowns that are not armed conflicts, each with dated, sourced assessments. Countries are tinted by their most intense episode. Checked daily (hot list) and weekly (all); updated {formatDate(UNREST_VERIFIED)}.
        </div>
      </aside>
    );
  }
  if (layer === 'acled') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Political violence</h3>
        <ul>
          {ACLED_COLORS.map((color, i) => (
            <li key={i}>
              <span className="swatch" style={{ background: color }} />
              {acledBinLabel(i)}
            </li>
          ))}
        </ul>
        <div className="note">
          {acledNote()}{' '}
          <a href={ACLED.source.url} target="_blank" rel="noopener noreferrer">
            ACLED
          </a>
          .
        </div>
      </aside>
    );
  }
  if (layer === 'acled-unrest') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Protests and riots</h3>
        <ul>
          {ACLED_UNREST_COLORS.map((color, i) => (
            <li key={i}>
              <span className="swatch" style={{ background: color }} />
              {acledBinLabel(i)}
            </li>
          ))}
        </ul>
        <div className="note">
          Protest and riot events only, from the same window as the political-violence layer. {acledNote()}{' '}
          <a href={ACLED.source.url} target="_blank" rel="noopener noreferrer">
            ACLED
          </a>
          .
        </div>
      </aside>
    );
  }
  if (layer === 'ucdp') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Organised violence</h3>
        <ul>
          {UCDP_COLORS.map((color, i) => (
            <li key={i}>
              <span className="swatch" style={{ background: color }} />
              {ucdpBinLabel(i)}
            </li>
          ))}
        </ul>
        <div className="note">
          {ucdpNote()}{' '}
          <a href={UCDP.source.url} target="_blank" rel="noopener noreferrer">
            UCDP
          </a>
          .
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
          and re-checked by the weekly research pass; last checked {formatDate(ELECTIONS_VERIFIED)}.
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
          ; curated {formatDate(NUCLEAR.verified)}. Umbrella covers NATO members, Japan, South Korea and Australia.
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
              <span>
                {INTENSITY_LABEL[i]}
                <span className="def">{INTENSITY_DEF[i]}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="note">
          Countries are tinted by the most intense conflict on their territory. Marker size follows intensity. <abbr title={`High: ${CONFIDENCE_DEF.high}. Medium: ${CONFIDENCE_DEF.medium}. Low: ${CONFIDENCE_DEF.low}.`}>Confidence</abbr>: high means two or more independent outlets agree.
        </div>
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
      <h3>{BLOCS.length} blocs tracked</h3>
      <div className="note">Pick a bloc above to colour its members, or press VS to compare two. Switch to Conflicts for who is fighting. Click any country for its dossier.</div>
    </aside>
  );
}
