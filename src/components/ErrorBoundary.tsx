import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkError } from '../lib/chunkReload';

type Variant = 'app' | 'map' | 'panel';

interface Props {
  children: ReactNode;
  /** Where the boundary sits; picks the fallback's eyebrow and copy. */
  variant?: Variant;
  /** Rendered instead of the default fallback; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Told when the subtree fails (error) and when it recovers (null), so the HUD around it can react. */
  onError?: (error: Error | null) => void;
  /** Reload by itself after this long when a newer deploy replaced the code (briefing wall displays). */
  autoReloadMs?: number;
  /** Clears a caught error when this changes (e.g. the user picks something else). */
  resetKey?: string;
}

interface State {
  error: Error | null;
  copied: boolean;
}

const COPY: Record<Variant, { eyebrow: string; title: string; body: string }> = {
  app: { eyebrow: 'Signal lost', title: 'Something went wrong', body: 'ATLAS hit an unexpected error. Try again, or reload the page.' },
  map: { eyebrow: 'Signal lost · map module', title: 'The map could not be drawn', body: 'The map hit an unexpected error. Try again, or reload the page; your view is kept in the link.' },
  panel: { eyebrow: 'Dossier unavailable', title: 'This panel could not be shown', body: 'The map is fine; only this panel failed. Close it, try again, or reload the page.' },
};

/**
 * Catches render errors below it so a bad data row or a browser quirk in the
 * map never blanks the whole page. Resetting re-mounts the subtree.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false };
  private timer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('ErrorBoundary caught', error, info.componentStack);
    this.props.onError?.(error);
    if (isChunkError(error) && this.props.autoReloadMs) this.timer = setTimeout(() => window.location.reload(), this.props.autoReloadMs);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.reset();
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
    if (this.state.error) this.props.onError?.(null);
  }

  reset = () => {
    this.setState({ error: null, copied: false });
    this.props.onError?.(null);
  };

  copyDiagnostics = () => {
    const { error } = this.state;
    if (!error) return;
    const text = [`ATLAS ${window.location.href}`, `${error.name}: ${error.message}`, navigator.userAgent, new Date().toISOString()].join('\n');
    void navigator.clipboard?.writeText(text).then(
      () => this.setState({ copied: true }),
      () => undefined,
    );
  };

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    const variant = this.props.variant ?? 'app';
    // A renamed chunk can never load again in this tab, so "Try again" would only fail again.
    const stale = isChunkError(error);
    const copy = stale
      ? { eyebrow: 'New edition available', title: 'ATLAS was updated while this tab was open', body: 'Reload to load the new edition. Your view is kept in the link.' }
      : COPY[variant];
    return (
      <div className={variant === 'panel' ? 'panel error-fallback' : 'error-fallback'} data-variant={variant} role="alert">
        <div className="error-card frame">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
          <p className="error-actions">
            {stale ? (
              <button className="text-btn primary" onClick={() => window.location.reload()}>
                Reload
              </button>
            ) : (
              <>
                <button className="text-btn primary" onClick={this.reset}>
                  Try again
                </button>
                <button className="text-btn" onClick={() => window.location.reload()}>
                  Reload
                </button>
              </>
            )}
            {!stale && (
              <button className="text-btn" onClick={this.copyDiagnostics}>
                {copied ? 'Copied' : 'Copy diagnostics'}
              </button>
            )}
          </p>
        </div>
      </div>
    );
  }
}
