import { useMemo, useState } from 'react';
import { BLOCS, BLOC_BY_ID } from '../data/blocs';
import { CONFLICTS, CONFLICT_BY_ID } from '../data/conflicts';
import type { Bloc, Conflict, HistoryEntry, MembershipStatus } from '../data/types';
import { countryName } from '../lib/countries';
import { changesSince, entryAt, type ChangeItem } from '../lib/history';
import { CATEGORY_LABEL, CHANGE_LABEL, CONFLICT_TYPE_LABEL, INTENSITY_COLOR, INTENSITY_LABEL, STATUS_LABEL, formatDate, formatMonth } from '../lib/labels';
import type { Selection } from '../lib/urlState';
import { WORLD, WORLDBANK, blocFigures, formatCount, formatUsd, share, type Figures } from '../lib/worldbank';
import { DISPLACEMENT, formatPeople } from '../lib/displacement';
import { SANCTIONS } from '../lib/sanctions';
import { ELECTIONS_VERIFIED } from '../lib/elections';
import { NUCLEAR } from '../lib/nuclear';
import { TRUSTED_HOSTS } from '../data/guards';
import { CHANGES, watchlistOnly } from '../lib/feed';
import { countryDossier, profileLine, type CountryDossier } from '../lib/dossier';
import { useWatchlist } from '../hooks/useWatchlist';
import StarButton from './StarButton';
import ActorsGraph from './ActorsGraph';
import { PEACE_KIND_LABEL, backersOf, SUPPORT_LABEL } from '../lib/actors';
import { CHOKEPOINTS_FILE, CHOKEPOINT_BY_ID, CHOKEPOINT_COLOR, CHOKEPOINT_STATUS_LABEL, currentStatus, linkedConflicts, type Chokepoint } from '../lib/chokepoints';
import { MILITARY } from '../lib/military';
import { TRADE } from '../lib/trade';

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
  onOpenChanges: () => void;
  onSelectChokepoint: (id: string) => void;
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

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'var(--fg-muted)' }}>{children}</p>;
}

