import type { ReactNode } from 'react';
import { BLOCS } from '../data/blocs';
import { CONFLICTS } from '../data/conflicts';
import { UNREST } from '../data/unrest';
import { TRUSTED_HOSTS } from '../data/guards';
import type { Confidence, Intensity } from '../data/types';
import { ACLED } from '../lib/acled';
import { CHOKEPOINTS_FILE } from '../lib/chokepoints';
import { DISPLACEMENT } from '../lib/displacement';
import { ELECTIONS_VERIFIED } from '../lib/elections';
import { DATA_ASOF } from '../lib/frontdoor';
import { CONFIDENCE_DEF, INTENSITY_DEF, INTENSITY_LABEL, STALE_DAYS, STATUS_LABEL, UNREST_INTENSITY_DEF, UNREST_INTENSITY_LABEL, formatDate } from '../lib/labels';
import { MILITARY } from '../lib/military';
import { NUCLEAR } from '../lib/nuclear';
import { SANCTIONS } from '../lib/sanctions';
import { TRADE } from '../lib/trade';
import { UCDP } from '../lib/ucdp';
import { WORLDBANK } from '../lib/worldbank';
import { WB_HISTORY } from '../lib/worldbankHistory';
import { ASK_ENABLED } from './AskPanel';

const INTENSITIES: Intensity[] = ['high', 'medium', 'low', 'latent'];
const CONFIDENCES: Confidence[] = ['high', 'medium', 'low'];

const STATUS_DEF: Record<keyof typeof STATUS_LABEL, string> = {
  member: 'Full member with all rights',
  suspended: 'Membership suspended by the organisation',
  frozen: 'The member has frozen its own participation',
  partner: 'Formal partner, associate or dialogue partner',
  observer: 'Observer status',
  invited: 'Invited to join; not yet a member',
  candidate: 'Formal candidate for membership; not counted as a member',
};

/** About > Disputed territories. The dossier profile line links here for each entity listed. */
const DISPUTED: Array<{ name: string; text: string }> = [
  { name: 'Taiwan', text: 'Self-governing; claimed by the People’s Republic of China; not a UN member.' },
  { name: 'Palestine', text: 'UN non-member observer state. Ramallah is given as the administrative seat; Palestine claims East Jerusalem as its capital.' },
  { name: 'Israel', text: 'Israel designates Jerusalem as its capital; its status is disputed and most embassies are in Tel Aviv.' },
  { name: 'Kosovo', text: 'Partially recognised; not a UN member. It uses the user-assigned code UNK.' },
  { name: 'Western Sahara', text: 'On the UN list of non-self-governing territories, claimed by both Morocco and the Sahrawi Arab Democratic Republic. ATLAS uses the geographic name.' },
  { name: 'Northern Cyprus and Somaliland', text: 'Drawn as neutral territory, without a dossier of their own.' },
];

/**
 * How ATLAS works, in short headed blocks: what it is, who writes it, what
 * the words mean, the rules the drafting follows and what the human review
 * does and does not cover, then sources, freshness and caveats.
 */
