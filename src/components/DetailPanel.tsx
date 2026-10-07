import { useMemo, useState } from 'react';
import { BLOCS, BLOC_BY_ID, blocsForCountry } from '../data/blocs';
import { CONFLICTS, CONFLICT_BY_ID, INTENSITY_ORDER, conflictsForCountry } from '../data/conflicts';
import type { Bloc, Conflict, CountryRecord, HistoryEntry, MembershipStatus } from '../data/types';
import { COUNTRY_BY_ISO, countryName } from '../lib/countries';
import { allChanges, changesSince, entryAt } from '../lib/history';
import { CATEGORY_LABEL, CHANGE_LABEL, CONFLICT_TYPE_LABEL, INTENSITY_COLOR, INTENSITY_LABEL, STATUS_LABEL, formatDate, formatMonth } from '../lib/labels';
import type { Selection } from '../lib/urlState';
import { WORLD, WORLDBANK, blocFigures, formatCount, formatUsd, share, type Figures } from '../lib/worldbank';
import { DISPLACEMENT } from '../lib/displacement';
import { TRUSTED_HOSTS } from '../data/guards';

interface Props {
  selection: Exclude<Selection, null>;
  /** Conflicts-mode replay month, or null when live. */
  month: string | null;
  /** Blocs being compared, when the selection is 'compare'. */
  compare: { a: Bloc; b: Bloc } | null;
  onStopCompare: () => void;
  onClose: () => void;
  onSelectCountry: (iso: string) => void;
  onSelectBloc: (id: string) => void;
  onSelectConflict: (id: string) => void;
  onHighlightBloc: (id: string) => void;
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn" onClick={onClick} aria-label="Close panel">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="text-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable: the URL bar already holds the link */
        }
      }}
    >
      {copied ? 'Link copied' : 'Copy link'}
    </button>
  );
}

