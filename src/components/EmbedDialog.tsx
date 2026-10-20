import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { embedSnippet, embedUrl, EMBED_PRESETS } from '../lib/embedSnippet';
import { formatMonth } from '../lib/labels';
import { DEFAULT_EMBED_OPTS, type AppState, type EmbedOptions } from '../lib/urlState';

interface Props {
  state: AppState;
  /** What the view shows, used for the iframe's accessible title. */
  title: string;
  onClose: () => void;
}

/** Builds an iframe snippet for the current view with a live preview and the host options. */
export default function EmbedDialog({ state, title, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [preset, setPreset] = useState(1);
  const [opts, setOpts] = useState<EmbedOptions>(DEFAULT_EMBED_OPTS);
  const [freeze, setFreeze] = useState(state.month !== null);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);

  const size = EMBED_PRESETS[preset] ?? EMBED_PRESETS[1]!;
  const src = useMemo(() => embedUrl(state, opts, freeze, window.location.href), [state, opts, freeze]);
  const snippet = embedSnippet(src, size.height, title);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied('ok');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied('failed');
    }
  };

  return (
    <dialog ref={ref} className="embed-dialog" aria-labelledby={`${id}-title`} onClose={onClose}>
      <div className="panel-head">
        <h2 id={`${id}-title`}>
          <span className="eyebrow">Embed this view</span>
          {title}
        </h2>
        <button className="icon-btn" aria-label="Close embed dialog" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="embed-dialog-body">
        <div className="embed-options">
          <fieldset>
            <legend>Preview size</legend>
            {EMBED_PRESETS.map((p, i) => (
              <label key={p.label}>
                <input type="radio" name={`${id}-size`} checked={preset === i} onChange={() => setPreset(i)} /> {p.label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Legend</legend>
            {(['auto', 'off'] as const).map((v) => (
              <label key={v}>
                <input type="radio" name={`${id}-legend`} checked={opts.legend === v} onChange={() => setOpts({ ...opts, legend: v })} /> {v === 'auto' ? 'Fit to frame' : 'Off'}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Interaction</legend>
            <label>
              <input type="radio" name={`${id}-int`} checked={opts.interactive} onChange={() => setOpts({ ...opts, interactive: true })} /> Two-finger / ctrl+scroll
            </label>
            <label>
              <input type="radio" name={`${id}-int`} checked={!opts.interactive} onChange={() => setOpts({ ...opts, interactive: false })} /> Static
            </label>
          </fieldset>
          <fieldset>
            <legend>Theme</legend>
            {(['auto', 'dark', 'light'] as const).map((v) => (
              <label key={v}>
                <input type="radio" name={`${id}-theme`} checked={opts.theme === v} onChange={() => setOpts({ ...opts, theme: v })} /> {v === 'auto' ? 'Reader’s system' : v === 'dark' ? 'Dark' : 'Light'}
              </label>
            ))}
          </fieldset>
          <label className="freeze">
            <input type="checkbox" checked={freeze} disabled={state.mode !== 'conflicts' || state.month === null} onChange={(e) => setFreeze(e.target.checked)} />{' '}
            {state.mode === 'conflicts' && state.month ? `Freeze at ${formatMonth(state.month)}` : 'Freeze at this month (scrub the timeline first)'}
          </label>
          <p className="hint">{freeze && state.month ? `The embed shows ${formatMonth(state.month)} and says so in its badge.` : 'The embed shows the live map and updates with each weekly research pass.'}</p>
        </div>
        <div className="embed-preview" style={{ maxWidth: '100%' }}>
          <iframe key={src} src={src} width={size.width} height={size.height} title={`Preview: ATLAS: ${title}`} loading="lazy" />
        </div>
        <label className="embed-snippet">
          <span>Snippet</span>
          <textarea readOnly value={snippet} rows={3} onFocus={(e) => e.currentTarget.select()} />
        </label>
        <div className="embed-actions">
          <button className="text-btn" onClick={() => void copy()}>
            {copied === 'ok' ? 'Snippet copied' : 'Copy snippet'}
          </button>
          {copied === 'failed' && <span className="hint">Clipboard blocked: select the snippet above and copy it.</span>}
        </div>
      </div>
    </dialog>
  );
}
