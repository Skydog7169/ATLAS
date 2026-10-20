import type { HistoryEntry, Intensity } from '../data/types';
import { CONFIDENCE_DEF, FRESHNESS, INTENSITY_COLOR, INTENSITY_DEF, INTENSITY_LABEL, UNREST_INTENSITY_DEF, UNREST_INTENSITY_LABEL, formatDate, isStale, relativeAge, type STALE_DAYS } from '../lib/labels';
import { UNREST_COLOR } from '../lib/unrest';
import { provenanceLine, sourceLabel, splitSources } from '../lib/sources';
import type { Source } from '../data/types';

/**
 * Citations as "Outlet: Headline (date)". Front pages and tracker indexes are
 * set apart on a muted "Background reference" line: they cannot support the
 * specific claim above them.
 */
export function SourceLinks({ sources }: { sources: readonly Source[] }) {
  const { cited, background } = splitSources(sources);
  return (
    <>
      {cited.length > 0 && (
        <ul className="cite-list">
          {cited.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                <span className="cite-outlet">{s.outlet}</span>
                {s.headline && <span>: {s.headline}</span>}
                {s.date && <span className="cite-date"> ({s.date})</span>}
                <span className="meta" aria-hidden="true">
                  {' '}
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {background.length > 0 && (
        <p className="cite-background">
          Background reference:{' '}
          {background.map((s, i) => (
            <span key={s.url}>
              {i > 0 ? ' · ' : ''}
              <a href={s.url} target="_blank" rel="noopener noreferrer" title={sourceLabel(s)}>
                {s.outlet}
              </a>
            </span>
          ))}
        </p>
      )}
    </>
  );
}

/** "AI-drafted (Claude, web search) from 3 cited sources · approved by an editor · 19 Oct 2026". */
export function ProvenanceNote({ entry }: { entry: HistoryEntry }) {
  return <p className="provenance">{provenanceLine(entry)}</p>;
}

export function ConfidenceLabel({ entry }: { entry: HistoryEntry }) {
  return entry.confidence ? (
    <span className="label" title={CONFIDENCE_DEF[entry.confidence]}>
      {' '}
      · {entry.confidence} confidence
    </span>
  ) : (
    <span className="label muted-label"> · confidence not assessed</span>
  );
}

/** Intensity badge with its definition as a tooltip; unrest uses its own words and ramp. */
export function IntensityBadge({ intensity, unrest }: { intensity: Intensity; unrest?: boolean }) {
  const label = unrest ? UNREST_INTENSITY_LABEL[intensity] : INTENSITY_LABEL[intensity];
  const def = unrest ? UNREST_INTENSITY_DEF[intensity] : INTENSITY_DEF[intensity];
  return (
    <span className="badge" style={{ ['--badge-color' as string]: unrest ? UNREST_COLOR[intensity] : INTENSITY_COLOR[intensity] }} title={`${label}: ${def}`}>
      <span className="dot" /> {label}
    </span>
  );
}

/** Amber chip for entries past their freshness window, plus the relative age. */
export function AgeBadges({ date, kind }: { date: string; kind: keyof typeof STALE_DAYS }) {
  const stale = isStale(date, kind);
  return (
    <>
      <span className="badge muted" title={FRESHNESS.updated(date)}>
        Updated {relativeAge(date)}
      </span>
      {stale && (
        <span className="badge stale" title={`No update since ${formatDate(date)}. Check the linked sources for developments since then.`}>
          May be out of date
        </span>
      )}
    </>
  );
}

/**
 * The newest assessment, shown first so "what is happening now" is the
 * first thing a panel says. During replay it shows the entry in force for
 * the replay month.
 */
export function LatestBlock({ entry, unrest, replay }: { entry: HistoryEntry; unrest?: boolean; replay?: boolean }) {
  const label = unrest ? UNREST_INTENSITY_LABEL[entry.intensity] : INTENSITY_LABEL[entry.intensity];
  return (
    <section className="latest" aria-labelledby="latest-title">
      <h3 id="latest-title">
        {replay ? 'Assessment in force' : 'Latest'} · {formatDate(entry.date)}
      </h3>
      <p className="latest-meta">
        <span className="dot" style={{ background: unrest ? UNREST_COLOR[entry.intensity] : INTENSITY_COLOR[entry.intensity] }} aria-hidden="true" />
        {label}
        <ConfidenceLabel entry={entry} />
      </p>
      <p className="latest-status">{entry.status}</p>
      <SourceLinks sources={entry.sources} />
      <ProvenanceNote entry={entry} />
    </section>
  );
}

/**
 * Panel footer in the shared vocabulary: "Updated <date>" when the text last
 * changed, "Checked <date>, no change" when the research pass re-read it.
 */
export function FreshnessFooter({ updated, lastChecked, extra }: { updated: string; lastChecked?: string; extra?: string }) {
  return (
    <div className="updated">
      {FRESHNESS.updated(updated)}.{lastChecked && lastChecked > updated ? ` ${FRESHNESS.checked(lastChecked)}.` : ''} Re-checked daily if high intensity or recently active, weekly otherwise; an editor approves each change.
      {extra ? ` ${extra}` : ''} Check the linked sources for developments since then.
    </div>
  );
}
