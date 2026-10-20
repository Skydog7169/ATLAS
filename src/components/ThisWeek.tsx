import { useMemo, useState } from 'react';
import { COUNTS } from '../lib/frontdoor';
import { INTRO_AT_LOAD, dismissIntro } from '../lib/firstVisit';
import { INTENSITY_COLOR, INTENSITY_LABEL, UNREST_INTENSITY_LABEL, formatDate, formatDayMonth } from '../lib/labels';
import { weekSummary, type WeekItem } from '../lib/thisWeek';
import { UNREST_COLOR } from '../lib/unrest';

interface Props {
  onSelectConflict: (id: string) => void;
  onSelectUnrest: (id: string) => void;
  onOpenChanges: () => void;
  onOpenAbout: () => void;
}

const DELTA_WORD: Record<WeekItem['delta'], string> = { new: 'New', up: '▲ Escalated', down: '▼ Eased', same: 'Updated' };

/**
 * First-visit card: what ATLAS is, what changed in the newest week of data
 * (new, escalated, eased, and the top three items by intensity × recency) and
 * how the assessments are made. Dismissal is remembered in localStorage.
 */
export default function ThisWeek({ onSelectConflict, onSelectUnrest, onOpenChanges, onOpenAbout }: Props) {
  const [open, setOpen] = useState(INTRO_AT_LOAD === 'open');
  const week = useMemo(() => weekSummary(), []);
  if (!open) return null;
  const close = () => {
    dismissIntro();
    setOpen(false);
  };
  const openItem = (it: WeekItem) => (it.kind === 'conflict' ? onSelectConflict(it.id) : onSelectUnrest(it.id));
  return (
    <aside className="this-week frame" aria-labelledby="this-week-title">
      <div className="tw-head">
        <h2 id="this-week-title">
          This week
          <span className="tw-range">
            {formatDayMonth(week.from)} – {formatDate(week.to)}
          </span>
        </h2>
        <button className="icon-btn small" onClick={close} aria-label="Dismiss This week">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <p className="tw-counts">
        <span data-delta="new">
          <b>{week.counts.new}</b> new
        </span>
        <span data-delta="up">
          <b>{week.counts.up}</b> escalated
        </span>
        <span data-delta="down">
          <b>{week.counts.down}</b> eased
        </span>
      </p>
      <ol className="tw-list">
        {week.top.map((it) => (
          <li key={it.kind + it.id}>
            <button type="button" onClick={() => openItem(it)}>
              <span className="dot" style={{ background: it.kind === 'unrest' ? UNREST_COLOR[it.intensity] : INTENSITY_COLOR[it.intensity] }} aria-hidden="true" />
              <span className="tw-title">{it.title}</span>
              <span className="tw-meta">
                <span data-delta={it.delta}>{DELTA_WORD[it.delta]}</span> · {(it.kind === 'unrest' ? UNREST_INTENSITY_LABEL : INTENSITY_LABEL)[it.intensity]} · {formatDayMonth(it.date)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="tw-note">
        ATLAS maps {COUNTS.blocs} alliances, {COUNTS.conflicts} wars and {COUNTS.unrest} unrest episodes. AI-researched from cited sources, editor-approved.
      </p>
      <div className="tw-actions">
        <button className="text-btn primary" onClick={onOpenChanges}>
          All latest changes
        </button>
        <button className="text-btn" onClick={onOpenAbout}>
          How it works →
        </button>
      </div>
    </aside>
  );
}
