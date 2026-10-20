import { useMemo, useState } from 'react';
import { BLOCS, BLOC_BY_ID } from '../data/blocs';
import { CONFLICT_BY_ID } from '../data/conflicts';
import { UNREST_BY_ID } from '../data/unrest';
import { UNREST_COLOR, UNREST_KIND_LABEL } from '../lib/unrest';
import type { Bloc, Conflict, HistoryEntry, MembershipStatus, Unrest } from '../data/types';
import { countryName } from '../lib/countries';
import { changesSince, entryAt, type ChangeItem } from '../lib/history';
import { CATEGORY_LABEL, CHANGE_LABEL, CONFLICT_TYPE_LABEL, FRESHNESS, INTENSITY_COLOR, INTENSITY_LABEL, STATUS_LABEL, STATUS_LABEL_PLURAL, UNREST_INTENSITY_LABEL, formatDate, formatMonth } from '../lib/labels';
import type { Selection } from '../lib/urlState';
import { STALE_YEARS, WORLD, WORLDBANK, blocFigures, formatCount, formatUsd, share, staleValues, type Figures } from '../lib/worldbank';
import { blocMembers } from '../lib/membership';
import { DISPLACEMENT, REPORTED_WITH, displacementTotal, formatPeople } from '../lib/displacement';
import { CHANGES, watchlistOnly } from '../lib/feed';
import { conflictBadges, countryDossier, isDisputed, notMemberOf, profileLine, type CountryDossier } from '../lib/dossier';
import { isTheatre } from '../lib/theatre';
import { territoryLine } from '../lib/sovereign';
import { useWatchlist } from '../hooks/useWatchlist';
import StarButton from './StarButton';
import ActorsGraph from './ActorsGraph';
import { DataRowBody } from './DataRow';
import { PEACE_KIND_LABEL, mediatorNames } from '../lib/actors';
import { CHOKEPOINTS_FILE, CHOKEPOINT_BY_ID, CHOKEPOINT_COLOR, CHOKEPOINT_STATUS_LABEL, currentStatus, linkedConflicts, type Chokepoint } from '../lib/chokepoints';
import { PRESENCE_KIND_LABEL, operatorName } from '../lib/military';
import { TRADE, pct } from '../lib/trade';
import { relationship, relationshipSummary } from '../lib/relationship';
import { blocTrend, lastChange, trendComplete } from '../lib/trends';
import { WB_HISTORY } from '../lib/worldbankHistory';
import { search } from '../lib/search';
import TrendChart from './TrendChart';
import AskPanel from './AskPanel';
import { AgeBadges, ConfidenceLabel, FreshnessFooter, IntensityBadge, LatestBlock, ProvenanceNote, SourceLinks } from './Provenance';
import AboutView from './AboutView';

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
  onOpenAbout: (anchor?: string) => void;
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
            <button className="inline-link" onClick={() => (it.kind === 'conflict' ? props.onSelectConflict(it.id) : it.kind === 'unrest' ? props.onSelectUnrest(it.id) : props.onSelectBloc(it.id))}>
              {it.title}
            </button>
            <span className="label"> · {it.intensity ? (it.kind === 'unrest' ? UNREST_INTENSITY_LABEL : INTENSITY_LABEL)[it.intensity] : 'Membership'}{it.kind === 'unrest' ? ' (unrest)' : ''}</span>
            <span className="note"> {it.detail.length > max ? it.detail.slice(0, max - 3).trimEnd() + '…' : it.detail}</span>
          </span>
        </li>
      ))}
    </ol>
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
      <div className="panel-body dossier" data-sections={dossier.sections.join(' ')}>
        <Muted>
          {profileLine(country)}
          {isDisputed(country.cca3) && (
            <>
              {' · '}
              <button className="inline-link" onClick={() => props.onOpenAbout('about-disputed')}>
                Disputed status: how ATLAS words it
              </button>
            </>
          )}
        </Muted>
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

        <h3 id="dossier-changes">Latest changes · {changes.length}</h3>
        {changes.length === 0 ? <Muted>No dated assessment or membership change on record for {country.name}.</Muted> : <FeedList items={changes} props={props} compact />}

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