export default function AboutView({ onClose, closeButton, actions }: { onClose: () => void; closeButton: (onClick: () => void) => ReactNode; actions: ReactNode }) {
  return (
    <>
      <div className="panel-head">
        <div className="panel-title">
          <p className="eyebrow">About</p>
          <h2>How ATLAS works</h2>
        </div>
        {closeButton(onClose)}
      </div>
      <div className="panel-body about">
        <h3>What ATLAS is</h3>
        <p>
          An open geopolitics map: who belongs to which of {BLOCS.length} blocs, where {CONFLICTS.length} armed conflicts and {UNREST.length} episodes of civil unrest are, how intense they are and what changed. It is built for orientation, not operations. Every assessment links to its sources and carries the date it was last updated.
        </p>

        <h3>How it’s written</h3>
        <p>
          An AI research assistant (Anthropic’s Claude, with web search) re-checks hot items daily, Tuesday to Sunday (high-intensity conflicts and unrest, anything updated in the last 14 days, anything unchecked for three weeks), and everything weekly on Mondays. It drafts each change with citations, and an editor reviews it as a proposed change before it is published. Each assessment says so underneath: “AI-drafted (Claude, web search) from N cited sources · approved by an editor”.
        </p>
        <h4>What the review covers</h4>
        <ul className="plain">
          <li>The editor approves or rejects each proposed change as a whole, reading the new text against its citations.</li>
          <li>It is not an independent fact-check of every sentence. Follow the source links before relying on a detail.</li>
          <li>Unrest episodes can be added automatically when two independent, non-Wikipedia outlets back them; they still go through the same review before publication.</li>
        </ul>

        <h4>Rules the drafting follows</h4>
        <ul className="plain">
          <li>It may cite only pages that appeared in its own search results, or pages on a short list of trusted trackers and wire services.</li>
          <li>At least one citation must be the specific article behind the claim. Front pages and tracker index pages are shown as “Background reference”, never as the only source.</li>
          <li>Intensity moves at most one step per pass; a larger proposed jump is clamped and flagged for the editor.</li>
          <li>No change without new facts: a situation that has not materially changed only gets a “Checked, no change” date.</li>
        </ul>

        <h3 id="about-definitions">Definitions</h3>
        <h4>Conflict intensity</h4>
        <dl className="defs">
          {INTENSITIES.map((i) => (
            <div key={i}>
              <dt>{INTENSITY_LABEL[i]}</dt>
              <dd>{INTENSITY_DEF[i]}</dd>
            </div>
          ))}
        </dl>
        <h4>Unrest intensity</h4>
        <dl className="defs">
          {INTENSITIES.map((i) => (
            <div key={i}>
              <dt>{UNREST_INTENSITY_LABEL[i]}</dt>
              <dd>{UNREST_INTENSITY_DEF[i]}</dd>
            </div>
          ))}
        </dl>
        <h4>Confidence</h4>
        <dl className="defs">
          {CONFIDENCES.map((c) => (
            <div key={c}>
              <dt>{c[0]!.toUpperCase() + c.slice(1)}</dt>
              <dd>{CONFIDENCE_DEF[c]}</dd>
            </div>
          ))}
          <div>
            <dt>Not assessed</dt>
            <dd>Older entries written before confidence was recorded</dd>
          </div>
        </dl>
        <h4>Membership status</h4>
        <dl className="defs">
          {(Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((k) => (
            <div key={k}>
              <dt>{STATUS_LABEL[k]}</dt>
              <dd>{STATUS_DEF[k]}</dd>
            </div>
          ))}
        </dl>

        <h3>Sources</h3>
        <ul className="plain">
          <li>Conflicts: CFR Global Conflict Tracker, ACLED, Crisis Group CrisisWatch and ISW as background, with dated reporting from wire services and national press for each assessment.</li>
          <li>Civil unrest: wire services, Crisis Group, ACLED, the Carnegie Global Protest Tracker, HRW and Amnesty.</li>
          {ACLED.available && <li>Political-violence and protest events: ACLED, last {ACLED.days} days.</li>}
          {UCDP.available && <li>Organised-violence deaths: the UCDP Georeferenced Event Dataset.</li>}
          <li>Memberships: the organisations’ own sites.</li>
          <li>Displacement: UNHCR Refugee Data Finder, by country of origin.</li>
          <li>Figures: World Bank Open Data. Trade: World Bank WITS.</li>
          <li>Sanctions: OFAC’s programme index, the EU Sanctions Map and UN Security Council committees (country-level regimes only).</li>
          <li>Elections: seeded from Wikipedia’s list of next general elections and IFES ElectionGuide, then re-checked weekly.</li>
          <li>Nuclear status: SIPRI, the Arms Control Association and NATO, curated by hand. Chokepoints and military presence: curated with a source per entry.</li>
          <li>Geometry: Natural Earth via world-atlas.</li>
        </ul>
        <details className="about-hosts">
          <summary>Trusted hosts for automated citations</summary>
          <p className="mono">{TRUSTED_HOSTS.join(', ')}</p>
        </details>

        <h3>Freshness</h3>
        <p>
          Four words are used throughout: <b>Updated</b> (the text changed), <b>Checked, no change</b> (re-read by the research pass), <b>Data fetched</b> (pulled from an API) and <b>Curated</b> (maintained by hand). An amber “May be out of date” chip appears on assessments older than {STALE_DAYS.assessment} days and chokepoint statuses older than {STALE_DAYS.chokepoint}.
        </p>
        <ul className="history">
          <li>
            <span className="when">{formatDate(DATA_ASOF)}</span>
            <span>Updated: newest conflict or unrest assessment or bloc membership change</span>
          </li>
          <li>
            <span className="when">{formatDate(DISPLACEMENT.fetchedAt)}</span>
            <span>Data fetched: UNHCR displacement figures ({DISPLACEMENT.year} data)</span>
          </li>
          <li>
            <span className="when">{formatDate(WORLDBANK.fetchedAt)}</span>
            <span>Data fetched: World Bank population, GDP and military spending (latest year per country)</span>
          </li>
          <li>
            <span className="when">{formatDate(SANCTIONS.fetchedAt)}</span>
            <span>Data fetched: sanctions regimes from OFAC, the EU Sanctions Map and the UN Security Council</span>
          </li>
          <li>
            <span className="when">{formatDate(ELECTIONS_VERIFIED)}</span>
            <span>Checked: next national elections (newest check)</span>
          </li>
          <li>
            <span className="when">{formatDate(NUCLEAR.verified)}</span>
            <span>Curated: nuclear status</span>
          </li>
          <li>
            <span className="when">{formatDate(CHOKEPOINTS_FILE.verified)}</span>
            <span>Curated: chokepoint status, re-checked daily for passages tied to a high-intensity conflict (military presence curated {formatDate(MILITARY.verified)})</span>
          </li>
          <li>
            <span className="when">{formatDate(TRADE.fetchedAt)}</span>
            <span>Data fetched: export shares and largest partners (World Bank WITS, newest year per country)</span>
          </li>
          <li>
            <span className="when">{formatDate(WB_HISTORY.fetchedAt)}</span>
            <span>Data fetched: GDP by year since {WB_HISTORY.from} for the bloc trend charts (World Bank)</span>
          </li>
        </ul>

        <h3 id="about-disputed">Disputed territories</h3>
        <p>Where a name, capital or status is itself in dispute, ATLAS states the facts of the dispute rather than one side’s position, and links here from the dossier. Borders follow Natural Earth and imply no position.</p>
        <dl className="defs">
          {DISPUTED.map((d) => (
            <div key={d.name}>
              <dt>{d.name}</dt>
              <dd>{d.text}</dd>
            </div>
          ))}
        </dl>

        <h3>Caveats</h3>
        <ul className="plain">
          <li>Dependent territories drawn on their own take the alliances whose treaty area covers them and their sovereign’s nuclear deterrent: Greenland is shown in NATO via Denmark, while Puerto Rico and the Falklands lie outside NATO’s Article 6 area. They never inherit EU membership, trade or elections. French Guiana is part of France’s polygon.</li>
          <li>Conflict tinting fills a country by the most intense conflict fought on its territory. States whose forces fight only abroad (the US in the Iran war, Saudi Arabia in Yemen, Rwanda in eastern DR Congo) are drawn with a dashed outline instead. Maritime flashpoints such as Hormuz and the South China Sea have no land theatre.</li>
          <li>Bloc figures count full members only and skip countries without a World Bank value; the tiles say when coverage is partial.</li>
          <li>Displacement figures are UNHCR mid-year or end-year stocks, not flows, and lag events by months. UNHCR figures exclude Palestine refugees under UNRWA’s mandate, so Palestine adds UNRWA’s register and IDMC’s IDP estimate; UNHCR reports Kosovo together with Serbia.</li>
          <li>Older assessments (the December 2025 baseline) cite trackers’ front pages only and are marked “Baseline summary · general references only”.</li>
          <li>An assessment is a dated snapshot. Check the linked sources before relying on it.</li>
        </ul>

        <h3>Corrections</h3>
        <p>
          Spotted an error or a missing development?{' '}
          <a href="https://github.com/Skydog7169/ATLAS/issues/new" target="_blank" rel="noopener noreferrer">
            Open an issue on GitHub
          </a>{' '}
          with a link to the source. Corrections go through the same review as any other change and appear in Latest changes.
        </p>

        <h3>Following things</h3>
        <p>
          Every country has a dossier (memberships, conflicts, latest changes, displacement and figures) at a link you can share. The strip along the bottom cycles the newest dated changes and pauses while you hover it. Press the star on any panel to add it to a watchlist kept in this browser; the ticker and Latest changes can be filtered to it. A strip under the header lists what changed since you last pressed “Mark read”. The same changes are available as <a href="/feed.xml">RSS</a> and <a href="/feed.json">JSON Feed</a>.
        </p>
        <h3>Globe, briefing, embed and export</h3>
        <p>
          The globe button in the map controls switches to an orthographic globe you can spin by dragging (it keeps turning briefly when released) and the centre travels in the link. The briefing button goes full screen, hides the chrome and cycles through the live high-intensity conflicts and your watchlist, nine seconds each; Space pauses, arrows step, Escape exits. Add <span className="mono">embed=1</span> to any link to get a chrome-less view for an iframe (dark unless the link also says <span className="mono">theme=light</span> or <span className="mono">theme=auto</span>), and the download button saves the map you are looking at as a PNG with its legend and a date stamp.
        </p>
        <h3>Analysis</h3>
        <p>
          Any country dossier offers “Relationship with…”: pick a second country to see shared blocs, the conflicts that link them, US and EU sanctions either side applies to the other (other national sanctions and countersanctions are not tracked), forces either keeps in the other, and each side’s export share to the other. Bloc panels chart membership and combined GDP since 1990 from accession years and World Bank data.
          {ASK_ENABLED ? ' Ask ATLAS answers questions strictly from this dataset with citations; it is rate-limited and capped per day.' : ''}
        </p>
        <h3>Keyboard</h3>
        <p className="mono" style={{ fontSize: 12 }}>
          / search · arrows pan or rotate · + − zoom · 0 reset · Tab through conflict markers, Enter opens · Esc closes the tooltip · briefing: Space pauses, arrows step, Esc exits
        </p>
        <div className="panel-actions">
          {actions}
          <a className="text-btn" href="https://github.com/Skydog7169/ATLAS" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
            Source on GitHub
          </a>
        </div>
      </div>
    </>
  );
}
