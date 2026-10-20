import { Children, cloneElement, type ReactElement, type ReactNode } from 'react';
import { BLOC_BY_ID } from '../data/blocs';
import { INTENSITY_COLOR, INTENSITY_LABEL, conflictFill } from '../lib/labels';
import { FAINT_FILL, NO_DATA_SWATCH, hatchSwatch } from '../lib/palette';
import type { Intensity } from '../data/types';
import type { Layer, Mode } from '../lib/urlState';
import { DISPLACEMENT, DISPLACEMENT_COLORS, binLabel } from '../lib/displacement';
import { formatDate, formatMonth } from '../lib/labels';
import { layerAsOf } from '../lib/layerAsOf';
import { SANCTIONS, SANCTIONS_COLORS, sanctionsBinLabel } from '../lib/sanctions';
import { ELECTIONS, ELECTIONS_VERIFIED, ELECTION_COLORS, electionBinLabel } from '../lib/elections';
import { NUCLEAR, NUCLEAR_COLOR, NUCLEAR_HATCHED, NUCLEAR_STATUSES, NUCLEAR_STATUS_LABEL, nuclearCount } from '../lib/nuclear';
import { ACLED, ACLED_COLORS, ACLED_UNREST_COLORS, acledBinLabel, acledNote } from '../lib/acled';
import { UCDP, UCDP_COLORS, ucdpBinLabel, ucdpNote } from '../lib/ucdp';
import { MILITARY, MILITARY_COLORS, militaryBinLabel } from '../lib/military';
import { TRADE, TRADE_BAND_LABEL, TRADE_PARTNERS, TRADE_PARTNER_LABEL, tradeMix } from '../lib/trade';
import { CHOKEPOINTS_FILE, CHOKEPOINT_COLOR, CHOKEPOINT_GLYPH, CHOKEPOINT_STATUSES, CHOKEPOINT_STATUS_LABEL } from '../lib/chokepoints';
import { UNREST } from '../data/unrest';
import { UNREST_COLOR, UNREST_VERIFIED } from '../lib/unrest';
import { unrestFillColor } from '../lib/palette';

interface Props {
  mode: Mode;
  bloc: string | null;
  vs: string | null;
  overviewSteps: string[];
  layer: Layer;
  /** Conflicts replay month, or null when live. */
  month?: string | null;
  /** Inside an iframe: no bloc chips above the map to point at. */
  embed?: boolean;
}

const INTENSITIES: Intensity[] = ['high', 'medium', 'low', 'latent'];

/** The "No data" row every quantitative legend whose source can lack a country carries. */
function NoDataRow() {
  return (
    <li>
      <span className="swatch" style={{ backgroundColor: 'var(--land)', backgroundImage: NO_DATA_SWATCH }} />
      No data
    </li>
  );
}

/**
 * During replay a data layer still shows current data while the markers move
 * back in time; the legend says so, so the two time bases never pass as one.
 */
export default function Legend(props: Props) {
  const el = LegendBody(props) as ReactElement<{ children?: ReactNode }>;
  const { month, layer, mode } = props;
  if (!month || !layer || mode !== 'conflicts') return el;
  const asOf = layerAsOf(layer);
  const note = (
    <div className="note replay-note" key="replay-note">
      Layer shows current data{asOf ? ` (as of ${formatDate(asOf)})` : ''}; markers show {formatMonth(month)}.
    </div>
  );
  return cloneElement(el, undefined, ...Children.toArray(el.props.children), note);
}

