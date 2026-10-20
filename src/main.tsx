import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installChunkReload } from './lib/chunkReload';
import './styles/fonts.css';
import './styles/global.css';
import './styles/time.css';
import './styles/embed.css';
import './styles/first-paint.css';
import './styles/status.css';
import './styles/nav.css';
import './styles/mapstate.css';
import './styles/frontdoor.css';

installChunkReload();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