function PairPicker({ a, props }: { a: string; props: Props }) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => search(q).filter((h) => h.kind === 'country' && h.id !== a).slice(0, 8), [q, a]);
  return (
    <>
      <Muted>Pick a second country to compare ties with {countryName(a)}: shared blocs, conflicts, sanctions, military presence and trade both ways.</Muted>
      <label className="sr-only" htmlFor="pair-q">
        Second country
      </label>
      <input id="pair-q" className="pair-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a country name" />
      {hits.length > 0 && (
        <ul className="link-list">
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

function HistoryList({ history, highlight, onSelectEntry, unrest, openFirst = true }: { history: HistoryEntry[]; highlight: HistoryEntry | null; onSelectEntry?: (h: HistoryEntry) => void; unrest?: boolean; openFirst?: boolean }) {
  const label = unrest ? UNREST_INTENSITY_LABEL : INTENSITY_LABEL;
  return (
    <ol className="history">
      {history.map((h, i) => {
        const open = highlight ? h === highlight : openFirst && i === 0;
        return (
          <li key={h.date + i} data-current={open}>
            <span className="when">
              <span className="dot" style={{ background: unrest ? UNREST_COLOR[h.intensity] : INTENSITY_COLOR[h.intensity] }} aria-hidden="true" />
              {formatDate(h.date)}
            </span>
            <details open={open} onToggle={onSelectEntry ? () => onSelectEntry(h) : undefined}>
              <summary>
                {label[h.intensity]}
                <ConfidenceLabel entry={h} />
              </summary>
              <p>{h.status}</p>
              <SourceLinks sources={h.sources} />
              <ProvenanceNote entry={h} />
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
  // The Latest block shows `shown`; the Assessments list below carries everything else.
  const earlier = conflict.history.filter((h) => h !== shown);
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
      <div className="panel-body">
        <div className="badges">
          <IntensityBadge intensity={(shown ?? conflict).intensity} />
          <span className="badge muted">Since {conflict.since}</span>
          {replay && props.month ? <span className="badge muted">As of {formatMonth(props.month)}</span> : <AgeBadges date={conflict.updated} kind="assessment" />}
        </div>
        {shown ? <LatestBlock entry={shown} replay={replay} /> : <p style={{ color: 'var(--fg-muted)' }}>No assessment on record for {props.month ? formatMonth(props.month) : ''}.</p>}
        {conflict.actors && conflict.actors.length > 0 && (
          <>
            <h3 id="conflict-actors">Who backs whom</h3>
            <ActorsGraph conflict={conflict} onSelectCountry={props.onSelectCountry} />
            {mediatorNames(conflict).length > 0 && <p className="mediators">Mediators: {mediatorNames(conflict).join(', ')}</p>}
            {conflict.actorsSources && (
              <p className="src-row">
                {conflict.actorsSources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="src">
                    {s.name} ↗
                  </a>
                ))}
                {conflict.actorsUpdated && <span className="src">Curated {formatMonth(conflict.actorsUpdated)}</span>}
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
        <details className="background">
          <summary>
            <h3 id="conflict-background">Parties and background</h3>
          </summary>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
            {conflict.parties.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p>{conflict.summary}</p>
        </details>
        <h3 id="conflict-assessments">Earlier assessments · {earlier.length}</h3>
        <HistoryList history={earlier} highlight={null} openFirst={false} />
        <h3>Countries</h3>
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
        <FreshnessFooter updated={conflict.updated} lastChecked={conflict.lastChecked} />
      </div>
    </>
  );
}

function UnrestView({ unrest, props }: { unrest: Unrest; props: Props }) {
  const latest = unrest.history[0];
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
          <IntensityBadge intensity={unrest.intensity} unrest />
          <span className="badge muted">Since {formatMonth(unrest.since)}</span>
          <AgeBadges date={unrest.updated} kind="assessment" />
        </div>
        {latest && <LatestBlock entry={latest} unrest />}
        <h3 id="unrest-trigger">Trigger</h3>
        <p>{unrest.trigger}</p>
        <details className="background">
          <summary>
            <h3 id="unrest-background">Parties and background</h3>
          </summary>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
            {unrest.parties.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p>{unrest.summary}</p>
        </details>
        <h3 id="unrest-assessments">Earlier assessments · {unrest.history.length - 1}</h3>
        <HistoryList history={unrest.history.slice(1)} highlight={null} openFirst={false} unrest />
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
        <FreshnessFooter updated={unrest.updated} lastChecked={unrest.lastChecked} extra="Intensity here means scale of mobilisation and lethality of the response, not armed combat." />
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
        <div className="panel-title">
          <p className="eyebrow">Assessments and memberships</p>
          <h2>Latest changes</h2>
        </div>
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
    { kind: 'unrest' as const, title: 'Unrest', name: (id: string) => UNREST_BY_ID.get(id)?.name ?? id, open: props.onSelectUnrest },
  ].map((g) => ({ ...g, rows: items.filter((it) => it.kind === g.kind) }));
  return (
    <>
      <div className="panel-head">
        <div className="panel-title">
          <p className="eyebrow">Saved on this device</p>
          <h2>
            Watchlist
          </h2>
        </div>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        {items.length === 0 ? (
          <Muted>Nothing starred yet. Open any country, bloc or conflict and press the star to follow it. The ticker and Latest changes can then be filtered to what you follow.</Muted>
        ) : (
          <Muted>Stars are kept in this browser only. Use the ★ Watchlist toggle on the ticker or in Latest changes to see only these.</Muted>
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
                  <li key={it.id} className="watch-row">
                    <button onClick={() => g.open(it.id)}>
                      {g.kind === 'conflict' && <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: INTENSITY_COLOR[CONFLICT_BY_ID.get(it.id)?.intensity ?? 'latent'] }} />}
                      {g.kind === 'bloc' && <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: BLOC_BY_ID.get(it.id)?.color }} />}
                      {g.kind === 'unrest' && <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: UNREST_COLOR[UNREST_BY_ID.get(it.id)?.intensity ?? 'latent'] }} />}
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
            Open Latest changes
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
          <AgeBadges date={now.date} kind="chokepoint" />
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
        <div className="updated">
          {FRESHNESS.curated(CHOKEPOINTS_FILE.verified)}; passages tied to a high-intensity conflict are re-checked by the daily research pass. Sources: {CHOKEPOINTS_FILE.sources.map((s) => s.name).join('; ')}.
        </div>
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
        <div className="panel-actions compare-actions">
          <span className="action-group">
            <button className="text-btn" onClick={() => props.onSelectBloc(a.id)}>
              Open {a.shortName}
            </button>
            <button className="text-btn" onClick={() => props.onSelectBloc(b.id)}>
              Open {b.shortName}
            </button>
          </span>
          <span className="action-group">
            <button className="text-btn" onClick={props.onStopCompare}>
              Stop comparing
            </button>
            <ShareButton />
          </span>
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
    body = <AboutView onClose={props.onClose} closeButton={(onClick) => <CloseButton onClick={onClick} />} actions={<ShareButton />} />;
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
    <section className="panel frame" aria-live="polite">
      {body}
    </section>
  );
}
