import { useEffect, useState } from 'react';

interface Citation {
  id: string;
  title: string;
  url: string;
}

interface AnswerBody {
  answer: string;
  citations: Citation[];
  covered: boolean;
  error?: string;
}

/** Client flag: the panel only mounts when the build was made with VITE_ASK_ATLAS=1. */
export const ASK_ENABLED = import.meta.env.VITE_ASK_ATLAS === '1';

export default function AskPanel({ onClose, onOpenId }: { onClose: () => void; onOpenId: (id: string) => void }) {
  const [question, setQuestion] = useState('');
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; body: AnswerBody } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const [serverOn, setServerOn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/ask')
      .then((r) => r.json())
      .then((j: { enabled?: boolean }) => alive && setServerOn(Boolean(j.enabled)))
      .catch(() => alive && setServerOn(false));
    return () => {
      alive = false;
    };
  }, []);

  const submit = async () => {
    const q = question.trim();
    if (q.length < 3) return;
    setState({ kind: 'busy' });
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q }) });
      const body = (await res.json()) as AnswerBody;
      if (!res.ok) setState({ kind: 'error', message: body.error ?? `Request failed (${res.status})` });
      else setState({ kind: 'done', body });
    } catch {
      setState({ kind: 'error', message: 'Could not reach Ask ATLAS.' });
    }
  };

  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">Experimental</span>
          Ask ATLAS
        </h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="panel-body">
        <p style={{ color: 'var(--fg-muted)' }}>Answers come only from the dataset on this map, with citations. Questions outside it are declined. Ten questions per hour per visitor.</p>
        {serverOn === false && <p className="ask-off">Ask ATLAS is switched off on this deployment.</p>}
        <form
          className="ask-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="sr-only" htmlFor="ask-q">
            Your question
          </label>
          <input id="ask-q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Which conflicts does Iran back abroad?" maxLength={500} disabled={state.kind === 'busy' || serverOn === false} />
          <button className="text-btn primary" type="submit" disabled={state.kind === 'busy' || serverOn === false || question.trim().length < 3}>
            {state.kind === 'busy' ? 'Thinking…' : 'Ask'}
          </button>
        </form>
        {state.kind === 'error' && <p className="ask-off">{state.message}</p>}
        {state.kind === 'done' && (
          <div className="ask-answer" aria-live="polite">
            <p>{state.body.answer}</p>
            {state.body.citations.length > 0 && (
              <>
                <h4>Citations</h4>
                <ul className="link-list">
                  {state.body.citations.map((c, i) => (
                    <li key={c.id + i}>
                      <a href={c.url} target="_blank" rel="noopener noreferrer">
                        <span>
                          {c.title}
                          <span className="row-note">
                            <button type="button" className="inline-link" onClick={() => onOpenId(c.id)}>
                              {c.id}
                            </button>
                          </span>
                        </span>
                        <span className="meta">↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!state.body.covered && <p className="updated">Outside the dataset: nothing here is drawn from beyond the map's sources.</p>}
          </div>
        )}
      </div>
    </>
  );
}
