import { useMemo, useRef, useState } from 'react';
import { BLOCS, BLOC_BY_ID } from '../data/blocs';
import { CONFLICTS, CONFLICT_BY_ID } from '../data/conflicts';
import { UNREST_BY_ID } from '../data/unrest';
import { UNREST_COLOR, UNREST_KIND_LABEL } from '../lib/unrest';
import type { Bloc, Conflict, HistoryEntry, Intensity, MembershipStatus, Unrest } from '../data/types';
import { countryName } from '../lib/countries';
import { changesSince, entryAt, type ChangeItem } from '../lib/history';
import { deltaTag, deltaWord, groupChanges, itemColor, kindTag, shortDay } from '../lib/delta';
import { CATEGORY_LABEL, CHANGE_LABEL, CONFLICT_TYPE_LABEL, INTENSITY_COLOR, INTENSITY_LABEL, STATUS_LABEL, STATUS_LABEL_PLURAL, formatDate, formatMonth } from '../lib/labels';
import type { Layer, Selection } from '../lib/urlState';
import type { WatchItem } from '../lib/watchlist';
import { layerSummary } from '../lib/layerSummary';
import { useSheet } from '../hooks/useSheet';
import { STALE_YEARS, WORLD, WORLDBANK, blocFigures, formatCount, formatUsd, share, staleValues, type Figures } from '../lib/worldbank';
import { blocMembers } from '../lib/membership';
import { DISPLACEMENT, REPORTED_WITH, displacementTotal, formatPeople } from '../lib/displacement';
import { SANCTIONS } from '../lib/sanctions';
import { ELECTIONS_VERIFIED } from '../lib/elections';
import { NUCLEAR } from '../lib/nuclear';
import { TRUSTED_HOSTS } from '../data/guards';
import { CHANGES, changesForWatchItem, watchItemResolves, watchlistOnly } from '../lib/feed';
import { useSeen } from '../hooks/useSeen';
import { conflictBadges, countryDossier, notMemberOf, profileLine, type CountryDossier } from '../lib/dossier';
import { isTheatre } from '../lib/theatre';
import { territoryLine } from '../lib/sovereign';
import { useWatchlist } from '../hooks/useWatchlist';
import StarButton from './StarButton';
import ActorsGraph from './ActorsGraph';
import { DataRowBody } from './DataRow';
import { PEACE_KIND_LABEL, backersOf, SUPPORT_LABEL } from '../lib/actors';
import { CHOKEPOINTS_FILE, CHOKEPOINT_BY_ID, CHOKEPOINT_COLOR, CHOKEPOINT_STATUS_LABEL, currentStatus, linkedConflicts, type Chokepoint } from '../lib/chokepoints';
import { MILITARY, PRESENCE_KIND_LABEL, operatorName } from '../lib/military';
import { TRADE, pct } from '../lib/trade';
import { relationship, relationshipSummary } from '../lib/relationship';
import { blocTrend, lastChange, trendComplete } from '../lib/trends';
import { WB_HISTORY } from '../lib/worldbankHistory';
import { search } from '../lib/search';
import { useEmbed } from '../lib/embedContext';
import { replayBadge } from '../lib/timeline';
import TrendChart from './TrendChart';
import AskPanel, { ASK_ENABLED } from './AskPanel';
import SectionNav from './SectionNav';
import { usePanelFocus } from '../hooks/usePanelFocus';
import { selectionKey } from '../lib/navHistory';

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
  onSelectPair: (a: string, b: string | null) => void;
  onSelectUnrest: (id: string) => void;
  /** Active data layer: the dossier leads with the country's value on it (touch has no hover tooltip). */
  layer?: Layer;
  /** The panel this one was reached from, for the "‹ Ukraine" chip; it steps history back. */
  backTo?: { label: string; onBack: () => void } | null;
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

/** Copies the full-app link (never the chrome-less embed URL); offers the embed snippet next to it. */
function ShareButton() {
  const { shareUrl, onEmbed } = useEmbed();
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  return (
    <>
      <button
        className="text-btn"
        onClick={async () => {
          const url = shareUrl();
          try {
            await navigator.clipboard.writeText(url);
            setFallback(null);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard blocked (common in third-party frames): show the link to copy by hand.
            setFallback(url);
          }
        }}
      >
        {copied ? 'Link copied' : 'Copy link'}
      </button>
      {onEmbed && (
        <button className="text-btn" onClick={onEmbed}>
          Embed
        </button>
      )}
      {fallback && <input className="share-fallback" readOnly value={fallback} aria-label="Link to this view" autoFocus onFocus={(e) => e.currentTarget.select()} />}
    </>
  );
}