function LegendBody({ mode, bloc, vs, overviewSteps, layer, month = null, embed = false }: Props) {
  if (layer === 'displacement') {
    return (
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Forcibly displaced</h2>
        <ul>
          {DISPLACEMENT_COLORS.map((color, i) => (
            <li key={i}>
              <span className="swatch" style={{ background: color }} />
              {binLabel(i)}
            </li>
          ))}
          <li>
            <span className="swatch" style={hatchSwatch(DISPLACEMENT_COLORS[4]!)} />
            Known source gap (non-UNHCR figures)
          </li>
          <NoDataRow />
        </ul>
        <div className="note">
          People displaced from each country: refugees, asylum seekers, IDPs and others in need of protection. UNHCR figures exclude Palestine refugees under UNRWA's mandate; Palestine adds UNRWA's register and is hatched. Kosovo is counted with Serbia.{' '}
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
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Foreign military presence</h2>
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
          ; verified {formatDate(MILITARY.verified)}.
        </div>
      </aside>
    );
  }
  if (layer === 'trade') {
    return (
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Export dependence</h2>
        <table className="trade-key">
          <thead>
            <tr>
              <th scope="col">Largest of</th>
              {TRADE_BAND_LABEL.map((b) => (
                <th key={b} scope="col">
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRADE_PARTNERS.map((p) => (
              <tr key={p}>
                <th scope="row">{p === 'eu' ? 'EU' : p === 'us' ? 'US' : 'China'}</th>
                {([0, 1, 2] as const).map((band) => (
                  <td key={band}>
                    <span className="swatch" style={{ background: tradeMix(p, band) }} title={`${TRADE_PARTNER_LABEL[p]}, ${TRADE_BAND_LABEL[band]} of exports`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <ul>
          <li>
            <span className="swatch" style={{ background: `repeating-linear-gradient(45deg, ${tradeMix('us', 1)} 0 4px, ${tradeMix('china', 1)} 4px 8px)` }} />
            Near tie (within 2 points)
          </li>
          <li>
            <span className="swatch" style={{ background: FAINT_FILL }} />
            None above 10%
          </li>
          <NoDataRow />
        </ul>
        <div className="note">
          Hue is the largest export share among the US, China and the EU; depth is the share band. EU members are tinted by the US and China only, since most of their EU share is the single market.{' '}
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
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Maritime chokepoints</h2>
        <ul>
          {CHOKEPOINT_STATUSES.map((st) => (
            <li key={st}>
              <span className={'swatch diamond glyph-' + CHOKEPOINT_GLYPH[st]} style={{ ['--glyph-color' as string]: CHOKEPOINT_COLOR[st], background: CHOKEPOINT_COLOR[st] }} />
              {CHOKEPOINT_STATUS_LABEL[st]}
            </li>
          ))}
        </ul>
        <div className="note">
          Eight passages with a dated status and the conflicts that bear on them. Curated; verified {formatDate(CHOKEPOINTS_FILE.verified)}.{mode === 'conflicts' ? ' Round markers are still conflicts.' : ''}
        </div>
      </aside>
    );
  }
  if (layer === 'unrest') {
    return (
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Civil unrest · {UNREST.length}</h2>
        <ul>
          {INTENSITIES.map((i) => (
            <li key={i}>
              <span className="swatch triangle" style={{ background: UNREST_COLOR[i] }} />
              <span className="swatch" style={{ background: unrestFillColor(i) }} aria-hidden="true" />
              {INTENSITY_LABEL[i]}
            </li>
          ))}
        </ul>
        <div className="note">
          Protest movements, riots, uprisings, coups, mutinies and crackdowns that are not armed conflicts, each with dated, sourced assessments. Countries are tinted by their most intense episode. Curated and reassessed weekly; newest assessment {formatDate(UNREST_VERIFIED)}.
        </div>
      </aside>
    );
  }
  if (layer === 'acled') {
    return (
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Political violence</h2>
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
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Protests and riots</h2>
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
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Organised violence</h2>
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
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Sanctions regimes</h2>
        <ul>
          {SANCTIONS_COLORS.map((color, i) => (
            <li key={i}>
              <span className="swatch" style={{ background: color }} />
              {sanctionsBinLabel(i)}
            </li>
          ))}
          <li>
            <span className="swatch" style={{ background: `repeating-linear-gradient(45deg, ${SANCTIONS_COLORS[SANCTIONS_COLORS.length - 1]} 0 3px, transparent 3px 6px)` }} />
            Comprehensive US embargo
          </li>
        </ul>
        <div className="note">
          Country-level regimes by the UN Security Council, the United States (OFAC) and the EU; thematic programmes against people are not counted, nor are regimes that protect the country they are filed under (EU measures over Crimea count against no one, not Ukraine).{' '}
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
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Next national election</h2>
        <ul>
          {[4, 3, 2, 1, 0].map((i) => (
            <li key={i}>
              <span className="swatch" style={{ background: ELECTION_COLORS[i] }} />
              {electionBinLabel(i)}
            </li>
          ))}
          <NoDataRow />
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
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Nuclear status</h2>
        <ul>
          {NUCLEAR_STATUSES.map((st) => (
            <li key={st}>
              <span className="swatch" style={NUCLEAR_HATCHED.has(st) ? hatchSwatch(NUCLEAR_COLOR[st]) : { background: NUCLEAR_COLOR[st] }} />
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
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">Conflict intensity{month ? ` · ${formatMonth(month)}` : ''}</h2>
        <ul>
          {INTENSITIES.map((i) => (
            <li key={i}>
              <span className="swatch circle" style={{ background: INTENSITY_COLOR[i] }} />
              <span className="swatch" style={{ background: conflictFill(i) }} aria-hidden="true" />
              {INTENSITY_LABEL[i]}
            </li>
          ))}
          <li>
            <span className="swatch outline" style={{ borderColor: INTENSITY_COLOR.high }} />
            Party to a conflict abroad
          </li>
          {month && (
            <>
              <li className="replay-key">
                <span className="swatch circle stale" style={{ background: 'var(--fg-muted)' }} />
                Faded: no new assessment, last one carried forward
              </li>
              <li className="replay-key">
                <span className="swatch circle ghost" style={{ background: 'transparent' }} />
                Outline: under way, not yet tracked
              </li>
            </>
          )}
        </ul>
        <div className="note">Markers (circles) and territory (squares): countries are filled by the most intense conflict fought on their territory, deeper for more intense. A dashed outline marks a state whose forces fight only abroad. Marker size follows intensity.</div>
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
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">
          {b.shortName} vs {v.shortName}
        </h2>
        <ul>
          <li>
            <span className="swatch" style={{ background: b.color }} /> {b.shortName} only · {setA.size - both}
          </li>
          <li>
            <span className="swatch" style={hatchSwatch(v.color)} /> {v.shortName} only · {setB.size - both}
          </li>
          <li>
            <span className="swatch" style={{ background: `repeating-linear-gradient(45deg, ${b.color} 0 4px, ${v.color} 4px 8px)` }} /> Both · {both}
          </li>
        </ul>
        <div className="note">Full members only. Open the panel for shared members, suspended states and each bloc's totals.</div>
      </aside>
    );
  }
  if (b) {
    const statuses = new Set(b.members.map((m) => m.status));
    return (
      <aside className="legend" aria-label="Legend">
        <h2 className="legend-title">{b.shortName}</h2>
        <ul>
          <li>
            <span className="swatch" style={{ background: b.color }} /> Member
          </li>
          {(statuses.has('partner') || statuses.has('observer') || statuses.has('invited') || statuses.has('candidate')) && (
            <li>
              <span className="swatch" style={{ background: b.color, opacity: 0.45 }} /> {statuses.has('candidate') ? 'Candidate' : 'Partner, observer or invited'}
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
    <aside className="legend" aria-label="Legend">
      <h2 className="legend-title">Bloc memberships</h2>
      <ul>
        {overviewSteps.map((color, i) => (
          <li key={i}>
            <span className="swatch" style={{ background: color }} />
            {i === 0 ? 'None' : i === overviewSteps.length - 1 ? `${i}+` : String(i)}
          </li>
        ))}
      </ul>
      <div className="note">{embed ? 'Tap a country for details · open in ATLAS ↗ to pick a bloc.' : 'Pick a bloc above to see its members. Click any country for details.'}</div>
    </aside>
  );
}