function Sources({ sources }: { sources: Array<{ name: string; url: string }> }) {
  return (
    <>
      <h4>Sources</h4>
      <ul className="link-list">
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.name}
              <span className="meta">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function CountryView({ country, props }: { country: CountryRecord; props: Props }) {
  const memberships = blocsForCountry(country.cca3);
  const conflicts = conflictsForCountry(country.cca3).sort((a, b) => INTENSITY_ORDER[b.intensity] - INTENSITY_ORDER[a.intensity]);
  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">{country.subregion ?? country.region}</span>
          {country.name}
        </h2>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <p style={{ color: 'var(--fg-muted)' }}>
          {country.official}
          {country.capital ? ` · Capital: ${country.capital}` : ''}
        </p>
        <h4>Bloc memberships</h4>
        {memberships.length === 0 ? (
          <p style={{ color: 'var(--fg-muted)' }}>Not a member of any bloc tracked here.</p>
        ) : (
          <ul className="link-list">
            {memberships.map(({ bloc, membership }) => (
              <li key={bloc.id}>
                <button onClick={() => props.onSelectBloc(bloc.id)}>
                  <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: bloc.color, opacity: membership.status === 'member' ? 1 : 0.5 }} />
                  {bloc.shortName}
                  <span className="meta">{membership.status === 'member' ? '' : STATUS_LABEL[membership.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <h4>Conflicts</h4>
        {conflicts.length === 0 ? (
          <p style={{ color: 'var(--fg-muted)' }}>No tracked conflict on this territory.</p>
        ) : (
          <ul className="link-list">
            {conflicts.map((c) => (
              <li key={c.id}>
                <button onClick={() => props.onSelectConflict(c.id)}>
                  <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: INTENSITY_COLOR[c.intensity] }} />
                  {c.name}
                  <span className="meta">{INTENSITY_LABEL[c.intensity]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="panel-actions">
          <ShareButton />
        </div>
      </div>
    </>
  );
}

const STATUS_ORDER: MembershipStatus[] = ['member', 'frozen', 'suspended', 'invited', 'observer', 'partner'];

function FigureTiles({ f, color }: { f: Figures; color?: string }) {
  const tiles = [
    { label: 'Population', value: formatCount(f.population), pct: share(f.population, WORLD.population), cov: f.coverage.population },
    { label: 'GDP', value: formatUsd(f.gdpUsd), pct: share(f.gdpUsd, WORLD.gdpUsd), cov: f.coverage.gdpUsd },
    { label: 'Military spend', value: formatUsd(f.militaryUsd), pct: share(f.militaryUsd, WORLD.militaryUsd), cov: f.coverage.militaryUsd },
  ];
  return (
    <div className="tiles" style={color ? { ['--tile-color' as string]: color } : undefined}>
      {tiles.map((t) => (
        <div className="tile" key={t.label}>
          <span className="label">{t.label}</span>
          <strong>{t.value}</strong>
          <span className="sub">
            {t.pct} of world{t.cov < f.members ? ` · ${t.cov}/${f.members} reporting` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function FiguresNote() {
  return (
    <div className="updated">
      Figures: <a href={WORLDBANK.source.url} target="_blank" rel="noopener noreferrer">World Bank</a>, latest available year per country, fetched {formatDate(WORLDBANK.fetchedAt)}. Full members only.
    </div>
  );
}

function BlocView({ bloc, props }: { bloc: Bloc; props: Props }) {
  const groups = STATUS_ORDER.map((status) => ({
    status,
    rows: bloc.members.filter((m) => m.status === status).sort((a, b) => countryName(a.iso).localeCompare(countryName(b.iso))),
  })).filter((g) => g.rows.length > 0);
  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">{CATEGORY_LABEL[bloc.category]} bloc</span>
          {bloc.name}
        </h2>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <div className="badges">
          <span className="badge" style={{ ['--badge-color' as string]: bloc.color }}>
            <span className="dot" /> {bloc.shortName}
          </span>
          <span className="badge muted">Founded {bloc.founded}</span>
          {bloc.headquarters && <span className="badge muted">{bloc.headquarters}</span>}
        </div>
        <p>{bloc.description}</p>
        <h4>At a glance · {blocFigures(bloc).members} members</h4>
        <FigureTiles f={blocFigures(bloc)} color={bloc.color} />
        <div className="panel-actions">
          <button className="text-btn primary" onClick={() => props.onHighlightBloc(bloc.id)}>
            Show on map
          </button>
          <ShareButton />
        </div>
        {groups.map((g) => (
          <div key={g.status}>
            <h4>
              {STATUS_LABEL[g.status]} · {g.rows.length}
            </h4>
            <ul className="link-list member-grid">
              {g.rows.map((m) => (
                <li key={m.iso}>
                  <button onClick={() => props.onSelectCountry(m.iso)} title={m.note}>
                    {countryName(m.iso)}
                    {m.note && <span className="meta" aria-hidden="true">ⓘ</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {bloc.changes.length > 0 && (
          <>
            <h4>Membership changes</h4>
            <ul className="history">
              {bloc.changes.map((ch) => (
                <li key={ch.date + ch.iso + ch.change}>
                  <span className="when">{formatDate(ch.date)}</span>
                  <span>
                    <button className="inline-link" onClick={() => props.onSelectCountry(ch.iso)}>
                      {countryName(ch.iso)}
                    </button>{' '}
                    <span className="label">{CHANGE_LABEL[ch.change]}</span>
                    {ch.note && <span className="note"> · {ch.note}</span>}
                    {ch.source && (
                      <>
                        {' '}
                        <a href={ch.source.url} target="_blank" rel="noopener noreferrer" className="src">
                          source ↗
                        </a>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <Sources sources={bloc.sources} />
        <div className="updated">Membership verified {formatMonth(bloc.updated)}.</div>
        <FiguresNote />
      </div>
    </>
  );
}

function HistoryList({ history, highlight, onSelectEntry }: { history: HistoryEntry[]; highlight: HistoryEntry | null; onSelectEntry?: (h: HistoryEntry) => void }) {
  return (
    <ol className="history">
      {history.map((h, i) => {
        const open = highlight ? h === highlight : i === 0;
        return (
          <li key={h.date + i} data-current={open}>
            <span className="when">
              <span className="dot" style={{ background: INTENSITY_COLOR[h.intensity] }} aria-hidden="true" />
              {formatDate(h.date)}
            </span>
            <details open={open} onToggle={onSelectEntry ? () => onSelectEntry(h) : undefined}>
              <summary>
                {INTENSITY_LABEL[h.intensity]}
                {h.confidence && <span className="label"> · {h.confidence} confidence</span>}
              </summary>
              <p>{h.status}</p>
              <p className="src-row">
                {h.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="src">
                    {s.name} ↗
                  </a>
                ))}
              </p>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

function ConflictView({ conflict, props }: { conflict: Conflict; props: Props }) {
  const shown = props.month ? entryAt(conflict, props.month) : conflict.history[0] ?? null;
  const replay = props.month !== null;
  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">{CONFLICT_TYPE_LABEL[conflict.type]}</span>
          {conflict.name}
        </h2>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <div className="badges">
          <span className="badge" style={{ ['--badge-color' as string]: INTENSITY_COLOR[(shown ?? conflict).intensity] }}>
            <span className="dot" /> {INTENSITY_LABEL[(shown ?? conflict).intensity]}
          </span>
          <span className="badge muted">Since {conflict.since}</span>
          {replay && props.month && <span className="badge muted">As of {formatMonth(props.month)}</span>}
        </div>
        <h4>Parties</h4>
        <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
          {conflict.parties.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h4>Background</h4>
        <p>{conflict.summary}</p>
        <h4>Assessments</h4>
        {replay && !shown && <p style={{ color: 'var(--fg-muted)' }}>No assessment on record for {props.month ? formatMonth(props.month) : ''}.</p>}
        <HistoryList history={conflict.history} highlight={shown} />
        <h4>Countries</h4>
        <div className="badges">
          {conflict.countries.map((iso) => (
            <button key={iso} className="badge" onClick={() => props.onSelectCountry(iso)} style={{ cursor: 'pointer' }}>
              {countryName(iso)}
            </button>
          ))}
        </div>
        <div className="panel-actions">
          <ShareButton />
        </div>
        <div className="updated">
          Latest assessment verified {formatDate(conflict.updated)}.
          {conflict.lastChecked && conflict.lastChecked > conflict.updated ? ` Re-checked ${formatDate(conflict.lastChecked)} with no material change.` : ''}
          {' '}Check the linked sources for developments since then.
        </div>
      </div>
    </>
  );
}

const WINDOWS = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All' },
];

function ChangesView({ props }: { props: Props }) {
  const [days, setDays] = useState(90);
  const items = useMemo(() => allChanges(CONFLICTS, BLOCS, countryName, (k) => CHANGE_LABEL[k]), []);
  const shown = days ? changesSince(items, days) : items;
  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">Data feed</span>
          Recent changes
        </h2>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <div className="segmented small" role="group" aria-label="Time window">
          {WINDOWS.map((w) => (
            <button key={w.days} aria-pressed={days === w.days} onClick={() => setDays(w.days)}>
              {w.label}
            </button>
          ))}
        </div>
        {shown.length === 0 && <p style={{ color: 'var(--fg-muted)', marginTop: 12 }}>No changes recorded in this window.</p>}
        <ol className="history feed">
          {shown.map((it, i) => (
            <li key={it.kind + it.id + it.date + i}>
              <span className="when">
                <span className="dot" style={{ background: it.intensity ? INTENSITY_COLOR[it.intensity] : it.color }} aria-hidden="true" />
                {formatDate(it.date)}
              </span>
              <span>
                <button className="inline-link" onClick={() => (it.kind === 'conflict' ? props.onSelectConflict(it.id) : props.onSelectBloc(it.id))}>
                  {it.title}
                </button>
                <span className="label"> · {it.kind === 'conflict' ? INTENSITY_LABEL[it.intensity!] : 'Membership'}</span>
                <span className="note"> {it.detail.length > 180 ? it.detail.slice(0, 177).trimEnd() + '…' : it.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="panel-actions">
          <ShareButton />
        </div>
      </div>
    </>
  );
}

function CompareView({ a, b, props }: { a: Bloc; b: Bloc; props: Props }) {
  const full = (x: Bloc) => x.members.filter((m) => m.status === 'member').map((m) => m.iso);
  const setA = new Set(full(a));
  const setB = new Set(full(b));
  const both = [...setA].filter((iso) => setB.has(iso)).sort((x, y) => countryName(x).localeCompare(countryName(y)));
  const onlyA = [...setA].filter((iso) => !setB.has(iso)).sort((x, y) => countryName(x).localeCompare(countryName(y)));
  const onlyB = [...setB].filter((iso) => !setA.has(iso)).sort((x, y) => countryName(x).localeCompare(countryName(y)));
  const list = (isos: string[]) =>
    isos.length ? (
      <ul className="link-list member-grid">
        {isos.map((iso) => (
          <li key={iso}>
            <button onClick={() => props.onSelectCountry(iso)}>{countryName(iso)}</button>
          </li>
        ))}
      </ul>
    ) : (
      <p style={{ color: 'var(--fg-muted)' }}>None</p>
    );
  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">Compare</span>
          {a.shortName} <span style={{ color: 'var(--fg-muted)' }}>vs</span> {b.shortName}
        </h2>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <div className="compare-grid">
          <div>
            <h4>
              <span className="dot" style={{ width: 8, height: 8, background: a.color }} /> {a.shortName}
            </h4>
            <FigureTiles f={blocFigures(a)} color={a.color} />
          </div>
          <div>
            <h4>
              <span className="dot" style={{ width: 8, height: 8, background: b.color }} /> {b.shortName}
            </h4>
            <FigureTiles f={blocFigures(b)} color={b.color} />
          </div>
        </div>
        <div className="panel-actions">
          <button className="text-btn" onClick={() => props.onSelectBloc(a.id)}>
            Open {a.shortName}
          </button>
          <button className="text-btn" onClick={() => props.onSelectBloc(b.id)}>
            Open {b.shortName}
          </button>
          <button className="text-btn" onClick={props.onStopCompare}>
            Stop comparing
          </button>
          <ShareButton />
        </div>
        <h4>In both · {both.length}</h4>
        {list(both)}
        <h4>
          {a.shortName} only · {onlyA.length}
        </h4>
        {list(onlyA)}
        <h4>
          {b.shortName} only · {onlyB.length}
        </h4>
        {list(onlyB)}
        <FiguresNote />
      </div>
    </>
  );
}

function AboutView({ props }: { props: Props }) {
  const newest = [...CONFLICTS.map((c) => c.updated), ...BLOCS.flatMap((b) => b.changes.map((c) => c.date))].sort().at(-1) ?? '';
  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">About</span>
          How ATLAS works
        </h2>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <p>
          ATLAS is an open geopolitics map: who belongs to which bloc, where armed conflicts are and how intense they are, and how many people they have displaced.
          It is built for orientation, not operations. Every claim links to a source, and every assessment carries the date it was verified.
        </p>
        <h4>Freshness</h4>
        <ul className="history">
          <li>
            <span className="when">{formatDate(newest)}</span>
            <span>Newest conflict assessment or bloc membership change</span>
          </li>
          <li>
            <span className="when">{formatDate(DISPLACEMENT.fetchedAt)}</span>
            <span>UNHCR displacement figures ({DISPLACEMENT.year} data)</span>
          </li>
          <li>
            <span className="when">{formatDate(WORLDBANK.fetchedAt)}</span>
            <span>World Bank population, GDP and military spending (latest year per country)</span>
          </li>
        </ul>
        <h4>How assessments are made</h4>
        <p>
          Each conflict has a dated history of assessments. A weekly automated pass searches the web for developments, drafts an update and proposes it in a pull request that a person reviews before it goes live. The pass is held to three rules: it may only cite pages that appeared in its own search results or that live on a short list of trusted trackers and wire services; it may not move intensity by more than one step at a time; and it must leave an entry alone when nothing material changed. Intensity is a judgement on a four-step scale: high means large-scale sustained combat, medium regular deadly fighting, low sporadic violence, latent a ceasefire or standoff.
        </p>
        <h4>Sources</h4>
        <p>
          Conflict trackers: CFR Global Conflict Tracker, ACLED, Crisis Group CrisisWatch, ISW. Memberships: the organisations' own sites. Displacement: UNHCR Refugee Data Finder, by country of origin. Figures: World Bank Open Data. Geometry: Natural Earth via world-atlas. Trusted hosts for automated citations: {TRUSTED_HOSTS.join(', ')}.
        </p>
        <h4>Caveats</h4>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Borders follow Natural Earth and imply no position on disputes. Kosovo uses the code UNK; Northern Cyprus and Somaliland are drawn as neutral territory.</li>
          <li>Conflict tinting uses the most intense conflict on a country's territory, including conflicts where it is an external party.</li>
          <li>Bloc figures count full members only and skip countries without a World Bank value; the tiles say when coverage is partial.</li>
          <li>Displacement figures are UNHCR mid-year or end-year stocks, not flows, and lag events by months.</li>
          <li>An assessment is a dated snapshot. Check the linked sources before relying on it.</li>
        </ul>
        <h4>Keyboard</h4>
        <p className="mono" style={{ fontSize: 12 }}>
          / search · arrows pan · + − zoom · 0 reset · Tab through conflict markers, Enter opens · Esc closes the tooltip
        </p>
        <div className="panel-actions">
          <ShareButton />
          <a className="text-btn" href="https://github.com/Skydog7169/ATLAS" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
            Source on GitHub
          </a>
        </div>
      </div>
    </>
  );
}

export default function DetailPanel(props: Props) {
  const { selection } = props;
  let body: React.ReactNode = null;
  if (selection.kind === 'country') {
    const c = COUNTRY_BY_ISO.get(selection.iso);
    body = c ? <CountryView country={c} props={props} /> : null;
  } else if (selection.kind === 'bloc') {
    const b = BLOC_BY_ID.get(selection.id);
    body = b ? <BlocView bloc={b} props={props} /> : null;
  } else if (selection.kind === 'changes') {
    body = <ChangesView props={props} />;
  } else if (selection.kind === 'about') {
    body = <AboutView props={props} />;
  } else if (selection.kind === 'compare') {
    body = props.compare ? <CompareView a={props.compare.a} b={props.compare.b} props={props} /> : null;
  } else {
    const c = CONFLICT_BY_ID.get(selection.id);
    body = c ? <ConflictView conflict={c} props={props} /> : null;
  }
  if (!body) return null;
  return (
    <section className="panel frame" aria-live="polite">
      {body}
    </section>
  );
}
