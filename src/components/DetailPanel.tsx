import { useState } from 'react';
import { BLOC_BY_ID, blocsForCountry } from '../data/blocs';
import { CONFLICT_BY_ID, INTENSITY_ORDER, conflictsForCountry } from '../data/conflicts';
import type { Bloc, Conflict, CountryRecord, MembershipStatus } from '../data/types';
import { COUNTRY_BY_ISO, countryName } from '../lib/countries';
import { CATEGORY_LABEL, CONFLICT_TYPE_LABEL, INTENSITY_COLOR, INTENSITY_LABEL, STATUS_LABEL, formatMonth } from '../lib/labels';
import type { Selection } from '../lib/urlState';

interface Props {
  selection: Exclude<Selection, null>;
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
        <Sources sources={bloc.sources} />
        <div className="updated">Membership verified {formatMonth(bloc.updated)}.</div>
      </div>
    </>
  );
}

function ConflictView({ conflict, props }: { conflict: Conflict; props: Props }) {
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
          <span className="badge" style={{ ['--badge-color' as string]: INTENSITY_COLOR[conflict.intensity] }}>
            <span className="dot" /> {INTENSITY_LABEL[conflict.intensity]}
          </span>
          <span className="badge muted">Since {conflict.since}</span>
        </div>
        <h4>Parties</h4>
        <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
          {conflict.parties.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h4>Background</h4>
        <p>{conflict.summary}</p>
        <h4>Latest</h4>
        <p>{conflict.status}</p>
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
        <Sources sources={conflict.sources} />
        <div className="updated">Entry verified {formatMonth(conflict.updated)}. Check the sources above for developments since then.</div>
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
