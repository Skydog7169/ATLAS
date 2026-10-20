/// <reference types="vitest/config" />
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { DEFAULT_FEEDS, feedCache } from './api/_lib/aircraft';

/**
 * Serves /api/aircraft from the dev and preview servers the way the Vercel
 * function does in production, so the live layer works under `pnpm dev`.
 */
function aircraftApi(): Plugin {
  const cache = feedCache(DEFAULT_FEEDS, 90_000);
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/aircraft') return next();
    cache
      .get()
      .then((feed) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(feed));
      })
      .catch((err: Error) => {
        res.statusCode = 502;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      });
  };
  return {
    name: 'atlas-aircraft-api',
    configureServer: (server) => void server.middlewares.use(handle),
    configurePreviewServer: (server) => void server.middlewares.use(handle),
  };
}

export default defineConfig({
  plugins: [react(), aircraftApi()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split long-lived vendor code from app code so returning visitors
        // only re-download what changed. Map geometry gets its own chunk
        // because it is the largest asset and changes least often.
        manualChunks(id) {
          if (id.includes('countries-50m')) return 'geo-50m';
          if (id.includes('us-atlas')) return 'geo-us';
          if (id.includes('world-atlas') || id.includes('/src/data/geo/')) return 'geo';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          if (id.includes('node_modules/d3-') || id.includes('node_modules/topojson')) return 'd3';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
