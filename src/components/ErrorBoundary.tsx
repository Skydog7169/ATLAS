import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Rendered instead of the default fallback; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors below it so a bad data row or a browser quirk in the
 * map never blanks the whole page. Resetting re-mounts the subtree.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('ErrorBoundary caught', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="error-fallback" role="alert">
        <div>
          <h2>Something went wrong</h2>
          <p>The map hit an unexpected error. You can try again or reload the page.</p>
          <p>
            <button className="text-btn primary" onClick={this.reset}>
              Try again
            </button>{' '}
            <button className="text-btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </p>
          <details>
            <summary>Details</summary>
            <pre>{error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