/** One feed entry: date, linked title, kind tag and clipped detail. Shared by the changes feed and the dossier. */
function FeedList({ items, props, compact }: { items: ChangeItem[]; props: Props; compact?: boolean }) {
  const max = compact ? 140 : 180;
  return (
    <ol className="history feed">
      {items.map((it, i) => (
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
            <span className="note"> {it.detail.length > max ? it.detail.slice(0, max - 3).trimEnd() + '…' : it.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function yearNote(year: number | null) {
  return year ? String(year) : '';
}

function CountryView({ dossier, props }: { dossier: CountryDossier; props: Props }) {
  const { country, memberships, conflicts, displacement, figures, changes, extras } = dossier;
  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">Country dossier · {country.subregion ?? country.region}</span>
          {country.name}
        </h2>
        <StarButton item={{ kind: 'country', id: country.cca3 }} name={country.name} />
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body dossier" data-sections={dossier.sections.join(' ')}>
        <Muted>{profileLine(country)}</Muted>
        <div className="badges">
          <span className="badge muted">{country.cca3}</span>
          <span className="badge muted">{country.region}</span>
          {conflicts.length > 0 && (
            <span className="badge" style={{ ['--badge-color' as string]: INTENSITY_COLOR[conflicts[0]!.intensity] }}>
              <span className="dot" /> {INTENSITY_LABEL[conflicts[0]!.intensity]}
            </span>
          )}
        </div>

        <h4 id="dossier-memberships">Bloc memberships · {memberships.filter((m) => m.membership.status === 'member').length}</h4>
        {memberships.length === 0 ? (
          <Muted>Not a member of any bloc tracked here.</Muted>
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

        <h4 id="dossier-conflicts">Conflicts · {conflicts.length}</h4>
        {conflicts.length === 0 ? (
          <Muted>No tracked conflict on this territory.</Muted>
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

        {extras.map((x) => (
          <div key={x.id}>
            <h4 id={`dossier-${x.id}`}>{x.title}</h4>
            {x.rows.length === 0 ? (
              <Muted>{x.empty ?? 'None recorded.'}</Muted>
            ) : (
              <ul className="link-list">
                {x.rows.map((r, i) => (
                  <li key={r.label + i}>
                    {r.conflictId ? (
                      <button onClick={() => props.onSelectConflict(r.conflictId!)}>
                        <span>
                          {r.label}
                          {r.note && <span className="row-note">{r.note}</span>}
                        </span>
                        <span className="meta">{r.value}</span>
                      </button>
                    ) : r.href ? (
                      <a href={r.href} target="_blank" rel="noopener noreferrer" title={r.note}>
                        <span>
                          {r.label}
                          {r.note && <span className="row-note">{r.note}</span>}
                        </span>
                        <span className="meta">{r.value ? `${r.value} ↗` : '↗'}</span>
                      </a>
                    ) : (
                      <span className="row">
                        <span>
                          {r.label}
                          {r.note && <span className="row-note">{r.note}</span>}
                        </span>
                        <span className="meta">{r.value}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {x.footnote && <div className="updated">{x.footnote}</div>}
          </div>
        ))}

        <h4 id="dossier-displacement">Displacement</h4>
        {displacement && displacement.total > 0 ? (
          <div className="tiles" style={{ ['--tile-color' as string]: '#a35be6' }}>
            <div className="tile">
              <span className="label">Displaced</span>
              <strong>{formatPeople(displacement.total)}</strong>
              <span className="sub">from {country.name}</span>
            </div>
            <div className="tile">
              <span className="label">Refugees</span>
              <strong>{formatPeople(displacement.refugees)}</strong>
              <span className="sub">{formatPeople(displacement.asylumSeekers)} asylum seekers</span>
            </div>
            <div className="tile">
              <span className="label">IDPs</span>
              <strong>{formatPeople(displacement.idps)}</strong>
              <span className="sub">{displacement.oip > 0 ? `${formatPeople(displacement.oip)} others in need` : 'internally displaced'}</span>
            </div>
          </div>
        ) : (
          <Muted>No UNHCR displacement figure for people from {country.name}.</Muted>
        )}

        <h4 id="dossier-figures">Figures</h4>
        {figures && (figures.population !== null || figures.gdpUsd !== null || figures.militaryUsd !== null) ? (
          <div className="tiles">
            <div className="tile">
              <span className="label">Population</span>
              <strong>{figures.population !== null ? formatCount(figures.population) : '—'}</strong>
              <span className="sub">{figures.population !== null ? `${share(figures.population, WORLD.population)} of world · ${yearNote(figures.populationYear)}` : 'not reported'}</span>
            </div>
            <div className="tile">
              <span className="label">GDP</span>
              <strong>{figures.gdpUsd !== null ? formatUsd(figures.gdpUsd) : '—'}</strong>
              <span className="sub">{figures.gdpUsd !== null ? `${share(figures.gdpUsd, WORLD.gdpUsd)} of world · ${yearNote(figures.gdpYear)}` : 'not reported'}</span>
            </div>
            <div className="tile">
              <span className="label">Military spend</span>
              <strong>{figures.militaryUsd !== null ? formatUsd(figures.militaryUsd) : '—'}</strong>
              <span className="sub">{figures.militaryUsd !== null ? `${share(figures.militaryUsd, WORLD.militaryUsd)} of world · ${yearNote(figures.militaryYear)}` : 'not reported'}</span>
            </div>
          </div>
        ) : (
          <Muted>No World Bank figures for {country.name}.</Muted>
        )}

        <h4 id="dossier-changes">Recent changes · {changes.length}</h4>
        {changes.length === 0 ? <Muted>No dated assessment or membership change on record for {country.name}.</Muted> : <FeedList items={changes} props={props} compact />}

        <div className="panel-actions">
          <ShareButton />
        </div>
        <div className="updated">
          Displacement: <a href={DISPLACEMENT.source.url} target="_blank" rel="noopener noreferrer">UNHCR</a> {DISPLACEMENT.year}, fetched {formatDate(DISPLACEMENT.fetchedAt)}. Figures: <a href={WORLDBANK.source.url} target="_blank" rel="noopener noreferrer">World Bank</a>, latest year per country, fetched {formatDate(WORLDBANK.fetchedAt)}.
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
        <StarButton item={{ kind: 'bloc', id: bloc.id }} name={bloc.shortName} />
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
        <StarButton item={{ kind: 'conflict', id: conflict.id }} name={conflict.name} />
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
        {conflict.actors && conflict.actors.length > 0 && (
          <>
            <h4 id="conflict-actors">Who backs whom</h4>
            <ActorsGraph conflict={conflict} onSelectCountry={props.onSelectCountry} />
            {backersOf(conflict).length > 0 && (
              <div className="badges">
                {backersOf(conflict).map((b) => (
                  <button key={b.iso} className="badge" style={{ cursor: 'pointer' }} onClick={() => props.onSelectCountry(b.iso)} title={`${b.support.map((k) => SUPPORT_LABEL[k]).join(', ')} for ${b.actors.join(', ')}`}>
                    {b.name}
                    <span className="meta">{b.support.map((k) => SUPPORT_LABEL[k].toLowerCase()).join(', ')}</span>
                  </button>
                ))}
              </div>
            )}
            {conflict.actorsSources && (
              <p className="src-row">
                {conflict.actorsSources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="src">
                    {s.name} ↗
                  </a>
                ))}
                {conflict.actorsUpdated && <span className="src" style={{ color: 'var(--fg-faint)' }}>reviewed {formatMonth(conflict.actorsUpdated)}</span>}
              </p>
            )}
          </>
        )}
        <h4 id="conflict-peace">Peace process · {conflict.peace?.length ?? 0}</h4>
        {!conflict.peace?.length ? (
          <p style={{ color: 'var(--fg-muted)' }}>No negotiation track on record.</p>
        ) : (
          <ol className="history peace">
            {conflict.peace.map((e, i) => (
              <li key={e.date + i} data-kind={e.kind}>
                <span className="when">
                  <span className="dot" aria-hidden="true" />
                  {formatDate(e.date)}
                </span>
                <span>
                  <span className="label">{PEACE_KIND_LABEL[e.kind]}</span>
                  <span className="note"> {e.summary}</span>
                  <span className="src-row" style={{ marginTop: 2 }}>
                    {e.sources.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="src">
                        {s.name} ↗
                      </a>
                    ))}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
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
  const { only, keys, items: starred, setOnly } = useWatchlist();
  const shown = useMemo(() => {
    const pool = only ? watchlistOnly(CHANGES, keys) : [...CHANGES];
    return days ? changesSince(pool, days) : pool;
  }, [days, only, keys]);
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
        <div className="filter-row">
          <div className="segmented small" role="group" aria-label="Time window">
            {WINDOWS.map((w) => (
              <button key={w.days} aria-pressed={days === w.days} onClick={() => setDays(w.days)}>
                {w.label}
              </button>
            ))}
          </div>
          <button className={'text-btn watch-toggle' + (only ? ' on' : '')} aria-pressed={only} onClick={() => setOnly(!only)}>
            ★ Watchlist{starred.length ? ` · ${starred.length}` : ''}
          </button>
        </div>
        {shown.length === 0 && (
          <p style={{ color: 'var(--fg-muted)', marginTop: 12 }}>
            {only && starred.length === 0 ? 'Your watchlist is empty. Star a country, bloc or conflict from its panel.' : only ? 'No changes for your watchlist in this window.' : 'No changes recorded in this window.'}
          </p>
        )}
        <FeedList items={shown} props={props} />
        <div className="panel-actions">
          <ShareButton />
        </div>
      </div>
    </>
  );
}

function WatchlistView({ props }: { props: Props }) {
  const { items, toggle } = useWatchlist();
  const groups = [
    { kind: 'country' as const, title: 'Countries', name: (id: string) => countryName(id), open: props.onSelectCountry },
    { kind: 'bloc' as const, title: 'Blocs', name: (id: string) => BLOC_BY_ID.get(id)?.shortName ?? id, open: props.onSelectBloc },
    { kind: 'conflict' as const, title: 'Conflicts', name: (id: string) => CONFLICT_BY_ID.get(id)?.name ?? id, open: props.onSelectConflict },
  ].map((g) => ({ ...g, rows: items.filter((it) => it.kind === g.kind) }));
  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">Saved on this device</span>
          Watchlist
        </h2>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        {items.length === 0 ? (
          <Muted>Nothing starred yet. Open any country, bloc or conflict and press the star to follow it. The ticker and the changes feed can then be filtered to what you follow.</Muted>
        ) : (
          <Muted>Stars are kept in this browser only. Use the ★ Watchlist toggle on the ticker or the changes feed to see only these.</Muted>
        )}
        {groups
          .filter((g) => g.rows.length > 0)
          .map((g) => (
            <div key={g.kind}>
              <h4>
                {g.title} · {g.rows.length}
              </h4>
              <ul className="link-list">
                {g.rows.map((it) => (
                  <li key={it.id} className="watch-row">
                    <button onClick={() => g.open(it.id)}>
                      {g.kind === 'conflict' && <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: INTENSITY_COLOR[CONFLICT_BY_ID.get(it.id)?.intensity ?? 'latent'] }} />}
                      {g.kind === 'bloc' && <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: BLOC_BY_ID.get(it.id)?.color }} />}
                      {g.name(it.id)}
                    </button>
                    <button className="icon-btn star small" aria-pressed="true" aria-label={`Remove ${g.name(it.id)} from watchlist`} onClick={() => toggle(it)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                        <path d="m12 3 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8L12 3Z" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        <div className="panel-actions">
          <button className="text-btn" onClick={() => props.onOpenChanges()}>
            Open changes feed
          </button>
        </div>
      </div>
    </>
  );
}

function ChokepointView({ cp, props }: { cp: Chokepoint; props: Props }) {
  const now = currentStatus(cp);
  const conflicts = linkedConflicts(cp);
  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">Maritime chokepoint</span>
          {cp.name}
        </h2>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <div className="badges">
          <span className="badge" style={{ ['--badge-color' as string]: CHOKEPOINT_COLOR[now.status] }}>
            <span className="dot" /> {CHOKEPOINT_STATUS_LABEL[now.status]}
          </span>
          <span className="badge muted">As of {formatDate(now.date)}</span>
        </div>
        <Muted>{cp.between}</Muted>
        <h4>What passes through</h4>
        <p>{cp.carries}</p>
        <h4 id="chokepoint-status">Status</h4>
        <ol className="history peace">
          {cp.history.map((e, i) => (
            <li key={e.date + i} data-current={i === 0}>
              <span className="when">
                <span className="dot" style={{ background: CHOKEPOINT_COLOR[e.status] }} aria-hidden="true" />
                {formatDate(e.date)}
              </span>
              <span>
                <span className="label">{CHOKEPOINT_STATUS_LABEL[e.status]}</span>
                <span className="note"> {e.summary}</span>
                <span className="src-row" style={{ marginTop: 2 }}>
                  {e.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="src">
                      {s.name} ↗
                    </a>
                  ))}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <h4 id="chokepoint-conflicts">Linked conflicts · {conflicts.length}</h4>
        {conflicts.length === 0 ? (
          <Muted>No tracked conflict bears on this passage.</Muted>
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
        <h4>Other chokepoints</h4>
        <div className="badges">
          {CHOKEPOINTS_FILE.chokepoints
            .filter((x) => x.id !== cp.id)
            .map((x) => (
              <button key={x.id} className="badge" style={{ cursor: 'pointer', ['--badge-color' as string]: CHOKEPOINT_COLOR[currentStatus(CHOKEPOINT_BY_ID.get(x.id)!).status] }} onClick={() => props.onSelectChokepoint(x.id)}>
                <span className="dot" /> {x.name}
              </button>
            ))}
        </div>
        <div className="panel-actions">
          <ShareButton />
        </div>
        <div className="updated">Curated; verified {formatDate(CHOKEPOINTS_FILE.verified)}. Sources: {CHOKEPOINTS_FILE.sources.map((s) => s.name).join('; ')}.</div>
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
          <li>
            <span className="when">{formatDate(SANCTIONS.fetchedAt)}</span>
            <span>Sanctions regimes from OFAC, the EU Sanctions Map and the UN Security Council</span>
          </li>
          <li>
            <span className="when">{formatDate(ELECTIONS_VERIFIED)}</span>
            <span>Next national elections (newest verification)</span>
          </li>
          <li>
            <span className="when">{formatDate(NUCLEAR.verified)}</span>
            <span>Nuclear status, curated</span>
          </li>
          <li>
            <span className="when">{formatDate(CHOKEPOINTS_FILE.verified)}</span>
            <span>Chokepoint status and foreign military presence, curated (presence verified {formatDate(MILITARY.verified)})</span>
          </li>
          <li>
            <span className="when">{formatDate(TRADE.fetchedAt)}</span>
            <span>Export shares to the US, China and the EU (World Bank WITS, newest year per country)</span>
          </li>
        </ul>
        <h4>How assessments are made</h4>
        <p>
          Each conflict has a dated history of assessments. A weekly automated pass searches the web for developments, drafts an update and proposes it in a pull request that a person reviews before it goes live. The pass is held to three rules: it may only cite pages that appeared in its own search results or that live on a short list of trusted trackers and wire services; it may not move intensity by more than one step at a time; and it must leave an entry alone when nothing material changed. Intensity is a judgement on a four-step scale: high means large-scale sustained combat, medium regular deadly fighting, low sporadic violence, latent a ceasefire or standoff.
        </p>
        <h4>Sources</h4>
        <p>
          Conflict trackers: CFR Global Conflict Tracker, ACLED, Crisis Group CrisisWatch, ISW. Memberships: the organisations' own sites. Displacement: UNHCR Refugee Data Finder, by country of origin. Figures: World Bank Open Data. Sanctions: OFAC's programme index, the EU Sanctions Map and UN Security Council committees (country-level regimes only). Elections: seeded from Wikipedia's list of next general elections and IFES ElectionGuide, then re-checked weekly by the research pass. Nuclear status: SIPRI, the Arms Control Association and NATO, curated by hand. Geometry: Natural Earth via world-atlas. Trusted hosts for automated citations: {TRUSTED_HOSTS.join(', ')}.
        </p>
        <h4>Caveats</h4>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Borders follow Natural Earth and imply no position on disputes. Kosovo uses the code UNK; Northern Cyprus and Somaliland are drawn as neutral territory.</li>
          <li>Conflict tinting uses the most intense conflict on a country's territory, including conflicts where it is an external party.</li>
          <li>Bloc figures count full members only and skip countries without a World Bank value; the tiles say when coverage is partial.</li>
          <li>Displacement figures are UNHCR mid-year or end-year stocks, not flows, and lag events by months.</li>
          <li>An assessment is a dated snapshot. Check the linked sources before relying on it.</li>
        </ul>
        <h4>Following things</h4>
        <p>
          Every country has a dossier (memberships, conflicts, displacement, figures and its recent changes) at a link you can share. The strip along the bottom cycles the ten newest dated changes and pauses while you hover it. Press the star on any panel to add it to a watchlist kept in this browser; the ticker and the changes feed can be filtered to it. A strip under the header lists what changed since you last pressed "Mark read". The same changes are available as <a href="/feed.xml">RSS</a> and <a href="/feed.json">JSON Feed</a>.
        </p>
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
    const d = countryDossier(selection.iso);
    body = d ? <CountryView dossier={d} props={props} /> : null;
  } else if (selection.kind === 'bloc') {
    const b = BLOC_BY_ID.get(selection.id);
    body = b ? <BlocView bloc={b} props={props} /> : null;
  } else if (selection.kind === 'changes') {
    body = <ChangesView props={props} />;
  } else if (selection.kind === 'about') {
    body = <AboutView props={props} />;
  } else if (selection.kind === 'watchlist') {
    body = <WatchlistView props={props} />;
  } else if (selection.kind === 'chokepoint') {
    const cp = CHOKEPOINT_BY_ID.get(selection.id);
    body = cp ? <ChokepointView cp={cp} props={props} /> : null;
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