function Sources({ sources }: { sources: Array<{ name: string; url: string }> }) {
  return (
    <>
      <h3>Sources</h3>
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

function FeedRows({ items, props, unseen }: { items: ChangeItem[]; props: Props; unseen?: ReadonlySet<string> }) {
  return (
    <ol className="history feed">
      {items.map((it) => {
        const delta = deltaTag(it);
        return (
          <li key={it.key} data-delta={it.delta} data-unseen={unseen?.has(it.key) || undefined}>
            <span className="when">{formatDate(it.date)}</span>
            <span className="feed-body">
              <button className="inline-link feed-title" onClick={() => (it.kind === 'conflict' ? props.onSelectConflict(it.id) : it.kind === 'unrest' ? props.onSelectUnrest(it.id) : props.onSelectBloc(it.id))}>
                {it.title}
              </button>
              <span className="feed-tags">
                <span className="feed-kind" data-kind={it.kind}>
                  <span className={'dot' + (it.kind === 'unrest' ? ' triangle' : '')} style={{ background: itemColor(it) }} aria-hidden="true" />
                  {kindTag(it)}
                </span>
                {delta && (
                  <span className="feed-delta" data-delta={it.delta}>
                    {delta}
                  </span>
                )}
              </span>
              <span className="note feed-detail">{it.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Feed entries: date, linked title, a kind/level pill with the worded change
 * ('▲ Escalated · low → medium'), and the detail clamped to three lines.
 * Same-level re-assessments are folded under one line unless `collapseSame` is off.
 */
function FeedList({ items, props, collapseSame = true, unseen }: { items: ChangeItem[]; props: Props; collapseSame?: boolean; unseen?: ReadonlySet<string> }) {
  const signals = collapseSame ? items.filter((it) => it.delta !== 'same') : items;
  const same = collapseSame ? items.filter((it) => it.delta === 'same') : [];
  return (
    <>
      {signals.length > 0 && <FeedRows items={signals} props={props} unseen={unseen} />}
      {same.length > 0 && (
        <details className="feed-same">
          <summary>
            {same.length} re-assessment{same.length === 1 ? '' : 's'}, no change
          </summary>
          <FeedRows items={same} props={props} unseen={unseen} />
        </details>
      )}
    </>
  );
}

function RssLink() {
  return (
    <a className="text-btn" href="/feed.xml" type="application/rss+xml" title="Subscribe to every change via RSS (JSON Feed at /feed.json)">
      RSS
    </a>
  );
}

/** A dossier figure's year, styled as a warning when the value is more than five years old. */
function yearNote(year: number | null) {
  if (!year) return null;
  const old = new Date().getFullYear() - year > 5;
  return old ? (
    <span className="stale" title={`Latest World Bank value is from ${year}`}>
      {year}
    </span>
  ) : (
    String(year)
  );
}

function CountryView({ dossier, props }: { dossier: CountryDossier; props: Props }) {
  const { country, memberships, conflicts, displacement, figures, changes, extras } = dossier;
  return (
    <>
      <div className="panel-head">
        <div className="panel-title">
          <p className="eyebrow">Country dossier · {country.subregion ?? country.region}</p>
          <h2>
            {country.name}
          </h2>
        </div>
        <StarButton item={{ kind: 'country', id: country.cca3 }} name={country.name} />
        <CloseButton onClick={props.onClose} />
      </div>
      <SectionNav
        label="Dossier sections"
        items={[
          { id: 'dossier-memberships', label: `Memberships ${memberships.filter((m) => m.membership.status === 'member').length}` },
          { id: 'dossier-conflicts', label: `Conflicts ${conflicts.length}` },
          ...extras.map((x) => ({ id: `dossier-${x.id}`, label: x.title })),
          { id: 'dossier-displacement', label: 'Displacement' },
          { id: 'dossier-figures', label: 'Figures' },
          { id: 'dossier-changes', label: `Changes ${changes.length}` },
        ]}
      />
      <div className="panel-body dossier" data-sections={dossier.sections.join(' ')}>
        <Muted>{profileLine(country)}</Muted>
        <LayerReadout layer={props.layer ?? null} iso={country.cca3} />
        {territoryLine(country.cca3, BLOCS) && <Muted>{territoryLine(country.cca3, BLOCS)}</Muted>}
        <div className="badges">
          <span className="badge muted">{country.cca3}</span>
          <span className="badge muted">{country.region}</span>
          {conflictBadges(country.cca3, conflicts).map((b) => (
            <span key={b.label} className="badge" style={{ ['--badge-color' as string]: INTENSITY_COLOR[b.intensity] }}>
              <span className="dot" /> {b.label}: {INTENSITY_LABEL[b.intensity]}
            </span>
          ))}
        </div>

        <h3 id="dossier-memberships">Bloc memberships · {memberships.filter((m) => m.membership.status === 'member').length}</h3>
        {memberships.length === 0 ? (
          <Muted>No membership, candidacy or partnership in any bloc tracked here.</Muted>
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
        {notMemberOf(country.cca3).length > 0 && <Muted>Not a member of: {notMemberOf(country.cca3).join(', ')}</Muted>}

        <h3 id="dossier-conflicts">Conflicts · {conflicts.length}</h3>
        {conflicts.length === 0 ? (
          <Muted>No tracked conflict on this territory.</Muted>
        ) : (
          <ul className="link-list">
            {conflicts.map((c) => (
              <li key={c.id}>
                <button onClick={() => props.onSelectConflict(c.id)}>
                  <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: INTENSITY_COLOR[c.intensity] }} />
                  {c.name}
                  <span className="meta">{isTheatre(c, country.cca3) ? INTENSITY_LABEL[c.intensity] : `${INTENSITY_LABEL[c.intensity]} · abroad`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {extras.map((x) => (
          <div key={x.id}>
            <h3 id={`dossier-${x.id}`}>{x.title}</h3>
            {x.rows.length === 0 ? (
              <Muted>{x.empty ?? 'None recorded.'}</Muted>
            ) : (
              <ul className="link-list">
                {x.rows.map((r, i) => (
                  <li key={r.label + i}>
                    {r.conflictId || r.unrestId ? (
                      <button className="data-row" onClick={() => (r.conflictId ? props.onSelectConflict(r.conflictId) : props.onSelectUnrest(r.unrestId!))}>
                        <DataRowBody {...r} />
                      </button>
                    ) : r.href ? (
                      <a className="data-row" href={r.href} target="_blank" rel="noopener noreferrer" title={r.note}>
                        <DataRowBody {...r} value={r.value} suffix="↗" />
                      </a>
                    ) : (
                      <span className="row data-row">
                        <DataRowBody {...r} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {x.secondary && (
              <>
                <h4 className="sub-head">{x.secondary.title}</h4>
                <ul className="link-list">
                  {x.secondary.rows.map((r, i) => (
                    <li key={r.label + i}>
                      <a className="data-row" href={r.href} target="_blank" rel="noopener noreferrer" title={r.note}>
                        <DataRowBody {...r} suffix="↗" />
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {x.footnote && <div className="updated">{x.footnote}</div>}
          </div>
        ))}

        <h3 id="dossier-displacement">Displacement</h3>
        {REPORTED_WITH[country.cca3] ? (
          <Muted>
            {REPORTED_WITH[country.cca3]!.note}{' '}
            <button className="inline-link" onClick={() => props.onSelectCountry(REPORTED_WITH[country.cca3]!.iso)}>
              See {countryName(REPORTED_WITH[country.cca3]!.iso)}
            </button>
            .
          </Muted>
        ) : displacement && displacementTotal(displacement) > 0 ? (
          <div className="tiles" style={{ ['--tile-color' as string]: '#a35be6' }}>
            <div className="tile">
              <span className="label">Displaced</span>
              <strong>{formatPeople(displacementTotal(displacement))}</strong>
              <span className="sub">{displacement.supplement ? `UNHCR alone: ${formatPeople(displacement.total)}` : `from ${country.name}`}</span>
            </div>
            <div className="tile">
              <span className="label">Refugees</span>
              <strong>{formatPeople(displacement.refugees + (displacement.supplement?.unrwaRefugees ?? 0))}</strong>
              <span className="sub">
                {displacement.supplement ? `${formatPeople(displacement.supplement.unrwaRefugees)} UNRWA-registered · ` : ''}plus {formatPeople(displacement.asylumSeekers)} asylum seekers
              </span>
            </div>
            <div className="tile">
              <span className="label">IDPs</span>
              <strong>{displacement.supplement?.idps ? formatPeople(displacement.supplement.idps) : displacement.idps > 0 ? formatPeople(displacement.idps) : '—'}</strong>
              <span className="sub">{displacement.supplement?.idps ? `IDMC estimate, ${displacement.supplement.year}` : displacement.idps === 0 ? 'not reported by UNHCR' : displacement.oip > 0 ? `${formatPeople(displacement.oip)} others in need` : 'internally displaced'}</span>
            </div>
          </div>
        ) : (
          <Muted>No UNHCR displacement figure for people from {country.name}.</Muted>
        )}
        {displacement?.supplement && (
          <div className="updated">
            UNHCR's figures exclude Palestine refugees under UNRWA's mandate and carry no Gaza IDP figure; the totals add{' '}
            {displacement.supplement.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 ? ' and ' : ''}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.name.split(' (')[0]}
                </a>
              </span>
            ))}{' '}
            figures ({displacement.supplement.year}). IDPs are not added to the total because many are themselves registered refugees.
          </div>
        )}

        <h3 id="dossier-figures">Figures</h3>
        {figures && (figures.population !== null || figures.gdpUsd !== null || figures.militaryUsd !== null) ? (
          <div className="tiles">
            <div className="tile">
              <span className="label">Population</span>
              <strong>{figures.population !== null ? formatCount(figures.population) : '—'}</strong>
              <span className="sub">{figures.population !== null ? <>{share(figures.population, WORLD.population)} of world · {yearNote(figures.populationYear)}</> : 'not reported'}</span>
            </div>
            <div className="tile">
              <span className="label">GDP</span>
              <strong>{figures.gdpUsd !== null ? formatUsd(figures.gdpUsd) : '—'}</strong>
              <span className="sub">{figures.gdpUsd !== null ? <>{share(figures.gdpUsd, WORLD.gdpUsd)} of world · {yearNote(figures.gdpYear)}</> : 'not reported'}</span>
            </div>
            <div className="tile">
              <span className="label">Military spend</span>
              <strong>{figures.militaryUsd !== null ? formatUsd(figures.militaryUsd) : '—'}</strong>
              <span className="sub">{figures.militaryUsd !== null ? <>{share(figures.militaryUsd, WORLD.militaryUsd)} of world · {yearNote(figures.militaryYear)}</> : 'not reported'}</span>
            </div>
          </div>
        ) : (
          <Muted>No World Bank figures for {country.name}.</Muted>
        )}

        <h3 id="dossier-changes">Recent changes · {changes.length}</h3>
        {changes.length === 0 ? <Muted>No dated assessment or membership change on record for {country.name}.</Muted> : <FeedList items={changes} props={props} />}

        <div className="panel-actions">
          <button className="text-btn primary" onClick={() => props.onSelectPair(country.cca3, null)}>
            Relationship with…
          </button>
          <ShareButton />
        </div>
        <div className="updated">
          Displacement: <a href={DISPLACEMENT.source.url} target="_blank" rel="noopener noreferrer">UNHCR</a> {DISPLACEMENT.year}, fetched {formatDate(DISPLACEMENT.fetchedAt)}. Figures: <a href={WORLDBANK.source.url} target="_blank" rel="noopener noreferrer">World Bank</a>, latest year per country, fetched {formatDate(WORLDBANK.fetchedAt)}.
        </div>
      </div>
    </>
  );
}

const STATUS_ORDER: MembershipStatus[] = ['member', 'frozen', 'suspended', 'invited', 'candidate', 'observer', 'partner'];

function FigureTiles({ f, color }: { f: Figures; color?: string }) {
  const tiles = [
    { label: 'Population', metric: 'population' as const, value: formatCount(f.population), pct: share(f.population, WORLD.population), cov: f.coverage.population },
    { label: 'GDP', metric: 'gdpUsd' as const, value: formatUsd(f.gdpUsd), pct: share(f.gdpUsd, WORLD.gdpUsd), cov: f.coverage.gdpUsd },
    { label: 'Military spend', metric: 'militaryUsd' as const, value: formatUsd(f.militaryUsd), pct: share(f.militaryUsd, WORLD.militaryUsd), cov: f.coverage.militaryUsd },
  ];
  return (
    <div className="tiles" style={color ? { ['--tile-color' as string]: color } : undefined}>
      {tiles.map((t) => {
        const older = f.older[t.metric];
        const stale = staleValues(f, t.metric);
        const title = older.length ? older.map((v) => `${countryName(v.iso)}: ${v.year}`).join(', ') : undefined;
        return (
          <div className="tile" key={t.label}>
            <span className="label">{t.label}</span>
            <strong>{t.value}</strong>
            <span className="sub" title={title}>
              {t.pct} of world{t.cov < f.members ? ` · ${t.cov}/${f.members} reporting` : ''}
              {f.newest[t.metric] !== null && (stale.length ? (
                <span className="stale"> · {stale.length} value{stale.length === 1 ? '' : 's'} from {stale[0]!.year}</span>
              ) : older.length ? (
                ` · ${f.newest[t.metric]}, ${older.length} member${older.length === 1 ? '' : 's'} ${[...new Set(older.map((v) => v.year))].join('/')}`
              ) : (
                ` · ${f.newest[t.metric]}`
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FiguresNote({ suspended = 0 }: { suspended?: number }) {
  return (
    <div className="updated">
      Figures: <a href={WORLDBANK.source.url} target="_blank" rel="noopener noreferrer">World Bank</a>, latest available year per country, fetched {formatDate(WORLDBANK.fetchedAt)}. Full members only{suspended ? `, excluding ${suspended} suspended or frozen` : ''}; values more than {STALE_YEARS} years older than the newest are flagged.
    </div>
  );
}

function BlocView({ bloc, props }: { bloc: Bloc; props: Props }) {
  const members = blocMembers(bloc);
  const groups = STATUS_ORDER.map((status) => ({
    status,
    rows: bloc.members.filter((m) => m.status === status).sort((a, b) => countryName(a.iso).localeCompare(countryName(b.iso))),
  })).filter((g) => g.rows.length > 0);
  return (
    <>
      <div className="panel-head">
        <div className="panel-title">
          <p className="eyebrow">{CATEGORY_LABEL[bloc.category]} bloc</p>
          <h2>
            {bloc.name}
          </h2>
        </div>
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
        <h3>
          At a glance · {members.full.length} members{members.suspended.length ? ` · ${members.suspended.length} suspended` : ''}
        </h3>
        <FigureTiles f={blocFigures(bloc)} color={bloc.color} />
        <FiguresNote suspended={members.suspended.length} />
        <BlocTrends bloc={bloc} />
        <div className="panel-actions">
          <button className="text-btn primary" onClick={() => props.onHighlightBloc(bloc.id)}>
            Show on map
          </button>
          <ShareButton />
        </div>
        {groups.map((g) => (
          <div key={g.status}>
            <h3>
              {g.rows.length === 1 ? STATUS_LABEL[g.status] : STATUS_LABEL_PLURAL[g.status]} · {g.rows.length}
            </h3>
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
            <h3>Membership changes</h3>
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
      </div>
    </>
  );
}

function BlocTrends({ bloc }: { bloc: Bloc }) {
  const points = useMemo(() => blocTrend(bloc), [bloc]);
  if (points.length < 2) return null;
  const first = points[0]!;
  const last = points.at(-1)!;
  const now = blocMembers(bloc);
  const nowCount = now.full.length + now.suspended.length;
  const flat = points.every((p) => p.members === first.members);
  const short = points.length < 5;
  const membersCap = `Members (incl. suspended)${nowCount !== last.members ? ` · ${nowCount} now` : ''}`;
  const gdpSub = last.worldShare ? `${share(last.worldShare, 1)} of world` : undefined;
  return (
    <>
      <h3 id="bloc-trends">Since {first.year}</h3>
      {short ? (
        <div className="trend-figures">
          <div>
            <span className="label">Members</span> {first.members} → {last.members}, {first.year}–{last.year}
          </div>
          <div>
            <span className="label">Combined GDP · current US$</span> {formatUsd(first.gdpUsd)} → {formatUsd(last.gdpUsd)}
            {last.estimated ? '*' : ''}, {first.year}–{last.year}
          </div>
        </div>
      ) : (
        <>
          {flat && (
            <div className="updated">
              {last.members} members, unchanged since {lastChange(bloc)}.
            </div>
          )}
          <div className={flat ? 'trends single' : 'trends'}>
            {!flat && <TrendChart points={points} color={bloc.color} series="members" label={membersCap} />}
            <TrendChart points={points} color={bloc.color} series="gdpUsd" label="Combined GDP · current US$" sub={gdpSub} />
          </div>
        </>
      )}
      <div className="updated">
        Membership from accession years{bloc.former?.length ? ', including past members' : ''}{trendComplete(bloc) ? '' : ' (incomplete)'}. GDP in nominal current US$, so currency swings show as rises and falls; full members only, from the{' '}
        <a href={WB_HISTORY.source.url} target="_blank" rel="noopener noreferrer">
          World Bank
        </a>{' '}
        ({last.covered - last.estimated}/{last.covered + (last.members - last.covered)} members reporting in {last.year}
        {last.estimated ? `; *${last.carried.map((c) => `${countryName(c.iso)} ${c.from}`).join(', ')} value${last.estimated === 1 ? '' : 's'} carried forward` : ''}; fetched {formatDate(WB_HISTORY.fetchedAt)}).
      </div>
    </>
  );
}

const LAYER_TITLE: Record<Exclude<Layer, null>, string> = {
  displacement: 'Displacement',
  sanctions: 'Sanctions',
  elections: 'Elections',
  nuclear: 'Nuclear',
  military: 'Military presence',
  trade: 'Trade dependence',
  chokepoints: 'Chokepoints',
  unrest: 'Civil unrest',
  acled: 'Violence events',
  'acled-unrest': 'Protests and riots',
  ucdp: 'Organised violence',
};

/** The active layer's reading for this country, right under the header. */
function LayerReadout({ layer, iso }: { layer: Layer; iso: string }) {
  const line = layer ? layerSummary(layer, iso) : null;
  if (!layer || !line) return null;
  return (
    <div className="layer-readout">
      <span className="label">{LAYER_TITLE[layer]}</span> {line.replace(/^Sanctions: /, '')}
    </div>
  );
}

function PairPicker({ a, props }: { a: string; props: Props }) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => search(q).filter((h) => h.kind === 'country' && h.id !== a).slice(0, 8), [q, a]);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttons = () => [...(listRef.current?.querySelectorAll('button') ?? [])];
  const onListKey = (e: React.KeyboardEvent) => {
    const all = buttons();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') all[Math.min(i + 1, all.length - 1)]?.focus();
    else if (e.key === 'ArrowUp') (i <= 0 ? inputRef.current : all[i - 1])?.focus();
    else if (e.key === 'Escape') props.onSelectCountry(a);
    else return;
    e.preventDefault();
  };
  return (
    <>
      <Muted>Pick a second country to compare ties with {countryName(a)}: shared blocs, conflicts, sanctions, military presence and trade both ways.</Muted>
      <label className="sr-only" htmlFor="pair-q">
        Second country
      </label>
      <input
        id="pair-q"
        ref={inputRef}
        className="pair-input"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type a country name"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            buttons()[0]?.focus();
          } else if (e.key === 'Enter' && hits[0]) props.onSelectPair(a, hits[0].id);
          else if (e.key === 'Escape') {
            e.preventDefault();
            props.onSelectCountry(a);
          }
        }}
      />
      <p className="pair-hint">…or click a country on the map.</p>
      {hits.length > 0 && (
        <ul className="link-list" ref={listRef} onKeyDown={onListKey}>
          {hits.map((h) => (
            <li key={h.id}>
              <button onClick={() => props.onSelectPair(a, h.id)}>{h.label}</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function RelationshipView({ a, b, props }: { a: string; b: string | null; props: Props }) {
  const r = useMemo(() => (b ? relationship(a, b) : null), [a, b]);
  const na = countryName(a);
  const nb = b ? countryName(b) : null;
  return (
    <>
      <div className="panel-head">
        <div className="panel-title">
          <p className="eyebrow">Relationship</p>
          <h2>
            {na} {nb ? <span style={{ color: 'var(--fg-muted)' }}>and</span> : ''} {nb ?? ''}
          </h2>
        </div>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body" data-pair={b ? `${a},${b}` : a}>
        {!r || !b ? (
          <PairPicker a={a} props={props} />
        ) : (
          <>
            <div className="badges">
              <span className="badge muted">{relationshipSummary(r)}</span>
            </div>
            <h3 id="pair-blocs">Shared blocs · {r.sharedBlocs.length}</h3>
            {r.sharedBlocs.length === 0 ? (
              <Muted>No bloc tracked here has both as members.</Muted>
            ) : (
              <ul className="link-list">
                {r.sharedBlocs.map(({ bloc, a: ma, b: mb }) => (
                  <li key={bloc.id}>
                    <button onClick={() => props.onSelectBloc(bloc.id)}>
                      <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: bloc.color }} />
                      {bloc.shortName}
                      <span className="meta">{ma.status === 'member' && mb.status === 'member' ? 'both members' : `${STATUS_LABEL[ma.status]} / ${STATUS_LABEL[mb.status]}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <h3 id="pair-conflicts">Conflicts · {r.conflicts.length}</h3>
            {r.conflicts.length === 0 ? (
              <Muted>No tracked conflict links them.</Muted>
            ) : (
              <ul className="link-list">
                {r.conflicts.map((c, i) => (
                  <li key={c.conflict.id + i}>
                    <button onClick={() => props.onSelectConflict(c.conflict.id)}>
                      <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: INTENSITY_COLOR[c.conflict.intensity] }} />
                      <span>
                        {c.conflict.name}
                        <span className="row-note">{c.how === 'both-parties' ? c.detail : `${c.how === 'a-backs' ? na : nb}: ${c.detail}`}</span>
                      </span>
                      <span className="meta">{INTENSITY_LABEL[c.conflict.intensity]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <h3 id="pair-sanctions">US and EU sanctions between them</h3>
            {!r.sanctionsInScope ? (
              <Muted>Not tracked for this pair: ATLAS records only US and EU country-level regimes. UK, Japanese, Canadian, Swiss and other national sanctions, and countersanctions, are not included.</Muted>
            ) : r.sanctions.length === 0 ? (
              <Muted>Neither the US nor the EU applies a country-level regime to the other (UN measures are not counted as bilateral; other national sanctions and countersanctions are not tracked).</Muted>
            ) : (
              <ul className="link-list">
                {r.sanctions.flatMap((s) =>
                  s.regimes.map((x) => (
                    <li key={s.from + x.url}>
                      <a href={x.url} target="_blank" rel="noopener noreferrer">
                        <span>
                          {x.name}
                          <span className="row-note">
                            {x.authority === 'EU' ? `EU (${countryName(s.from)} is a member)` : countryName(s.from)} → {countryName(s.to)}
                          </span>
                        </span>
                        <span className="meta">{x.authority} ↗</span>
                      </a>
                    </li>
                  )),
                )}
              </ul>
            )}
            <h3 id="pair-military">Military presence</h3>
            {r.presence.aInB.length + r.presence.bInA.length === 0 ? (
              <Muted>Neither keeps forces in the other.</Muted>
            ) : (
              <ul className="link-list">
                {[...r.presence.aInB, ...r.presence.bInA].map((p) => (
                  <li key={p.operator + p.host + p.name}>
                    <a href={p.source.url} target="_blank" rel="noopener noreferrer">
                      <span>
                        {operatorName(p.operator)} in {countryName(p.host)}: {p.name}
                        <span className="row-note">{p.note}</span>
                      </span>
                      <span className="meta">{PRESENCE_KIND_LABEL[p.kind]} ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <h3 id="pair-trade">Trade both ways</h3>
            <div className="tiles two">
              <div className="tile">
                <span className="label">{na} → {nb}</span>
                <strong>{r.trade.aToB === null ? '—' : pct(r.trade.aToB)}</strong>
                <span className="sub">{r.trade.aToB === null ? (r.trade.yearA ? 'not among its 15 largest destinations' : 'no WITS data') : `of its goods exports, ${r.trade.yearA}`}</span>
              </div>
              <div className="tile">
                <span className="label">{nb} → {na}</span>
                <strong>{r.trade.bToA === null ? '—' : pct(r.trade.bToA)}</strong>
                <span className="sub">{r.trade.bToA === null ? (r.trade.yearB ? 'not among its 15 largest destinations' : 'no WITS data') : `of its goods exports, ${r.trade.yearB}`}</span>
              </div>
            </div>
            <h3>Status</h3>
            <ul className="link-list">
              <li>
                <span className="row">
                  <span>
                    {na}
                    <span className="row-note">{[r.nuclear.a, r.elections.a].filter(Boolean).join(' · ') || 'No nuclear role or election on record'}</span>
                  </span>
                </span>
              </li>
              <li>
                <span className="row">
                  <span>
                    {nb}
                    <span className="row-note">{[r.nuclear.b, r.elections.b].filter(Boolean).join(' · ') || 'No nuclear role or election on record'}</span>
                  </span>
                </span>
              </li>
            </ul>
            <div className="panel-actions">
              <button className="text-btn" onClick={() => props.onSelectCountry(a)}>
                Open {na}
              </button>
              <button className="text-btn" onClick={() => props.onSelectCountry(b)}>
                Open {nb}
              </button>
              <button className="text-btn" onClick={() => props.onSelectPair(a, null)}>
                Change
              </button>
              <ShareButton />
            </div>
            <div className="updated">Trade shares from {TRADE.source.name}, fetched {formatDate(TRADE.fetchedAt)}. Other rows come from the datasets shown on their own panels.</div>
          </>
        )}
      </div>
    </>
  );
}

function HistoryList({ history, highlight, onSelectEntry, palette = INTENSITY_COLOR }: { history: HistoryEntry[]; highlight: HistoryEntry | null; onSelectEntry?: (h: HistoryEntry) => void; palette?: Record<Intensity, string> }) {
  return (
    <ol className="history">
      {history.map((h, i) => {
        const open = highlight ? h === highlight : i === 0;
        return (
          <li key={h.date + i} data-current={open}>
            <span className="when">
              <span className="dot" style={{ background: palette[h.intensity] }} aria-hidden="true" />
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
        <div className="panel-title">
          <p className="eyebrow">{CONFLICT_TYPE_LABEL[conflict.type]}</p>
          <h2>
            {conflict.name}
          </h2>
        </div>
        <StarButton item={{ kind: 'conflict', id: conflict.id }} name={conflict.name} />
        <CloseButton onClick={props.onClose} />
      </div>
      <SectionNav
        label="Conflict sections"
        items={[
          { id: 'conflict-background', label: 'Background' },
          ...(conflict.actors?.length ? [{ id: 'conflict-actors', label: 'Backers' }] : []),
          { id: 'conflict-peace', label: `Peace ${conflict.peace?.length ?? 0}` },
          { id: 'conflict-assessments', label: 'Assessments' },
          { id: 'conflict-countries', label: 'Countries' },
        ]}
      />
      <div className="panel-body">
        {replay && (
          <p className="sr-only" role="status">
            {conflict.name}: {shown ? `${INTENSITY_LABEL[shown.intensity].toLowerCase()} intensity` : 'no assessment'}, {props.month ? formatMonth(props.month) : ''}
          </p>
        )}
        <div className="badges">
          <span className="badge" style={{ ['--badge-color' as string]: INTENSITY_COLOR[(shown ?? conflict).intensity] }}>
            <span className="dot" /> {INTENSITY_LABEL[(shown ?? conflict).intensity]}
          </span>
          <span className="badge muted">Since {conflict.since}</span>
          {replay && props.month && <span className="badge muted replay-badge">{replayBadge(conflict, props.month)}</span>}
        </div>
        <h3>Parties</h3>
        <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
          {conflict.parties.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h3 id="conflict-background">Background</h3>
        <p>{conflict.summary}</p>
        {conflict.actors && conflict.actors.length > 0 && (
          <>
            <h3 id="conflict-actors">Who backs whom</h3>
            <ActorsGraph conflict={conflict} onSelectCountry={props.onSelectCountry} />
            {backersOf(conflict).length > 0 && (
              <div className="badges">
                {backersOf(conflict).map((b) => (
                  <button key={b.iso} className="badge" style={{ cursor: 'pointer' }} onClick={() => props.onSelectCountry(b.iso)} title={`${b.support.map((k) => SUPPORT_LABEL[k]).join(', ')} for ${b.actors.join(', ')}`}>
                    {b.name}
                    <span className="meta">
                      {b.support.map((k) => SUPPORT_LABEL[k].toLowerCase()).join(', ')} → {b.actors.join(', ')}
                    </span>
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
                {conflict.actorsUpdated && <span className="src">reviewed {formatMonth(conflict.actorsUpdated)}</span>}
              </p>
            )}
          </>
        )}
        <h3 id="conflict-peace">Peace process · {conflict.peace?.length ?? 0}</h3>
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
        <h3 id="conflict-assessments">Assessments</h3>
        {replay && !shown && <p style={{ color: 'var(--fg-muted)' }}>No assessment on record for {props.month ? formatMonth(props.month) : ''}{conflict.since <= Number(props.month?.slice(0, 4)) ? `; the current phase began in ${conflict.since}, before ATLAS tracked it` : ''}.</p>}
        <HistoryList history={conflict.history} highlight={shown} />
        <h3 id="conflict-countries">Countries</h3>
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

function UnrestView({ unrest, props }: { unrest: Unrest; props: Props }) {
  return (
    <>
      <div className="panel-head">
        <div className="panel-title">
          <p className="eyebrow">{UNREST_KIND_LABEL[unrest.kind]}</p>
          <h2>
            {unrest.name}
          </h2>
        </div>
        <StarButton item={{ kind: 'unrest', id: unrest.id }} name={unrest.name} />
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <div className="badges">
          <span className="badge" style={{ ['--badge-color' as string]: UNREST_COLOR[unrest.intensity] }}>
            <span className="dot" /> {INTENSITY_LABEL[unrest.intensity]}
          </span>
          <span className="badge muted">Since {formatMonth(unrest.since)}</span>
        </div>
        <h3>Parties</h3>
        <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
          {unrest.parties.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h3 id="unrest-trigger">Trigger</h3>
        <p>{unrest.trigger}</p>
        <h3>Background</h3>
        <p>{unrest.summary}</p>
        <h3 id="unrest-assessments">Assessments</h3>
        <HistoryList history={unrest.history} highlight={null} palette={UNREST_COLOR} />
        <h3>Countries</h3>
        <div className="badges">
          {unrest.countries.map((iso) => (
            <button key={iso} className="badge" onClick={() => props.onSelectCountry(iso)} style={{ cursor: 'pointer' }}>
              {countryName(iso)}
            </button>
          ))}
        </div>
        <div className="panel-actions">
          <ShareButton />
        </div>
        <div className="updated">
          Latest assessment verified {formatDate(unrest.updated)}.
          {unrest.lastChecked && unrest.lastChecked > unrest.updated ? ` Re-checked ${formatDate(unrest.lastChecked)} with no material change.` : ''}
          {' '}Intensity here means scale of mobilisation and lethality of the response, not armed combat. Check the linked sources for developments since then.
        </div>
      </div>
    </>
  );
}

const WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All' },
];

const FUNNEL = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4h18l-7 8.5V19l-4 2v-8.5Z" />
  </svg>
);

/** The changes feed, grouped New / Escalated / Eased / Membership / Re-assessed. 'since' is the visitor's unseen items. */
function ChangesView({ props }: { props: Props }) {
  const fromStrip = props.selection.kind === 'changes' && props.selection.since === true;
  const seen = useSeen();
  const [win, setWin] = useState<number | 'since'>(() => (fromStrip && seen.unseen.length > 0 ? 'since' : 7));
  const { only, keys, items: starred, setOnly } = useWatchlist();
  const sinceActive = win === 'since' && seen.unseen.length > 0;
  const days = win === 'since' ? 7 : win;
  const shown = useMemo(() => {
    const base = sinceActive ? seen.unseen : CHANGES;
    const pool = only ? watchlistOnly(base, keys) : [...base];
    return sinceActive || !days ? pool : changesSince(pool, days);
  }, [sinceActive, seen.unseen, days, only, keys]);
  const groups = useMemo(() => groupChanges(shown), [shown]);
  const markRead = () => {
    seen.markRead();
    setWin(7);
  };
  return (
    <>
      <div className="panel-head">
        <div className="panel-title">
          <p className="eyebrow">Data feed</p>
          <h2>
            Recent changes
          </h2>
        </div>
        {sinceActive && (
          <button className="text-btn" onClick={markRead}>
            Mark read
          </button>
        )}
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <div className="filter-row">
          {seen.unseen.length > 0 && (
            <button aria-pressed={sinceActive} onClick={() => setWin('since')} className="text-btn since-chip" title="Everything you have not seen since you last pressed Mark read">
              Since {shortDay(seen.since)} · {seen.unseen.length}
            </button>
          )}
          <div className="segmented small" role="group" aria-label="Time window">
            {WINDOWS.map((w) => (
              <button key={w.days} aria-pressed={!sinceActive && days === w.days} onClick={() => setWin(w.days)}>
                {w.label}
              </button>
            ))}
          </div>
          <button className={'text-btn watch-toggle' + (only ? ' on' : '')} aria-pressed={only} onClick={() => setOnly(!only)} aria-label="Show only starred items">
            {FUNNEL} Starred only{starred.length ? ` · ${starred.length}` : ''}
          </button>
          <RssLink />
        </div>
        {shown.length === 0 && (
          <p style={{ color: 'var(--fg-muted)', marginTop: 12 }}>
            {only && starred.length === 0 ? 'Nothing is starred yet. Star a country, bloc, conflict or unrest episode from its panel.' : only ? 'No changes to your starred items in this window.' : 'No changes recorded in this window.'}
          </p>
        )}
        {groups.map((g) => (
          <section key={g.delta} className="feed-group" data-delta={g.delta}>
            {g.delta === 'same' ? (
              <FeedList items={g.items} props={props} unseen={seen.unseenKeys} />
            ) : (
              <>
                <h3>
                  {g.title} · {g.items.length}
                </h3>
                <FeedList items={g.items} props={props} collapseSame={false} unseen={seen.unseenKeys} />
              </>
            )}
          </section>
        ))}
        <div className="panel-actions">
          <ShareButton />
        </div>
      </div>
    </>
  );
}

/** Latest dated change for a starred item, and whether anything about it is unseen. */
function watchStatus(item: WatchItem, unseen: ReadonlySet<string>) {
  const changes = changesForWatchItem(CHANGES, item);
  return { latest: changes[0] ?? null, unread: changes.some((c) => unseen.has(c.key)) };
}

const STAR_PATH = 'm12 3 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8L12 3Z';

function WatchRow({ item, name, onOpen, unseen }: { item: WatchItem; name: string; onOpen: () => void; unseen: ReadonlySet<string> }) {
  const { toggle } = useWatchlist();
  const { latest, unread } = watchStatus(item, unseen);
  const entity = item.kind === 'conflict' ? CONFLICT_BY_ID.get(item.id) : item.kind === 'unrest' ? UNREST_BY_ID.get(item.id) : undefined;
  const color = entity ? itemColor({ kind: item.kind as 'conflict' | 'unrest', intensity: entity.intensity }) : item.kind === 'bloc' ? BLOC_BY_ID.get(item.id)?.color : undefined;
  const meta = entity
    ? [latest ? `Updated ${shortDay(latest.date)}` : null, kindTag({ kind: item.kind as 'conflict' | 'unrest', intensity: entity.intensity }), latest && latest.id === item.id ? deltaWord(latest.delta) : null]
    : [latest ? `Latest ${shortDay(latest.date)}: ${latest.title}${deltaWord(latest.delta) ? ` ${deltaWord(latest.delta)}` : ''}` : 'No dated changes'];
  return (
    <li className="watch-row" data-unread={unread || undefined}>
      <button onClick={onOpen}>
        <span className={'dot' + (item.kind === 'unrest' ? ' triangle' : '')} style={{ background: color ?? 'var(--fg-muted)' }} aria-hidden="true" />
        <span className="watch-text">
          <span className="watch-name">{name}</span>
          <span className="watch-meta">{meta.filter(Boolean).join(' · ')}</span>
        </span>
        {unread && <span className="unread-dot" aria-label="Unseen changes" role="img" />}
      </button>
      <button className="icon-btn star small" aria-pressed="true" aria-label={`Remove ${name} from watchlist`} onClick={() => toggle(item)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d={STAR_PATH} />
        </svg>
      </button>
    </li>
  );
}

/** Suggestions for an empty watchlist: the current high-intensity conflicts, newest first, plus NATO. */
function suggestions(): Array<{ item: WatchItem; name: string }> {
  const wars = CONFLICTS.filter((c) => c.intensity === 'high')
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 3)
    .map((c) => ({ item: { kind: 'conflict' as const, id: c.id }, name: c.name }));
  const nato = BLOC_BY_ID.get('nato');
  return nato ? [...wars, { item: { kind: 'bloc' as const, id: nato.id }, name: nato.name }] : wars;
}

function WatchlistView({ props }: { props: Props }) {
  const { items, toggle, persisted } = useWatchlist();
  const { unseenKeys } = useSeen();
  const resolved = items.filter(watchItemResolves);
  const unresolved = items.filter((it) => !watchItemResolves(it));
  const groups = [
    { kind: 'country' as const, title: 'Countries', name: (id: string) => countryName(id), open: props.onSelectCountry },
    { kind: 'bloc' as const, title: 'Blocs', name: (id: string) => BLOC_BY_ID.get(id)?.shortName ?? id, open: props.onSelectBloc },
    { kind: 'conflict' as const, title: 'Conflicts', name: (id: string) => CONFLICT_BY_ID.get(id)?.name ?? id, open: props.onSelectConflict },
    { kind: 'unrest' as const, title: 'Unrest', name: (id: string) => UNREST_BY_ID.get(id)?.name ?? id, open: props.onSelectUnrest },
  ].map((g) => ({ ...g, rows: resolved.filter((it) => it.kind === g.kind) }));
  return (
    <>
      <div className="panel-head">
        <div className="panel-title">
          <p className="eyebrow" data-unsaved={!persisted || undefined}>
            {persisted ? 'Saved on this device' : 'This tab only'}
          </p>
          <h2>
            Watchlist
          </h2>
        </div>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        {!persisted && <p className="watch-warning">Storage is blocked in this browser: stars last until you close this tab.</p>}
        {items.length === 0 ? (
          <>
            <p style={{ color: 'var(--fg-muted)', fontSize: 13 }}>
              Nothing starred yet. Press the star on any country, bloc, conflict or unrest episode to follow it: its latest change and anything you have not seen show up here, and followed items lead the since-last-visit strip.
            </p>
            <ul className="link-list">
              <li className="watch-row watch-ghost" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <path d={STAR_PATH} />
                </svg>
                Starred items appear here
              </li>
            </ul>
            <h3>Suggested</h3>
            <ul className="link-list">
              {suggestions().map(({ item, name }) => (
                <li key={item.kind + item.id} className="watch-row">
                  <button onClick={() => (item.kind === 'conflict' ? props.onSelectConflict(item.id) : props.onSelectBloc(item.id))}>{name}</button>
                  <StarButton item={item} name={name} small />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Muted>Followed items lead the since-last-visit strip. A dot marks anything you have not seen; Starred only on the ticker or the changes feed narrows them to these.</Muted>
        )}
        {groups
          .filter((g) => g.rows.length > 0)
          .map((g) => (
            <div key={g.kind}>
              <h3>
                {g.title} · {g.rows.length}
              </h3>
              <ul className="link-list">
                {g.rows.map((it) => (
                  <WatchRow key={it.id} item={it} name={g.name(it.id)} onOpen={() => g.open(it.id)} unseen={unseenKeys} />
                ))}
              </ul>
            </div>
          ))}
        {unresolved.length > 0 && (
          <div>
            <h3>No longer tracked · {unresolved.length}</h3>
            <ul className="link-list">
              {unresolved.map((it) => (
                <li key={it.kind + it.id} className="watch-row watch-gone">
                  <span className="watch-text">
                    <span className="watch-name">{it.id}</span>
                    <span className="watch-meta">Removed or renamed in a data update</span>
                  </span>
                  <button className="text-btn" aria-label={`Remove ${it.id} from watchlist`} onClick={() => toggle(it)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="panel-actions">
          <button className="text-btn" onClick={() => props.onOpenChanges()}>
            Open changes feed
          </button>
          <RssLink />
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
        <div className="panel-title">
          <p className="eyebrow">Maritime chokepoint</p>
          <h2>
            {cp.name}
          </h2>
        </div>
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
        <h3>What passes through</h3>
        <p>{cp.carries}</p>
        <h3 id="chokepoint-status">Status</h3>
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
        <h3 id="chokepoint-conflicts">Linked conflicts · {conflicts.length}</h3>
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
        <h3>Other chokepoints</h3>
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
  const setA = new Set(blocMembers(a).full);
  const setB = new Set(blocMembers(b).full);
  const suspended = [...new Set([...blocMembers(a).suspended, ...blocMembers(b).suspended].map((m) => m.iso))].sort((x, y) => countryName(x).localeCompare(countryName(y)));
  const statusIn = (bloc: Bloc, iso: string) => {
    const m = bloc.members.find((x) => x.iso === iso);
    return m ? STATUS_LABEL[m.status].toLowerCase() : 'not a member';
  };
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
        <div className="panel-title">
          <p className="eyebrow">Compare</p>
          <h2>
            {a.shortName} <span style={{ color: 'var(--fg-muted)' }}>vs</span> {b.shortName}
          </h2>
        </div>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <div className="compare-grid">
          <div>
            <h3>
              <span className="dot" style={{ width: 8, height: 8, background: a.color }} /> {a.shortName}
            </h3>
            <FigureTiles f={blocFigures(a)} color={a.color} />
          </div>
          <div>
            <h3>
              <span className="dot" style={{ width: 8, height: 8, background: b.color }} /> {b.shortName}
            </h3>
            <FigureTiles f={blocFigures(b)} color={b.color} />
          </div>
        </div>
        <FiguresNote suspended={suspended.length} />
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
        <h3>In both · {both.length}</h3>
        {list(both)}
        <h3>
          {a.shortName} only · {onlyA.length}
        </h3>
        {list(onlyA)}
        <h3>
          {b.shortName} only · {onlyB.length}
        </h3>
        {list(onlyB)}
        {suspended.length > 0 && (
          <>
            <h3>Suspended / frozen · {suspended.length}</h3>
            <ul className="link-list">
              {suspended.map((iso) => (
                <li key={iso}>
                  <button onClick={() => props.onSelectCountry(iso)}>
                    {countryName(iso)}
                    <span className="meta">
                      {a.shortName}: {statusIn(a, iso)} · {b.shortName}: {statusIn(b, iso)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function AboutView({ props }: { props: Props }) {
  const newest = [...CONFLICTS.map((c) => c.updated), ...BLOCS.flatMap((b) => b.changes.map((c) => c.date))].sort().at(-1) ?? '';
  return (
    <>
      <div className="panel-head">
        <div className="panel-title">
          <p className="eyebrow">About</p>
          <h2>
            How ATLAS works
          </h2>
        </div>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <p>
          ATLAS is an open geopolitics map: who belongs to which bloc, where armed conflicts and civil unrest are and how intense they are, and how many people they have displaced.
          It is built for orientation, not operations. Every claim links to a source, and every assessment carries the date it was verified.
        </p>
        <h3>Freshness</h3>
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
            <span>Export shares to the US, China and the EU and each country's largest partners (World Bank WITS, newest year per country)</span>
          </li>
          <li>
            <span className="when">{formatDate(WB_HISTORY.fetchedAt)}</span>
            <span>GDP by year since {WB_HISTORY.from} for the bloc trend charts (World Bank)</span>
          </li>
        </ul>
        <h3>How assessments are made</h3>
        <p>
          Each conflict has a dated history of assessments. A weekly automated pass searches the web for developments, drafts an update and proposes it in a pull request that a person reviews before it goes live. The pass is held to three rules: it may only cite pages that appeared in its own search results or that live on a short list of trusted trackers and wire services; it may not move intensity by more than one step at a time; and it must leave an entry alone when nothing material changed. Intensity is a judgement on a four-step scale: high means large-scale sustained combat, medium regular deadly fighting, low sporadic violence, latent a ceasefire or standoff.
        </p>
        <h3>Sources</h3>
        <p>
          Conflict trackers: CFR Global Conflict Tracker, ACLED, Crisis Group CrisisWatch, ISW. Civil unrest: curated from wire services, Crisis Group, ACLED, the Carnegie Global Protest Tracker, HRW and Amnesty, then reassessed weekly by the same research pass; organised-violence deaths from the UCDP Georeferenced Event Dataset when a token is configured. Memberships: the organisations' own sites. Displacement: UNHCR Refugee Data Finder, by country of origin. Figures: World Bank Open Data. Sanctions: OFAC's programme index, the EU Sanctions Map and UN Security Council committees (country-level regimes only). Elections: seeded from Wikipedia's list of next general elections and IFES ElectionGuide, then re-checked weekly by the research pass. Nuclear status: SIPRI, the Arms Control Association and NATO, curated by hand. Geometry: Natural Earth via world-atlas. Trusted hosts for automated citations: {TRUSTED_HOSTS.join(', ')}.
        </p>
        <h3>Caveats</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Borders follow Natural Earth and imply no position on disputes. Kosovo uses the code UNK; Northern Cyprus and Somaliland are drawn as neutral territory.</li>
          <li>Dependent territories drawn on their own take the alliances whose treaty area covers them and their sovereign's nuclear deterrent: Greenland is shown in NATO via Denmark, while Puerto Rico and the Falklands lie outside NATO's Article 6 area. They never inherit EU membership, trade or elections. French Guiana is part of France's polygon.</li>
          <li>Conflict tinting fills a country by the most intense conflict fought on its territory. States whose forces fight only abroad (the US in the Iran war, Saudi Arabia in Yemen, Rwanda in eastern DR Congo) are drawn with a dashed outline instead. Maritime flashpoints such as Hormuz and the South China Sea have no land theatre.</li>
          <li>Bloc figures count full members only and skip countries without a World Bank value; the tiles say when coverage is partial.</li>
          <li>Displacement figures are UNHCR mid-year or end-year stocks, not flows, and lag events by months. UNHCR figures exclude Palestine refugees under UNRWA's mandate, so Palestine adds UNRWA's register and IDMC's IDP estimate; UNHCR reports Kosovo together with Serbia.</li>
          <li>An assessment is a dated snapshot. Check the linked sources before relying on it.</li>
        </ul>
        <h3>Following things</h3>
        <p>
          Every country has a dossier (memberships, conflicts, displacement, figures and its recent changes) at a link you can share. The strip along the bottom cycles the ten newest dated changes and pauses while you hover it. Press the star on any panel to add it to a watchlist kept in this browser; the ticker and the changes feed can be filtered to it. A strip under the header lists what changed since you last pressed "Mark read". The same changes are available as <a href="/feed.xml">RSS</a> and <a href="/feed.json">JSON Feed</a>.
        </p>
        <h3>Globe, briefing, embed and export</h3>
        <p>
          The globe button in the map controls switches to an orthographic globe you can spin by dragging (it keeps turning briefly when released) and the centre travels in the link. The briefing button goes full screen, hides the chrome and cycles through the live high-intensity conflicts and your watchlist, nine seconds each; Space pauses, arrows step, Escape exits. The Embed button next to Copy link (and in the map controls) builds an iframe snippet for the current view, with a preview and options for the legend, interaction, theme (dark unless the link says <span className="mono">theme=light</span> or <span className="mono">theme=auto</span>) and a frozen replay month; embeds carry their data date in the badge. The download button saves the map you are looking at as a PNG with its legend and a date stamp.
        </p>
        <h3>Analysis</h3>
        <p>
          Any country dossier offers "Relationship with…": pick a second country to see shared blocs, the conflicts that link them, US and EU sanctions either side applies to the other (other national sanctions and countersanctions are not tracked), forces either keeps in the other, and each side's export share to the other. Bloc panels chart membership and combined GDP since 1990 from accession years and World Bank data.
          {ASK_ENABLED ? ' Ask ATLAS answers questions strictly from this dataset with citations; it is rate-limited and capped per day.' : ''}
        </p>
        <h3>Keyboard</h3>
        <p className="mono" style={{ fontSize: 12 }}>
          / search · arrows pan or rotate · + − zoom · 0 reset · Tab through conflict markers, Enter opens · Esc closes the tooltip, then the panel · browser Back steps back through panels, modes and layers · briefing: Space pauses, arrows step, Esc exits
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
  const sheet = useSheet(props.onClose);
  const sectionRef = useRef<HTMLElement>(null);
  const headingId = usePanelFocus(sectionRef, selectionKey(selection));
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
  } else if (selection.kind === 'pair') {
    body = <RelationshipView a={selection.a} b={selection.b} props={props} />;
  } else if (selection.kind === 'ask') {
    body = (
      <AskPanel
        onClose={props.onClose}
        onOpenId={(id) => {
          const [kind, ...rest] = id.split(':');
          const key = rest.join(':');
          if (kind === 'conflict') props.onSelectConflict(key);
          else if (kind === 'bloc') props.onSelectBloc(key);
          else if (kind === 'chokepoint') props.onSelectChokepoint(key);
          else if (kind === 'unrest') props.onSelectUnrest(key);
          else if (kind && /^[A-Z]{3}$/.test(key)) props.onSelectCountry(key);
        }}
      />
    );
  } else if (selection.kind === 'compare') {
    body = props.compare ? <CompareView a={props.compare.a} b={props.compare.b} props={props} /> : null;
  } else if (selection.kind === 'conflict') {
    const c = CONFLICT_BY_ID.get(selection.id);
    body = c ? <ConflictView conflict={c} props={props} /> : null;
  } else if (selection.kind === 'unrest') {
    const u = UNREST_BY_ID.get(selection.id);
    body = u ? <UnrestView unrest={u} props={props} /> : null;
  }
  if (!body) return null;
  return (
    // No aria-live: moving focus to the heading announces a new panel once.
    <section className="panel frame" role="complementary" aria-labelledby={headingId} ref={sectionRef} {...sheet.sectionProps}>
      <button type="button" {...sheet.gripProps} />
      {props.backTo && (
        <button className="panel-back" onClick={props.backTo.onBack} title={`Back to ${props.backTo.label}`}>
          <span aria-hidden="true">‹</span> {props.backTo.label}
        </button>
      )}
      {body}
    </section>
  );
}
